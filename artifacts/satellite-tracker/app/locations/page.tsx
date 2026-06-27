import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LocationsClient from "./LocationsClient";

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at");

  return <LocationsClient initialLocations={locations ?? []} userId={user.id} />;
}
