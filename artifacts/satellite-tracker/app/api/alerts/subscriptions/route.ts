import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { satellite_norad_id, group_id, min_elevation = 10, pass_mode = "visible", notify_minutes_before = 15, days_of_week = [], timezone = null, email } = body;

  if (!satellite_norad_id || !group_id || !email) {
    return NextResponse.json({ error: "satellite_norad_id, group_id, and email required" }, { status: 400 });
  }

  const mode = pass_mode === "all" ? "all" : "visible";
  // Keep only valid weekday indices (0=Sun … 6=Sat); empty = every day.
  const days = Array.isArray(days_of_week)
    ? [...new Set(days_of_week.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort((a, b) => (a as number) - (b as number))
    : [];

  const { data, error } = await supabase
    .from("alert_subscriptions")
    .insert({ user_id: user.id, satellite_norad_id, group_id, min_elevation, pass_mode: mode, notify_minutes_before, days_of_week: days, timezone, email })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already subscribed for this satellite in this group" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
