import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GroupsClient from "./GroupsClient";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: memberships } = await supabase
    .from("group_members")
    .select("*, groups(*)")
    .eq("user_id", user.id);

  return (
    <GroupsClient
      memberships={memberships ?? []}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
