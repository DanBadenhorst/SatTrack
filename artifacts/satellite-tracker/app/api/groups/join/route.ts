import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invite_code } = await request.json();
  if (!invite_code) return NextResponse.json({ error: "invite_code required" }, { status: 400 });

  // Find group by invite code
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name")
    .eq("invite_code", invite_code)
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  // Add member
  const { data, error } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "member" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already a member of this group" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...data, group }, { status: 201 });
}
