import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PassesClient, { GroupWithSatellites } from "./PassesClient";

export default async function PassesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; sat?: string }>;
}) {
  const { group, sat } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: memberships }, { data: alerts }] = await Promise.all([
    supabase
      .from("group_members")
      .select("groups(*, tracked_satellites(*))")
      .eq("user_id", user.id),
    supabase.from("alert_subscriptions").select("*").eq("user_id", user.id),
  ]);

  const groups: GroupWithSatellites[] = (memberships ?? [])
    .map((m) => (m as { groups: unknown }).groups as GroupWithSatellites | null)
    .filter((g): g is GroupWithSatellites => g != null);

  const initialNoradId = sat != null && /^\d+$/.test(sat) ? Number(sat) : null;

  return (
    <PassesClient
      groups={groups}
      alerts={alerts ?? []}
      userId={user.id}
      userEmail={user.email ?? ""}
      initialGroupId={group ?? null}
      initialNoradId={initialNoradId}
    />
  );
}
