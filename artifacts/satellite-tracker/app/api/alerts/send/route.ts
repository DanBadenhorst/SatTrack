import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPasses } from "@/lib/n2yo";
import { sendPassAlert } from "@/lib/resend";

// Manual "send test alert" endpoint for a specific subscription
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription_id } = await request.json();

  const { data: sub } = await supabase
    .from("alert_subscriptions")
    .select("*, locations(name, latitude, longitude, altitude)")
    .eq("id", subscription_id)
    .eq("user_id", user.id)
    .single();

  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

  const loc = (sub as Record<string, unknown>).locations as { name: string; latitude: number; longitude: number; altitude: number };

  const passData = await getPasses(
    sub.satellite_norad_id, loc.latitude, loc.longitude, loc.altitude, 3, sub.min_elevation
  );

  const nextPass = passData.passes?.[0];
  if (!nextPass) return NextResponse.json({ error: "No upcoming passes found" }, { status: 404 });

  await sendPassAlert({
    toEmail: user.email!,
    toName: user.email!.split("@")[0],
    satelliteName: `NORAD ${sub.satellite_norad_id}`,
    locationName: loc.name,
    pass: nextPass,
  });

  return NextResponse.json({ success: true });
}
