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
  const { satellite_norad_id, group_id, min_elevation = 10, pass_mode = "visible", notify_minutes_before = 15, email } = body;

  if (!satellite_norad_id || !group_id || !email) {
    return NextResponse.json({ error: "satellite_norad_id, group_id, and email required" }, { status: 400 });
  }

  const mode = pass_mode === "all" ? "all" : "visible";

  const { data, error } = await supabase
    .from("alert_subscriptions")
    .insert({ user_id: user.id, satellite_norad_id, group_id, min_elevation, pass_mode: mode, notify_minutes_before, email })
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
