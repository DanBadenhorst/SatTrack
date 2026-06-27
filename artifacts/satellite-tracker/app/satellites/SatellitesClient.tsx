"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrackedSatellite } from "@/lib/types";
import { Satellite, Plus, Trash2, Search, Radio } from "lucide-react";

const POPULAR_SATELLITES = [
  { norad_id: 25544, name: "ISS (ZARYA)", category: "Space Station" },
  { norad_id: 20580, name: "HST (Hubble)", category: "Space Telescope" },
  { norad_id: 43226, name: "NOAA 20", category: "Weather" },
  { norad_id: 28654, name: "NOAA 18", category: "Weather" },
  { norad_id: 33591, name: "NOAA 19", category: "Weather" },
  { norad_id: 27607, name: "XM-4", category: "Communication" },
  { norad_id: 39634, name: "FUNCUBE-1 (AO-73)", category: "Amateur Radio" },
  { norad_id: 43017, name: "FOX-1D (AO-92)", category: "Amateur Radio" },
  { norad_id: 40931, name: "LilacSat-2 (CAS-3H)", category: "Amateur Radio" },
  { norad_id: 42017, name: "NAYIF-1 (EO-88)", category: "Amateur Radio" },
  { norad_id: 7530, name: "OSCAR 7 (AO-7)", category: "Amateur Radio" },
  { norad_id: 14129, name: "OSCAR 10 (AO-10)", category: "Amateur Radio" },
  { norad_id: 24278, name: "IRIDIUM 4", category: "Communication" },
  { norad_id: 43013, name: "METEOR-M 2-1", category: "Weather" },
];

interface Props {
  initialSatellites: TrackedSatellite[];
  userId: string;
}

export default function SatellitesClient({ initialSatellites, userId }: Props) {
  const [satellites, setSatellites] = useState(initialSatellites);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ norad_id: "", name: "", category: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("All");
  const supabase = createClient();

  const categories = ["All", ...Array.from(new Set(satellites.map((s) => s.category ?? "Other")))];

  const filtered = satellites.filter(
    (s) => filterCat === "All" || s.category === filterCat
  );

  async function addSatellite(norad_id: number, name: string, category: string) {
    if (satellites.some((s) => s.norad_id === norad_id)) return;
    const { data, error: err } = await supabase
      .from("tracked_satellites")
      .insert({ user_id: userId, norad_id, name, category })
      .select()
      .single();
    if (!err && data) setSatellites([...satellites, data]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("tracked_satellites")
      .insert({
        user_id: userId,
        norad_id: parseInt(form.norad_id),
        name: form.name,
        category: form.category || null,
        notes: form.notes || null,
      })
      .select()
      .single();
    if (err) {
      setError(err.message);
    } else {
      setSatellites([...satellites, data]);
      setForm({ norad_id: "", name: "", category: "", notes: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function deleteSatellite(id: string) {
    await supabase.from("tracked_satellites").delete().eq("id", id);
    setSatellites(satellites.filter((s) => s.id !== id));
  }

  const trackedIds = new Set(satellites.map((s) => s.norad_id));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Satellites</h1>
          <p className="text-slate-400 text-sm mt-1">Track satellites for pass predictions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add by NORAD ID
        </button>
      </div>

      {/* Custom satellite form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl bg-slate-900 border border-slate-700">
          <h2 className="font-semibold text-white mb-4">Add satellite by NORAD ID</h2>
          <form onSubmit={handleSave} className="space-y-3">
            {error && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase mb-1">NORAD ID</label>
                <input
                  value={form.norad_id}
                  onChange={(e) => setForm({ ...form, norad_id: e.target.value })}
                  required type="number" placeholder="25544"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required placeholder="ISS (ZARYA)"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase mb-1">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Amateur Radio, Weather…"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase mb-1">Notes (optional)</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Frequency, mode…"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {saving ? "Saving…" : "Add satellite"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Popular satellites quick-add */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-slate-400 uppercase mb-3">Quick add popular satellites</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {POPULAR_SATELLITES.map((sat) => {
            const tracked = trackedIds.has(sat.norad_id);
            return (
              <button
                key={sat.norad_id}
                onClick={() => addSatellite(sat.norad_id, sat.name, sat.category)}
                disabled={tracked}
                className={`flex items-center gap-2 p-3 rounded-lg text-left text-sm transition-colors ${
                  tracked
                    ? "bg-green-900/20 border border-green-800 text-green-400 cursor-default"
                    : "bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300"
                }`}
              >
                <Radio className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{sat.name}</div>
                  <div className="text-xs text-slate-500">{sat.norad_id} · {sat.category}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* My satellites */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase">My tracked satellites ({satellites.length})</h2>
          {categories.length > 1 && (
            <div className="flex gap-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filterCat === c
                      ? "bg-space-700 text-space-200"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Satellite className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No satellites yet. Add some from the list above.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((sat) => (
              <li key={sat.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Satellite className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{sat.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    NORAD {sat.norad_id}
                    {sat.category && ` · ${sat.category}`}
                    {sat.notes && ` · ${sat.notes}`}
                  </div>
                </div>
                <button
                  onClick={() => deleteSatellite(sat.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
