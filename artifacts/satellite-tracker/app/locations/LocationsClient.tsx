"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Location } from "@/lib/types";
import { MapPin, Plus, Trash2, Star, Search, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  initialLocations: Location[];
  userId: string;
}

export default function LocationsClient({ initialLocations, userId }: Props) {
  const [locations, setLocations] = useState(initialLocations);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; latitude: number; longitude: number; country: string; admin1?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", altitude: "0" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function searchLocation() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data.results ?? []);
    setSearching(false);
  }

  function selectResult(r: { name: string; latitude: number; longitude: number; country: string; admin1?: string }) {
    setForm({
      name: r.admin1 ? `${r.name}, ${r.admin1}` : `${r.name}, ${r.country}`,
      latitude: r.latitude.toString(),
      longitude: r.longitude.toString(),
      altitude: "0",
    });
    setSearchResults([]);
    setSearchQuery("");
  }

  async function useMyLocation() {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setForm({
        name: `My Location (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
        latitude: pos.coords.latitude.toString(),
        longitude: pos.coords.longitude.toString(),
        altitude: Math.round((pos.coords.altitude ?? 0)).toString(),
      });
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const isDefault = locations.length === 0;
    const { data, error: err } = await supabase
      .from("locations")
      .insert({
        user_id: userId,
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        altitude: parseInt(form.altitude),
        is_default: isDefault,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
    } else {
      setLocations([...locations, data]);
      setForm({ name: "", latitude: "", longitude: "", altitude: "0" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function setDefault(id: string) {
    await supabase.from("locations").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("locations").update({ is_default: true }).eq("id", id);
    setLocations(locations.map((l) => ({ ...l, is_default: l.id === id })));
  }

  async function deleteLocation(id: string) {
    await supabase.from("locations").delete().eq("id", id);
    setLocations(locations.filter((l) => l.id !== id));
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Locations</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your observing sites (QTH)</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add location
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl bg-slate-900 border border-slate-700">
          <h2 className="font-semibold text-white mb-4">New location</h2>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-xs text-slate-400 uppercase mb-1.5">Search by city or place</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchLocation())}
                  placeholder="e.g. London, Tokyo, New York…"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
              <button
                type="button"
                onClick={searchLocation}
                disabled={searching}
                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
              >
                {searching ? "…" : "Search"}
              </button>
              <button
                type="button"
                onClick={useMyLocation}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
                title="Use browser location"
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>

            {searchResults.length > 0 && (
              <ul className="mt-2 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                {searchResults.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => selectResult(r)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      {r.name}{r.admin1 ? `, ${r.admin1}` : ""}, {r.country}
                      <span className="ml-2 text-slate-500 text-xs">
                        {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            {error && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 uppercase mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Home QTH, Club station…"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase mb-1">Latitude</label>
                <input
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  required type="number" step="0.0001" placeholder="51.5074"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase mb-1">Longitude</label>
                <input
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  required type="number" step="0.0001" placeholder="-0.1278"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase mb-1">Alt (m)</label>
                <input
                  value={form.altitude}
                  onChange={(e) => setForm({ ...form, altitude: e.target.value })}
                  type="number" placeholder="0"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {saving ? "Saving…" : "Save location"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Locations list */}
      {locations.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No locations yet. Add your first location above.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {locations.map((loc) => (
            <li
              key={loc.id}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                loc.is_default
                  ? "bg-space-950/60 border-space-700"
                  : "bg-slate-900/60 border-slate-800"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${loc.is_default ? "bg-space-800 text-space-300" : "bg-slate-800 text-slate-400"}`}>
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">{loc.name}</span>
                  {loc.is_default && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-space-800 text-space-300 border border-space-700">Default</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}° · {loc.altitude}m ASL
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!loc.is_default && (
                  <button
                    onClick={() => setDefault(loc.id)}
                    title="Set as default"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-yellow-400 hover:bg-slate-800 transition-colors"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteLocation(loc.id)}
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
