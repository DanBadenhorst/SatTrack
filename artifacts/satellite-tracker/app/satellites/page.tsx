import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SatellitesClient from "./SatellitesClient";

export default async function SatellitesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: satellites } = await supabase
    .from("tracked_satellites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at");

  return <SatellitesClient initialSatellites={satellites ?? []} userId={user.id} />;
}
