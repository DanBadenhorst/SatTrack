import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPasses } from "@/lib/n2yo";
import { sendBatchAlerts, AlertPayload } from "@/lib/resend";

// This route is called by a cron job (or manually) to send pending alerts
// It checks all active subscriptions and sends alerts for passes starting
// within the notification window.

export async function POST(request: NextRequest) {
  // Simple auth: verify a shared secret in production
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.ALERT_CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();

  // Get all active subscriptions with location and user email
  const { data: subs, error } = await supabase
    .from("alert_subscriptions")
    .select(`
      *,
      locations(name, latitude, longitude, altitude),
      users:user_id(email)
    `)
    .eq("active", true);

  if (error || !subs) {
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }

  const payloads: AlertPayload[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const sub of subs) {
    const loc = (sub as Record<string, unknown>).locations as { name: string; latitude: number; longitude: number; altitude: number } | null;
    if (!loc) continue;

    try {
      const passData = await getPasses(
        sub.satellite_norad_id,
        loc.latitude,
        loc.longitude,
        loc.altitude,
        1, // look ahead 1 day
        sub.min_elevation
      );

      for (const pass of passData.passes ?? []) {
        const minutesUntilPass = (pass.startUTC - now) / 60;

        // Only alert for passes starting within the notification window
        if (minutesUntilPass > 0 && minutesUntilPass <= sub.notify_minutes_before) {
          // Check if we already sent an alert for this pass
          const { data: existing } = await supabase
            .from("sent_alerts")
            .select("id")
            .eq("subscription_id", sub.id)
            .eq("pass_start_utc", pass.startUTC)
            .single();

          if (existing) continue; // Already sent

          // Mark as sent
          await supabase.from("sent_alerts").insert({
            subscription_id: sub.id,
            satellite_norad_id: sub.satellite_norad_id,
            pass_start_utc: pass.startUTC,
          });

          payloads.push({
            toEmail: sub.email,
            toName: sub.email.split("@")[0],
            satelliteName: `NORAD ${sub.satellite_norad_id}`,
            locationName: loc.name,
            pass,
          });
        }
      }
    } catch {
      // Skip failed satellites, continue processing others
    }
  }

  if (payloads.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: "No pending alerts" });
  }

  const result = await sendBatchAlerts(payloads);
  return NextResponse.json({ ...result, total: payloads.length });
}

// GET for health / status check
export async function GET() {
  return NextResponse.json({ status: "Alert pipeline ready" });
}
