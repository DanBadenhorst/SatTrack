"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrackedSatellite, AlertSubscription } from "@/lib/types";
import { MapPin, Satellite, Bell, BellOff, Users, Map } from "lucide-react";
import dynamic from "next/dynamic";

const PassMap = dynamic(() => import("@/components/PassMap"), { ssr: false });

interface Pass {
  startAz: number; startAzCompass: string; startEl: number; startUTC: number;
  maxAz: number; maxAzCompass: string; maxEl: number; maxUTC: number;
  endAz: number; endAzCompass: string; endEl: number; endUTC: number;
  mag?: number; duration?: number;
}

type PassMode = "visible" | "all";

interface PassResult {
  satellite: TrackedSatellite;
  passes: Pass[];
  error?: string;
}

export interface GroupWithSatellites {
  id: string;
  name: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  tracked_satellites: TrackedSatellite[];
}

interface Props {
  groups: GroupWithSatellites[];
  alerts: AlertSubscription[];
  userId: string;
  userEmail: string;
}

export default function PassesClient({ groups, alerts: initialAlerts, userId, userEmail }: Props) {
  const groupsWithLocation = groups.filter((g) => g.latitude != null && g.longitude != null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groupsWithLocation[0]?.id ?? null);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const satellites = selectedGroup?.tracked_satellites ?? [];

  const [selectedSatIds, setSelectedSatIds] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(3);
  const [minEl, setMinEl] = useState(10);
  const [mode, setMode] = useState<PassMode>("visible");
  const [results, setResults] = useState<PassResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [showMap, setShowMap] = useState(false);
  const [mapSat, setMapSat] = useState<TrackedSatellite | null>(null);
  const supabase = createClient();

  const selectedSatellites = satellites.filter((s) => selectedSatIds.has(s.id));

  function selectGroup(id: string) {
    setSelectedGroupId(id);
    setSelectedSatIds(new Set());
    setResults([]);
  }

  async function fetchPasses() {
    if (!selectedGroup || selectedGroup.latitude == null || selectedSatellites.length === 0) return;
    setLoading(true);
    setResults([]);
    const res = await fetch("/api/passes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: selectedGroup.latitude,
        lng: selectedGroup.longitude,
        alt: selectedGroup.altitude ?? 0,
        days,
        minElevation: minEl,
        mode,
        satellites: selectedSatellites.map((s) => ({ norad_id: s.norad_id, name: s.name })),
      }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }

  async function toggleAlert(sat: TrackedSatellite) {
    if (!selectedGroup) return;
    const existing = alerts.find(
      (a) => a.satellite_norad_id === sat.norad_id && a.group_id === selectedGroup.id
    );
    if (existing) {
      await supabase.from("alert_subscriptions").delete().eq("id", existing.id);
      setAlerts(alerts.filter((a) => a.id !== existing.id));
    } else {
      const { data } = await supabase.from("alert_subscriptions").insert({
        user_id: userId,
        satellite_norad_id: sat.norad_id,
        group_id: selectedGroup.id,
        min_elevation: minEl,
        pass_mode: mode,
        notify_minutes_before: 15,
        email: userEmail,
        active: true,
      }).select().single();
      if (data) setAlerts([...alerts, data]);
    }
  }

  function hasAlert(sat: TrackedSatellite) {
    return alerts.some(
      (a) => a.satellite_norad_id === sat.norad_id && a.group_id === selectedGroup?.id
    );
  }

  function toggleSat(id: string) {
    setSelectedSatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function formatTime(utc: number) {
    return new Date(utc * 1000).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function elColor(el: number) {
    if (el >= 60) return "text-green-400";
    if (el >= 30) return "text-yellow-400";
    return "text-orange-400";
  }

  // Lower magnitude = brighter. Returns a label + badge styling, or null if the
  // pass has no magnitude (radio passes don't report brightness).
  function brightness(mag?: number) {
    if (mag == null) return null;
    if (mag <= -3) return { label: "Brilliant", cls: "bg-purple-900/40 border-purple-600 text-purple-200" };
    if (mag <= -1) return { label: "Very bright", cls: "bg-sky-900/40 border-sky-600 text-sky-200" };
    if (mag <= 1.5) return { label: "Bright", cls: "bg-teal-900/40 border-teal-600 text-teal-200" };
    if (mag <= 3.5) return { label: "Moderate", cls: "bg-slate-800 border-slate-600 text-slate-300" };
    return { label: "Faint", cls: "bg-slate-800/60 border-slate-700 text-slate-500" };
  }

  const allPasses = results.flatMap((r) => r.passes.map((p) => ({ ...p, satName: r.satellite.name }))).sort((a, b) => a.startUTC - b.startUTC);

  if (groups.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Upcoming Passes</h1>
        <div className="text-center py-16 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-4">Passes are predicted from a group&apos;s location. Create or join a group first.</p>
          <a href="/groups" className="px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium transition-colors">
            Go to groups
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Upcoming Passes</h1>
          <p className="text-slate-400 text-sm mt-1">Select a group and satellites, then fetch predictions</p>
        </div>
      </div>

      {/* Controls */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Group select */}
          <div>
            <label className="block text-xs text-slate-400 uppercase mb-2">Group</label>
            <div className="space-y-1">
              {groups.map((g) => {
                const hasLoc = g.latitude != null && g.longitude != null;
                return (
                  <button
                    key={g.id}
                    onClick={() => selectGroup(g.id)}
                    disabled={!hasLoc}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedGroupId === g.id
                        ? "bg-space-800 border border-space-600 text-space-200"
                        : hasLoc
                        ? "bg-slate-800 border border-transparent text-slate-400 hover:text-slate-200"
                        : "bg-slate-800/50 border border-transparent text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{g.name}</span>
                    {hasLoc ? (
                      <span className="ml-auto flex items-center gap-1 text-xs text-slate-500 truncate">
                        <MapPin className="w-3 h-3" /> {g.location_name ?? "site"}
                      </span>
                    ) : (
                      <span className="ml-auto text-xs text-orange-500">no location</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 uppercase mb-2">Look-ahead</label>
              <div className="flex gap-2">
                {[1, 2, 3, 5, 7].map((d) => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${days === d ? "bg-space-700 text-space-200" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase mb-2">Min elevation: {minEl}°</label>
              <input type="range" min={5} max={60} step={5} value={minEl} onChange={(e) => setMinEl(+e.target.value)}
                className="w-full accent-space-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase mb-2">Pass type</label>
              <div className="flex gap-2">
                {([
                  { key: "visible", label: "Visible only" },
                  { key: "all", label: "All (radio)" },
                ] as { key: PassMode; label: string }[]).map((m) => (
                  <button key={m.key} onClick={() => setMode(m.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === m.key ? "bg-space-700 text-space-200" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {mode === "visible"
                  ? "Only passes visible to the naked eye (satellite sunlit, sky dark)."
                  : `All passes reaching ${minEl}°+, day or night — for radio work.`}
              </p>
            </div>
          </div>
        </div>

        {/* Satellite selection */}
        <div className="mt-5">
          <label className="block text-xs text-slate-400 uppercase mb-2">Satellites ({selectedSatIds.size} selected)</label>
          {!selectedGroup ? (
            <p className="text-slate-500 text-sm">Select a group with a tracking location first.</p>
          ) : satellites.length === 0 ? (
            <p className="text-slate-500 text-sm">No satellites in this group — <a href="/satellites" className="text-space-400">add some first</a></p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {satellites.map((sat) => (
                <button
                  key={sat.id}
                  onClick={() => toggleSat(sat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedSatIds.has(sat.id)
                      ? "bg-space-800 border border-space-600 text-space-200"
                      : "bg-slate-800 border border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Satellite className="w-3 h-3" />
                  {sat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={fetchPasses}
          disabled={loading || !selectedGroup || selectedGroup.latitude == null || selectedSatellites.length === 0}
          className="mt-5 w-full py-2.5 rounded-lg bg-space-600 hover:bg-space-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
        >
          {loading ? "Fetching passes…" : "Fetch passes"}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">
              {allPasses.length} passes found
              {selectedGroup && <span className="font-normal text-slate-400"> from {selectedGroup.location_name ?? selectedGroup.name}</span>}
            </h2>
          </div>

          {results.map((result) => (
            <div key={result.satellite.id} className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Satellite className="w-4 h-4 text-space-400" />
                <h3 className="font-semibold text-white">{result.satellite.name}</h3>
                <span className="text-xs text-slate-500">NORAD {result.satellite.norad_id}</span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => { setMapSat(result.satellite); setShowMap(true); }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <Map className="w-3.5 h-3.5" />
                    Live map
                  </button>
                  <button
                    onClick={() => toggleAlert(result.satellite)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors ${
                      hasAlert(result.satellite)
                        ? "bg-orange-900/30 border border-orange-700 text-orange-300"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {hasAlert(result.satellite) ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                    {hasAlert(result.satellite) ? "Alerts on" : "Set alert"}
                  </button>
                </div>
              </div>

              {result.error ? (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-300 text-sm">{result.error}</div>
              ) : result.passes.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-sm">No {mode === "visible" ? "visible " : ""}passes in the next {days} days with min elevation {minEl}°.</div>
              ) : (
                <div className="space-y-2">
                  {result.passes.slice(0, 10).map((pass, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-600 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-white">{formatTime(pass.startUTC)}</span>
                          {pass.duration != null && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{Math.round(pass.duration / 60)} min</span>
                          )}
                          {(() => {
                            const b = brightness(pass.mag);
                            return b ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${b.cls}`} title={`Magnitude ${pass.mag!.toFixed(1)}`}>
                                {b.label} · mag {pass.mag!.toFixed(1)}
                              </span>
                            ) : null;
                          })()}
                          {pass.maxEl >= 60 && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 border border-green-700 text-green-300">Excellent</span>}
                          {pass.maxEl >= 30 && pass.maxEl < 60 && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700 text-yellow-300">Good</span>}
                        </div>
                        <div className="flex gap-4 text-xs text-slate-400">
                          <span>AOS: {pass.startAz.toFixed(0)}° {pass.startAzCompass}</span>
                          <span>Max: {pass.maxAz.toFixed(0)}° {pass.maxAzCompass}</span>
                          <span>LOS: {pass.endAz.toFixed(0)}° {pass.endAzCompass}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${elColor(pass.maxEl)}`}>{pass.maxEl.toFixed(0)}°</div>
                        <div className="text-xs text-slate-500">max el</div>
                      </div>
                    </div>
                  ))}
                  {result.passes.length > 10 && (
                    <p className="text-center text-xs text-slate-500 py-2">
                      +{result.passes.length - 10} more passes
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Map modal */}
      {showMap && mapSat && selectedGroup && selectedGroup.latitude != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Live position — {mapSat.name}</h3>
              <button onClick={() => setShowMap(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="h-96">
              <PassMap
                noradId={mapSat.norad_id}
                lat={selectedGroup.latitude}
                lng={selectedGroup.longitude!}
                alt={selectedGroup.altitude ?? 0}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
