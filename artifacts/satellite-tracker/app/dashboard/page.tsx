import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Satellite, Users, Bell } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, role, groups(*)")
    .eq("user_id", user.id);

  const groups = (memberships ?? [])
    .map((m) => (m as { groups: unknown }).groups as {
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
      location_name: string | null;
    } | null)
    .filter((g): g is NonNullable<typeof g> => g != null);

  const groupIds = groups.map((g) => g.id);
  const groupWithLocation = groups.find((g) => g.latitude != null && g.longitude != null);

  const [{ data: satellites }, { data: alerts }] = await Promise.all([
    groupIds.length
      ? supabase.from("tracked_satellites").select("id").in("group_id", groupIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    supabase.from("alert_subscriptions").select("id").eq("user_id", user.id).eq("active", true),
  ]);

  const satCount = satellites?.length ?? 0;
  const alertCount = alerts?.length ?? 0;
  const groupCount = groups.length;

  const stats = [
    {
      label: "Groups",
      value: groupCount,
      icon: <Users className="w-5 h-5" />,
      href: "/groups",
      color: "text-green-400",
      bg: "bg-green-900/20 border-green-800",
    },
    {
      label: "Tracked Satellites",
      value: satCount,
      icon: <Satellite className="w-5 h-5" />,
      href: "/satellites",
      color: "text-purple-400",
      bg: "bg-purple-900/20 border-purple-800",
    },
    {
      label: "Active Alerts",
      value: alertCount,
      icon: <Bell className="w-5 h-5" />,
      href: "/passes",
      color: "text-orange-400",
      bg: "bg-orange-900/20 border-orange-800",
    },
  ];

  const checklist = [
    { done: groupWithLocation != null, label: "Add or join a group with tracking location", href: "/groups", page: "Groups" },
    { done: satCount > 0, label: "Track some satellites", href: "/satellites", page: "Satellites" },
    { done: alertCount > 0, label: "Set up pass alerts", href: "/passes", page: "Passes" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome back, {user.email?.split("@")[0]}.
          {groupWithLocation
            ? ` Tracking from ${groupWithLocation.location_name ?? groupWithLocation.name}.`
            : " Create or join a group with a tracking location to start."}
        </p>
      </div>

      {/* Stats + setup checklist */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 items-start">
        {/* Setup checklist */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
          <h2 className="font-semibold text-white mb-4">Setup checklist</h2>
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    item.done
                      ? "bg-green-500 border-green-500"
                      : "border-slate-600"
                  }`}
                >
                  {item.done && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {item.done ? (
                  <span className="text-sm text-slate-500 line-through">
                    {item.label} <span className="text-slate-600">[{item.page}]</span>
                  </span>
                ) : (
                  <Link href={item.href} className="text-sm text-slate-300 hover:text-white">
                    {item.label} <span className="text-slate-500">[{item.page}]</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-xl border p-5 ${s.bg} hover:brightness-110 transition-all`}
          >
            <div className={`${s.color} mb-3`}>{s.icon}</div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
