import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPasses, getRadioPasses } from "@/lib/n2yo";
import { enrichPassesWithWeather } from "@/lib/weather";
import { sendPassDigest, isSendOk } from "@/lib/resend";

// This route is called by a cron job (or manually) to send the daily pass digest.
// For each active subscription it sends, once per local day at/after 13:00 in the
// subscriber's local time zone on a selected weekday, an email listing the
// satellite's upcoming passes (filtered by the alert's min-elevation/pass-type).
// The cron should run at least hourly so 13:00 is matched across time zones and
// transient failures can be retried later the same day.

const DIGEST_HOUR = 13; // earliest local hour the digest may go out (1pm)
const LOOK_AHEAD_DAYS = 1; // scheduled digest covers the next 24 hours
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local-time fields (year/month/day/hour/weekday) of a UTC date in the given IANA
// zone, built deterministically with formatToParts to avoid locale-format
// ambiguity. Falls back to UTC if the zone is missing or invalid.
function localParts(date: Date, tz: string | null | undefined) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const weekday = WEEKDAYS.indexOf(get("weekday"));
    const hour = parseInt(get("hour"), 10) % 24;
    return {
      year: get("year"),
      month: get("month"),
      day: get("day"),
      hour: Number.isNaN(hour) ? date.getUTCHours() : hour,
      weekday: weekday === -1 ? date.getUTCDay() : weekday,
    };
  } catch {
    return {
      year: String(date.getUTCFullYear()),
      month: String(date.getUTCMonth() + 1).padStart(2, "0"),
      day: String(date.getUTCDate()).padStart(2, "0"),
      hour: date.getUTCHours(),
      weekday: date.getUTCDay(),
    };
  }
}

// Stable per-local-day integer marker (epoch seconds of that local date at 00:00
// UTC). Used as the sent_alerts dedupe key — the table's
// UNIQUE(subscription_id, pass_start_utc) makes claiming a marker atomic.
function dateMarker(p: { year: string; month: string; day: string }): number {
  return Math.floor(Date.parse(`${p.year}-${p.month}-${p.day}T00:00:00Z`) / 1000);
}

export async function POST(request: NextRequest) {
  // Simple auth: verify a shared secret in production
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.ALERT_CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();

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

  const now = new Date();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const sub of subs) {
    const group = (sub as Record<string, unknown>).groups as
      | { name: string; location_name: string | null; latitude: number | null; longitude: number | null; altitude: number | null }
      | null;
    if (!group || group.latitude == null || group.longitude == null) {
      skipped++;
      continue;
    }

    const p = localParts(now, sub.timezone);

    // Only fire at/after 13:00 local (so an hourly cron can recover from earlier
    // failures the same day), and only on a selected weekday (empty = every day).
    if (p.hour < DIGEST_HOUR) {
      skipped++;
      continue;
    }
    const allowedDays: number[] = Array.isArray(sub.days_of_week) ? sub.days_of_week : [];
    if (allowedDays.length > 0 && !allowedDays.includes(p.weekday)) {
      skipped++;
      continue;
    }

    const marker = dateMarker(p);

    // Skip if today's digest was already sent (fast path before any N2YO call).
    const { data: already } = await supabase
      .from("sent_alerts")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("pass_start_utc", marker)
      .maybeSingle();
    if (already) {
      skipped++;
      continue;
    }

    const lookAhead =
      Number.isInteger(sub.look_ahead_days) && sub.look_ahead_days > 0 && sub.look_ahead_days <= 10
        ? sub.look_ahead_days
        : LOOK_AHEAD_DAYS;

    let passes;
    try {
      const fetchPasses = sub.pass_mode === "all" ? getRadioPasses : getPasses;
      const passData = await fetchPasses(
        sub.satellite_norad_id,
        group.latitude,
        group.longitude,
        group.altitude ?? 0,
        lookAhead,
        sub.min_elevation
      );
      // Best-effort cloud-cover enrichment so the digest shows sky conditions.
      passes = await enrichPassesWithWeather(passData.passes ?? [], group.latitude, group.longitude, lookAhead);
    } catch (e) {
      // N2YO failure — leave the day unclaimed so a later cron run retries.
      failed++;
      console.error("[alerts] pass fetch failed:", e);
      continue;
    }

    // Atomically claim the day before sending. The unique constraint means a
    // concurrent run that already claimed this marker makes our insert fail,
    // guaranteeing at most one digest is sent per local day.
    const { error: claimErr } = await supabase.from("sent_alerts").insert({
      subscription_id: sub.id,
      satellite_norad_id: sub.satellite_norad_id,
      pass_start_utc: marker,
    });
    if (claimErr) {
      // 23505 = another run beat us to it; anything else is logged.
      if (claimErr.code !== "23505") console.error("[alerts] claim failed:", claimErr);
      skipped++;
      continue;
    }

    // Day is claimed. No passes => nothing to send (an empty digest is just noise).
    if (passes.length === 0) {
      skipped++;
      continue;
    }

    try {
      const result = await sendPassDigest({
        toEmail: sub.email,
        satelliteName: `NORAD ${sub.satellite_norad_id}`,
        locationName: group.location_name ?? group.name,
        groupName: group.name,
        passes,
        rangeLabel: `next ${lookAhead} day${lookAhead === 1 ? "" : "s"}`,
        timeZone: sub.timezone,
      });
      if (!isSendOk(result)) {
        // Release the claim so a later run the same day can retry the send.
        await supabase.from("sent_alerts").delete().eq("subscription_id", sub.id).eq("pass_start_utc", marker);
        failed++;
        console.error("[alerts] digest rejected by API:", (result as { error: unknown }).error);
        continue;
      }
      sent++;
    } catch (e) {
      await supabase.from("sent_alerts").delete().eq("subscription_id", sub.id).eq("pass_start_utc", marker);
      failed++;
      console.error("[alerts] digest send threw:", e);
    }
  }

  return NextResponse.json({ sent, failed, skipped, total: subs.length });
}

// GET for health / status check
export async function GET() {
  return NextResponse.json({ status: "Alert pipeline ready" });
}
