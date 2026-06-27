import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Satellite, Radio, Bell, Users, MapPin, Zap } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative overflow-hidden">
      {/* Star field background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.7 + 0.1,
            }}
          />
        ))}
      </div>

      {/* Hero */}
      <section className="relative px-6 pt-24 pb-20 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-space-700 bg-space-950/60 text-space-300 text-sm mb-8">
          <Zap className="w-3.5 h-3.5" />
          <span>Live satellite tracking for radio operators &amp; spotters</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
          Never miss a pass again.
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          SatTrack tells you exactly when satellites are overhead, groups your team around the best passes, and alerts you before the window opens.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/login"
            className="px-8 py-3.5 rounded-xl bg-space-500 hover:bg-space-600 text-white font-semibold transition-colors text-lg shadow-lg shadow-space-900/50"
          >
            Get started free
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold transition-colors text-lg"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative px-6 py-20 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Satellite className="w-6 h-6" />,
              title: "Live Pass Predictions",
              desc: "Real-time pass predictions powered by N2YO for any satellite from your saved locations. See azimuth, elevation, and visibility windows.",
            },
            {
              icon: <Users className="w-6 h-6" />,
              title: "Group Coordination",
              desc: "Create groups, share locations, and coordinate around the best passes. Everyone sees the same pass window — no more missed contacts.",
            },
            {
              icon: <Bell className="w-6 h-6" />,
              title: "Smart Alerts",
              desc: "Get email notifications before a pass starts. Alerts are batched and de-duplicated so you never get spammed when a satellite is popular.",
            },
            {
              icon: <MapPin className="w-6 h-6" />,
              title: "Multiple Locations",
              desc: "Save your home QTH, portable sites, and club locations. Switch between them instantly to see passes from anywhere.",
            },
            {
              icon: <Radio className="w-6 h-6" />,
              title: "Radio Operator Focus",
              desc: "Built for amateur radio operators. Minimum elevation thresholds, Doppler shift awareness, and contact window calculations.",
            },
            {
              icon: <Zap className="w-6 h-6" />,
              title: "Cached & Fast",
              desc: "Pass data is intelligently cached to stay within API limits. Results are shared across users at the same location for speed.",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-space-900 border border-space-700 flex items-center justify-center text-space-400 mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto p-10 rounded-3xl bg-gradient-to-b from-space-950 to-slate-900 border border-space-800">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to track?</h2>
          <p className="text-slate-400 mb-8">
            Create your account in seconds. No credit card required.
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-10 py-4 rounded-xl bg-space-500 hover:bg-space-600 text-white font-semibold text-lg transition-colors"
          >
            Create free account
          </Link>
        </div>
      </section>
    </div>
  );
}
