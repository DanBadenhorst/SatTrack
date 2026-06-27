import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  // Discovery: list every group (bypassing RLS) so users can find and join any
  // group. Member counts come along for display on the map and list.
  const service = createServiceClient();
  const { data: discover } = await service
    .from("groups")
    .select("id, name, description, location_name, latitude, longitude, altitude, group_members(count)")
    .order("created_at", { ascending: true });

  const allGroups = (discover ?? []).map((g) => {
    const { group_members, ...rest } = g as typeof g & {
      group_members?: { count: number }[];
    };
    return { ...rest, member_count: group_members?.[0]?.count ?? 0 };
  });

  return (
    <GroupsClient
      memberships={memberships ?? []}
      allGroups={allGroups}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
