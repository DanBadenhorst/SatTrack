import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupId = request.nextUrl.searchParams.get("group_id");

  let query = supabase
    .from("tracked_satellites")
    .select("*")
    .order("created_at", { ascending: false });

  if (groupId) query = query.eq("group_id", groupId);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { group_id, norad_id, name, category, notes } = body;

  if (!group_id || !norad_id || !name) {
    return NextResponse.json({ error: "group_id, norad_id and name required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tracked_satellites")
    .insert({ group_id, norad_id, name, category, notes })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This group is already tracking this satellite" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
