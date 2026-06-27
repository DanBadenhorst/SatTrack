import { Resend } from "resend";
import { Pass } from "./n2yo";

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM_EMAIL = "SatTrack <onboarding@resend.dev>";

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
            <div class="stat-value">${Math.round(payload.pass.duration / 60)} min</div>
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
    to: [{ name: payload.toName, email: payload.toEmail }],
    subject,
    html,
  });
}

export async function sendBatchAlerts(payloads: AlertPayload[]) {
  const dedupKeys = new Set<string>();
  const deduped: AlertPayload[] = [];

  for (const p of payloads) {
    const key = `${p.toEmail}-${p.satelliteName}-${p.pass.startUTC}`;
    if (!dedupKeys.has(key)) {
      dedupKeys.add(key);
      deduped.push(p);
    }
  }

  const results = await Promise.allSettled(deduped.map(sendPassAlert));
  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
