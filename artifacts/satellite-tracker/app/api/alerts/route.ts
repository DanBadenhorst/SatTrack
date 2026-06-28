import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPasses, getRadioPasses } from "@/lib/n2yo";
import { sendPassAlert, isSendOk, AlertPayload } from "@/lib/resend";

// This route is called by a cron job (or manually) to send pending alerts
// It checks all active subscriptions and sends alerts for passes starting
// within the notification window.

// Returns the weekday (0=Sun … 6=Sat) of a UTC epoch evaluated in the given
// IANA time zone, so day-of-week alert filters match the user's local calendar.
// Falls back to UTC when the zone is missing or invalid.
function weekdayInTz(epochSec: number, tz: string | null | undefined): number {
  const date = new Date(epochSec * 1000);
  try {
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      weekday: "short",
    }).format(date);
    const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
    return idx === -1 ? date.getUTCDay() : idx;
  } catch {
    return date.getUTCDay();
  }
}

export async function POST(request: NextRequest) {
  // Simple auth: verify a shared secret in production
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.ALERT_CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();

  // Get all active subscriptions with the group's observing location
  const { data: subs, error } = await supabase
    .from("alert_subscriptions")
    .select(`
      *,
      groups(name, location_name, latitude, longitude, altitude)
    `)
    .eq("active", true);

  if (error || !subs) {
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }

  type Candidate = {
    record: { subscription_id: string; satellite_norad_id: number; pass_start_utc: number };
    payload: AlertPayload;
  };
  const candidates: Candidate[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const sub of subs) {
    const group = (sub as Record<string, unknown>).groups as { name: string; location_name: string | null; latitude: number | null; longitude: number | null; altitude: number | null } | null;
    if (!group || group.latitude == null || group.longitude == null) continue;

    try {
      const fetchPasses = sub.pass_mode === "all" ? getRadioPasses : getPasses;
      const passData = await fetchPasses(
        sub.satellite_norad_id,
        group.latitude,
        group.longitude,
        group.altitude ?? 0,
        1, // look ahead 1 day
        sub.min_elevation
      );

      for (const pass of passData.passes ?? []) {
        const minutesUntilPass = (pass.startUTC - now) / 60;

        // Only alert for passes starting within the notification window
        if (minutesUntilPass > 0 && minutesUntilPass <= sub.notify_minutes_before) {
          // Honor the per-weekday filter (empty/missing = every day), evaluated
          // in the subscriber's local time zone.
          const allowedDays: number[] = Array.isArray(sub.days_of_week) ? sub.days_of_week : [];
          if (allowedDays.length > 0 && !allowedDays.includes(weekdayInTz(pass.startUTC, sub.timezone))) {
            continue;
          }

          // Skip passes we've already sent an alert for
          const { data: existing } = await supabase
            .from("sent_alerts")
            .select("id")
            .eq("subscription_id", sub.id)
            .eq("pass_start_utc", pass.startUTC)
            .single();

          if (existing) continue; // Already sent

          candidates.push({
            record: {
              subscription_id: sub.id,
              satellite_norad_id: sub.satellite_norad_id,
              pass_start_utc: pass.startUTC,
            },
            payload: {
              toEmail: sub.email,
              toName: sub.email.split("@")[0],
              satelliteName: `NORAD ${sub.satellite_norad_id}`,
              locationName: group.location_name ?? group.name,
              pass,
            },
          });
        }
      }
    } catch {
      // Skip failed satellites, continue processing others
    }
  }

  // Dedupe so the same subscription/pass isn't emailed twice in one run.
  const seen = new Set<string>();
  const deduped = candidates.filter((c) => {
    const key = `${c.record.subscription_id}-${c.record.pass_start_utc}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: "No pending alerts" });
  }

  let sent = 0;
  let failed = 0;
  for (const c of deduped) {
    try {
      const result = await sendPassAlert(c.payload);
      if (!isSendOk(result)) {
        failed++;
        console.error("[alerts] send rejected by API:", result.error);
        continue;
      }
      // Record the alert as sent only after delivery is confirmed, so a failed
      // send (e.g. Resend sandbox 403) is retried on the next cron run instead
      // of being permanently marked as sent.
      await supabase.from("sent_alerts").insert(c.record);
      sent++;
    } catch (e) {
      failed++;
      console.error("[alerts] send threw:", e);
    }
  }

  return NextResponse.json({ sent, failed, total: deduped.length });
}

// GET for health / status check
export async function GET() {
  return NextResponse.json({ status: "Alert pipeline ready" });
}
