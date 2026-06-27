import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Satellite, Users, Radio, ArrowRight, Plus, Bell } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: locations }, { data: satellites }, { data: groups }, { data: alerts }] =
    await Promise.all([
      supabase.from("locations").select("*").eq("user_id", user.id),
      supabase.from("tracked_satellites").select("*").eq("user_id", user.id),
      supabase.from("group_members").select("group_id, groups(name)").eq("user_id", user.id),
      supabase.from("alert_subscriptions").select("*").eq("user_id", user.id).eq("active", true),
    ]);

  const defaultLocation = locations?.find((l) => l.is_default) ?? locations?.[0];

  const stats = [
    {
      label: "Saved Locations",
      value: locations?.length ?? 0,
      icon: <MapPin className="w-5 h-5" />,
      href: "/locations",
      color: "text-blue-400",
      bg: "bg-blue-900/20 border-blue-800",
    },
    {
      label: "Tracked Satellites",
      value: satellites?.length ?? 0,
      icon: <Satellite className="w-5 h-5" />,
      href: "/satellites",
      color: "text-purple-400",
      bg: "bg-purple-900/20 border-purple-800",
    },
    {
      label: "Groups",
      value: groups?.length ?? 0,
      icon: <Users className="w-5 h-5" />,
      href: "/groups",
      color: "text-green-400",
      bg: "bg-green-900/20 border-green-800",
    },
    {
      label: "Active Alerts",
      value: alerts?.length ?? 0,
      icon: <Bell className="w-5 h-5" />,
      href: "/passes",
      color: "text-orange-400",
      bg: "bg-orange-900/20 border-orange-800",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome back, {user.email?.split("@")[0]}.
          {defaultLocation
            ? ` Tracking from ${defaultLocation.name}.`
            : " Add a location to start tracking passes."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Get passes CTA */}
        {defaultLocation && satellites && satellites.length > 0 ? (
          <div className="rounded-xl bg-gradient-to-br from-space-950 to-slate-900 border border-space-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-space-800 flex items-center justify-center">
                <Radio className="w-5 h-5 text-space-300" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Next passes</h2>
                <p className="text-xs text-slate-400">From {defaultLocation.name}</p>
              </div>
            </div>
            <Link
              href="/passes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium transition-colors"
            >
              View upcoming passes
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 border-dashed p-6 flex flex-col gap-3">
            <p className="text-slate-400 text-sm">
              {!defaultLocation
                ? "Add a location to start seeing satellite passes."
                : "Add some satellites to track passes."}
            </p>
            <Link
              href={!defaultLocation ? "/locations" : "/satellites"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors w-fit"
            >
              <Plus className="w-4 h-4" />
              {!defaultLocation ? "Add location" : "Add satellites"}
            </Link>
          </div>
        )}

        {/* Setup checklist */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6">
          <h2 className="font-semibold text-white mb-4">Setup checklist</h2>
          <ul className="space-y-3">
            {[
              { done: (locations?.length ?? 0) > 0, label: "Add your location", href: "/locations" },
              { done: (satellites?.length ?? 0) > 0, label: "Track some satellites", href: "/satellites" },
              { done: (alerts?.length ?? 0) > 0, label: "Set up pass alerts", href: "/passes" },
              { done: (groups?.length ?? 0) > 0, label: "Join or create a group", href: "/groups" },
            ].map((item) => (
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
                  <span className="text-sm text-slate-500 line-through">{item.label}</span>
                ) : (
                  <Link href={item.href} className="text-sm text-slate-300 hover:text-white">
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
