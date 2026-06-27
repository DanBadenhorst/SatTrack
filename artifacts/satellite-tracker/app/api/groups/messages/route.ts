import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendGroupMessageEmails, GroupMessagePayload } from "@/lib/resend";

const nameFromEmail = (email: string) => email.split("@")[0];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupId = request.nextUrl.searchParams.get("group_id");
  if (!groupId) return NextResponse.json({ error: "group_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const groupId: string | undefined = body.group_id;
  const text: string = (body.body ?? "").trim();

  if (!groupId || !text) {
    return NextResponse.json({ error: "group_id and body required" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  // RLS enforces that the user is a member of the group.
  const { data: message, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      user_id: user.id,
      author_email: user.email,
      body: text,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify other members who enabled feed email notifications.
  try {
    const admin = createServiceClient();
    const [{ data: subs }, { data: group }] = await Promise.all([
      admin
        .from("group_feed_subscriptions")
        .select("email, user_id")
        .eq("group_id", groupId)
        .eq("active", true)
        .neq("user_id", user.id),
      admin.from("groups").select("name").eq("id", groupId).single(),
    ]);

    const recipients = (subs ?? []).filter((s) => s.email);
    if (recipients.length > 0) {
      const groupName = group?.name ?? "Your group";
      const authorName = nameFromEmail(user.email ?? "A member");
      const payloads: GroupMessagePayload[] = recipients.map((s) => ({
        toEmail: s.email,
        groupName,
        authorName,
        body: text,
        postedAt: message.created_at,
      }));
      await sendGroupMessageEmails(payloads);
    }
  } catch {
    // Email failures shouldn't fail the post.
  }

  return NextResponse.json(message, { status: 201 });
}
