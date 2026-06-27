import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PassesClient from "./PassesClient";

export default async function PassesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: locations }, { data: satellites }, { data: alerts }] = await Promise.all([
    supabase.from("locations").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
    supabase.from("tracked_satellites").select("*").eq("user_id", user.id).order("name"),
    supabase.from("alert_subscriptions").select("*").eq("user_id", user.id),
  ]);

  return (
    <PassesClient
      locations={locations ?? []}
      satellites={satellites ?? []}
      alerts={alerts ?? []}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
