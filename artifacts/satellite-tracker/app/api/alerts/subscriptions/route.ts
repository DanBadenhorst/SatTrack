import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("alert_subscriptions")
    .select("*, locations(name)")
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
  const { satellite_norad_id, location_id, min_elevation = 10, notify_minutes_before = 15, email } = body;

  if (!satellite_norad_id || !location_id || !email) {
    return NextResponse.json({ error: "satellite_norad_id, location_id, and email required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("alert_subscriptions")
    .insert({ user_id: user.id, satellite_norad_id, location_id, min_elevation, notify_minutes_before, email })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already subscribed for this satellite/location" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
