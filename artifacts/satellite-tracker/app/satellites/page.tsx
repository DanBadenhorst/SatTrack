import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SatellitesClient, { GroupWithSatellites } from "./SatellitesClient";

export default async function SatellitesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, groups(*, tracked_satellites(*))")
    .eq("user_id", user.id);

  const groups: GroupWithSatellites[] = (memberships ?? [])
    .map((m) => {
      const g = (m as { groups: unknown }).groups as GroupWithSatellites | null;
      if (!g) return null;
      return { ...g, role: (m as { role: "admin" | "member" }).role };
    })
    .filter((g): g is GroupWithSatellites => g != null);

  return <SatellitesClient groups={groups} />;
}
