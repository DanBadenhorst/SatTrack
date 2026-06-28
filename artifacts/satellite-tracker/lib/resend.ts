import { Resend } from "resend";
import { Pass } from "./n2yo";

const resend = new Resend(process.env.RESEND_API_KEY!);

// The "from" address. Resend's shared `onboarding@resend.dev` sandbox sender can
// ONLY deliver to your own Resend account email — every other recipient is
// rejected with a 403 until you verify a domain at resend.com/domains. Once
// verified, set RESEND_FROM_EMAIL (e.g. "SatTrack <alerts@yourdomain.com>") and
// emails will deliver to anyone, with no code change needed.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "SatTrack <onboarding@resend.dev>";

export interface AlertPayload {
  toEmail: string;
  toName: string;
  satelliteName: string;
  locationName: string;
  pass: Pass;
  groupName?: string;
}

export async function sendPassAlert(payload: AlertPayload) {
  const startTime = new Date(payload.pass.startUTC * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const maxTime = new Date(payload.pass.maxUTC * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = payload.groupName
    ? `[${payload.groupName}] ${payload.satelliteName} pass starting at ${startTime}`
    : `${payload.satelliteName} pass alert — ${startTime}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, sans-serif; background: #08080f; color: #e2e8f0; margin: 0; padding: 20px; }
        .card { background: #0f0f1e; border: 1px solid #1e3a5f; border-radius: 12px; padding: 28px; max-width: 500px; margin: 0 auto; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; background: #1a3a6a; color: #60a5fa; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
        h1 { font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0 0 4px; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        .stat-row { display: flex; gap: 16px; margin-bottom: 24px; }
        .stat { flex: 1; background: #0a0a1e; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; }
        .stat-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .stat-value { font-size: 18px; font-weight: 700; color: #f1f5f9; }
        .detail-list { list-style: none; padding: 0; margin: 0; }
        .detail-list li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }
        .detail-list li:last-child { border-bottom: none; }
        .detail-label { color: #64748b; }
        .detail-value { color: #e2e8f0; font-weight: 500; }
        .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #475569; }
        a { color: #60a5fa; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">PASS ALERT</div>
        <h1>${payload.satelliteName}</h1>
        <p class="subtitle">
          ${payload.locationName}${payload.groupName ? ` · ${payload.groupName}` : ""}
        </p>

        <div class="stat-row">
          <div class="stat">
            <div class="stat-label">Max Elevation</div>
            <div class="stat-value">${payload.pass.maxEl.toFixed(1)}°</div>
          </div>
          <div class="stat">
            <div class="stat-label">Duration</div>
            <div class="stat-value">${payload.pass.duration != null ? `${Math.round(payload.pass.duration / 60)} min` : "—"}</div>
          </div>
        </div>

        <ul class="detail-list">
          <li><span class="detail-label">AOS (Acquisition)</span><span class="detail-value">${startTime}</span></li>
          <li><span class="detail-label">Max Elevation at</span><span class="detail-value">${maxTime}</span></li>
          <li><span class="detail-label">Start Direction</span><span class="detail-value">${payload.pass.startAz.toFixed(0)}° ${payload.pass.startAzCompass}</span></li>
          <li><span class="detail-label">Max Direction</span><span class="detail-value">${payload.pass.maxAz.toFixed(0)}° ${payload.pass.maxAzCompass}</span></li>
          <li><span class="detail-label">End Direction</span><span class="detail-value">${payload.pass.endAz.toFixed(0)}° ${payload.pass.endAzCompass}</span></li>
        </ul>

        <div class="footer">
          <p>You're receiving this because you subscribed to alerts on <a href="#">SatTrack</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return resend.emails.send({
    from: FROM_EMAIL,
    to: [payload.toEmail],
    subject,
    html,
  });
}

export interface PassDigestPayload {
  toEmail: string;
  satelliteName: string;
  locationName: string;
  groupName?: string;
  passes: Pass[];
  // Human-readable description of the look-ahead window, e.g. "next 3 days".
  rangeLabel: string;
  // IANA time zone to render pass times in (the subscriber's local zone, stored
  // at subscription creation). Falls back to the server zone when absent.
  timeZone?: string | null;
}

// Compact sky-condition cell from cloud cover percent (Open-Meteo): clear <25%,
// partly 25–60%, overcast >60%. "—" when outside the forecast horizon.
function skyCell(cloud?: number): string {
  if (cloud == null) return "—";
  const icon = cloud < 25 ? "☀️" : cloud <= 60 ? "⛅" : "☁️";
  return `${icon} ${Math.round(cloud)}%`;
}

// Sends a digest email listing all upcoming passes for one satellite — the same
// list the user sees after clicking "Fetch Passes", already filtered by the
// alert's min-elevation and pass-type settings.
export async function sendPassDigest(payload: PassDigestPayload) {
  // Validate the IANA zone once; a malformed value would otherwise throw on
  // every row and fail the whole send. Fall back to the server zone.
  let tz: string | undefined;
  if (payload.timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: payload.timeZone });
      tz = payload.timeZone;
    } catch {
      console.error("[resend] invalid timeZone, using server zone:", payload.timeZone);
    }
  }
  const fmt = (epoch: number) =>
    new Date(epoch * 1000).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(tz ? { timeZone: tz } : {}),
    });

  const rows = payload.passes
    .map(
      (p) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:13px;">${fmt(p.startUTC)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #1e293b;color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${p.maxEl.toFixed(0)}°</td>
          <td style="padding:10px 8px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;text-align:right;">${p.duration != null ? `${Math.round(p.duration / 60)} min` : "—"}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;text-align:right;">${p.startAzCompass} → ${p.endAzCompass}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;text-align:right;white-space:nowrap;">${skyCell(p.cloudCover)}</td>
        </tr>`
    )
    .join("");

  const subject = payload.groupName
    ? `[${payload.groupName}] ${payload.satelliteName} — ${payload.passes.length} upcoming pass${payload.passes.length === 1 ? "" : "es"}`
    : `${payload.satelliteName} — ${payload.passes.length} upcoming pass${payload.passes.length === 1 ? "" : "es"}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, sans-serif; background: #08080f; color: #e2e8f0; margin: 0; padding: 20px; }
        .card { background: #0f0f1e; border: 1px solid #1e3a5f; border-radius: 12px; padding: 28px; max-width: 560px; margin: 0 auto; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; background: #1a3a6a; color: #60a5fa; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
        h1 { font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0 0 4px; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 8px 8px; border-bottom: 1px solid #1e293b; }
        th.r { text-align: right; }
        .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #475569; }
        a { color: #60a5fa; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">PASS DIGEST</div>
        <h1>${payload.satelliteName}</h1>
        <p class="subtitle">
          ${payload.locationName}${payload.groupName ? ` · ${payload.groupName}` : ""} · ${payload.rangeLabel}
        </p>
        <table>
          <thead>
            <tr>
              <th>Start (AOS)</th>
              <th class="r">Max El</th>
              <th class="r">Duration</th>
              <th class="r">Direction</th>
              <th class="r">Sky</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          <p>You're receiving this because you set an alert on <a href="#">SatTrack</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return resend.emails.send({
    from: FROM_EMAIL,
    to: [payload.toEmail],
    subject,
    html,
  });
}

export interface GroupMessagePayload {
  toEmail: string;
  groupName: string;
  authorName: string;
  body: string;
  postedAt: string;
  // Absolute URL to the group's chat in the web app (opens the dashboard feed
  // with this group pre-selected). Omitted only if the origin can't be derived.
  chatUrl?: string;
}

export async function sendGroupMessageEmail(payload: GroupMessagePayload) {
  const postedTime = new Date(payload.postedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = `[${payload.groupName}] New message from ${payload.authorName}`;

  const safeBody = payload.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, sans-serif; background: #08080f; color: #e2e8f0; margin: 0; padding: 20px; }
        .card { background: #0f0f1e; border: 1px solid #1e3a5f; border-radius: 12px; padding: 28px; max-width: 500px; margin: 0 auto; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; background: #1a3a6a; color: #60a5fa; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 700; color: #f1f5f9; margin: 0 0 4px; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 20px; }
        .message { background: #0a0a1e; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; font-size: 15px; line-height: 1.5; color: #e2e8f0; }
        .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #475569; }
        a { color: #60a5fa; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">GROUP FEED</div>
        <h1>${payload.groupName}</h1>
        <p class="subtitle">${payload.authorName} · ${postedTime}</p>
        <div class="message">${safeBody}</div>
        ${
          payload.chatUrl
            ? `<div style="text-align:center;margin-top:24px;">
          <a href="${payload.chatUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">Open chat &amp; reply</a>
        </div>`
            : ""
        }
        <div class="footer">
          <p>You're receiving this because you enabled feed notifications for this group on SatTrack.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return resend.emails.send({
    from: FROM_EMAIL,
    to: [payload.toEmail],
    subject,
    html,
  });
}

// Resend resolves the promise even when the API rejects the email (e.g. the 403
// returned when sending from the sandbox address to a non-owner recipient), so a
// "fulfilled" result with a non-null `.error` is still a failed send. This helper
// logs every failure and returns accurate sent/failed counts.
function tallySendResults(
  label: string,
  results: PromiseSettledResult<{ error: unknown } | unknown>[]
) {
  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "rejected") {
      failed++;
      console.error(`[resend] ${label} send threw:`, r.reason);
    } else if (r.value && typeof r.value === "object" && "error" in r.value && r.value.error) {
      failed++;
      console.error(`[resend] ${label} send rejected by API:`, r.value.error);
    } else {
      sent++;
    }
  }
  return { sent, failed };
}

export async function sendGroupMessageEmails(payloads: GroupMessagePayload[]) {
  const results = await Promise.allSettled(payloads.map(sendGroupMessageEmail));
  return tallySendResults("group message", results);
}

// Returns true when a Resend send succeeded. Resend resolves its promise even
// when the API rejects the email (non-null `.error`), so callers that need to
// record a successful delivery (e.g. the alert cron's sent_alerts dedupe) must
// check this rather than assume a resolved promise means delivered.
export function isSendOk(result: { error: unknown } | unknown): boolean {
  return !(result && typeof result === "object" && "error" in result && result.error);
}
