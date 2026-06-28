import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPasses, getRadioPasses } from "@/lib/n2yo";
import { sendPassDigest, isSendOk } from "@/lib/resend";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("alert_subscriptions")
    .select("*, groups(name, location_name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    satellite_norad_id,
    group_id,
    min_elevation = 10,
    pass_mode = "visible",
    days_of_week = [],
    timezone = null,
    email,
    satellite_name,
    // Per-alert look-ahead (days): how far ahead the confirmation email AND the
    // daily digest list passes.
    look_ahead_days = 3,
  } = body;

  if (!satellite_norad_id || !group_id || !email) {
    return NextResponse.json({ error: "satellite_norad_id, group_id, and email required" }, { status: 400 });
  }

  const mode = pass_mode === "all" ? "all" : "visible";
  // Keep only valid weekday indices (0=Sun … 6=Sat); empty = every day.
  const dayList = Array.isArray(days_of_week)
    ? [...new Set(days_of_week.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort((a, b) => (a as number) - (b as number))
    : [];

  const lookAhead = Number.isInteger(look_ahead_days) && look_ahead_days > 0 && look_ahead_days <= 10 ? look_ahead_days : 3;
  const baseRow = { user_id: user.id, satellite_norad_id, group_id, min_elevation, pass_mode: mode, days_of_week: dayList, timezone, email };
  const select = "*, groups(name, location_name, latitude, longitude, altitude)";

  let { data, error } = await supabase
    .from("alert_subscriptions")
    .insert({ ...baseRow, look_ahead_days: lookAhead })
    .select(select)
    .single();

  // Graceful fallback: if the look_ahead_days column hasn't been added to the
  // live DB yet, retry without it so alert creation still works.
  if (error && (error.code === "PGRST204" || /look_ahead_days/.test(error.message))) {
    console.warn("[alerts] look_ahead_days column missing — run the migration; inserting without it.");
    ({ data, error } = await supabase.from("alert_subscriptions").insert(baseRow).select(select).single());
  }

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already subscribed for this satellite in this group" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire an immediate confirmation digest with the current filter results. Email
  // failure must not fail subscription creation, so it's best-effort + logged.
  const group = (data as Record<string, unknown>).groups as
    | { name: string; location_name: string | null; latitude: number | null; longitude: number | null; altitude: number | null }
    | null;
  if (group && group.latitude != null && group.longitude != null) {
    try {
      const fetchPasses = mode === "all" ? getRadioPasses : getPasses;
      const passData = await fetchPasses(satellite_norad_id, group.latitude, group.longitude, group.altitude ?? 0, lookAhead, min_elevation);
      const passes = passData.passes ?? [];
      if (passes.length > 0) {
        const result = await sendPassDigest({
          toEmail: email,
          satelliteName: satellite_name || `NORAD ${satellite_norad_id}`,
          locationName: group.location_name ?? group.name,
          groupName: group.name,
          passes,
          rangeLabel: `next ${lookAhead} day${lookAhead === 1 ? "" : "s"}`,
        });
        if (!isSendOk(result)) {
          console.error("[alerts] immediate digest rejected by API:", (result as { error: unknown }).error);
        }
      }
    } catch (e) {
      console.error("[alerts] immediate digest failed:", e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
