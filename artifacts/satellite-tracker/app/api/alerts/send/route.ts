import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPasses, getRadioPasses } from "@/lib/n2yo";
import { sendPassAlert } from "@/lib/resend";

// Manual "send test alert" endpoint for a specific subscription
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription_id } = await request.json();

  const { data: sub } = await supabase
    .from("alert_subscriptions")
    .select("*, groups(name, location_name, latitude, longitude, altitude)")
    .eq("id", subscription_id)
    .eq("user_id", user.id)
    .single();

  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

  const group = (sub as Record<string, unknown>).groups as { name: string; location_name: string | null; latitude: number | null; longitude: number | null; altitude: number | null } | null;
  if (!group || group.latitude == null || group.longitude == null) {
    return NextResponse.json({ error: "Group has no observing location set" }, { status: 400 });
  }

  const fetchPasses = sub.pass_mode === "all" ? getRadioPasses : getPasses;
  const passData = await fetchPasses(
    sub.satellite_norad_id, group.latitude, group.longitude, group.altitude ?? 0, 3, sub.min_elevation
  );

  const nextPass = passData.passes?.[0];
  if (!nextPass) return NextResponse.json({ error: "No upcoming passes found" }, { status: 404 });

  await sendPassAlert({
    toEmail: user.email!,
    toName: user.email!.split("@")[0],
    satelliteName: `NORAD ${sub.satellite_norad_id}`,
    locationName: group.location_name ?? group.name,
    pass: nextPass,
  });

  return NextResponse.json({ success: true });
}
