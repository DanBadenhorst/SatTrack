"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { Users, Copy, Check, LogOut, Crown, MapPin, Search, Globe, Pencil, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MapGroup } from "@/components/GroupsJoinMap";

const GroupsJoinMap = dynamic(() => import("@/components/GroupsJoinMap"), { ssr: false });

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
}

interface GroupMembership {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  groups: GroupRow;
}

interface Props {
  memberships: GroupMembership[];
  allGroups: MapGroup[];
  userId: string;
  userEmail: string;
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

interface LocationDraft {
  location_name: string;
  latitude: string;
  longitude: string;
  altitude: string;
}

const emptyLocation: LocationDraft = { location_name: "", latitude: "", longitude: "", altitude: "0" };

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function LocationPicker({
  draft,
  setDraft,
}: {
  draft: LocationDraft;
  setDraft: (d: LocationDraft) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function searchLocation() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data.results ?? []);
    setSearching(false);
  }

  function selectResult(r: GeoResult) {
    setDraft({
      location_name: r.admin1 ? `${r.name}, ${r.admin1}` : `${r.name}, ${r.country}`,
      latitude: r.latitude.toString(),
      longitude: r.longitude.toString(),
      altitude: "0",
    });
    setSearchResults([]);
    setSearchQuery("");
  }

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      setDraft({
        location_name: `My Location (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
        latitude: pos.coords.latitude.toString(),
        longitude: pos.coords.longitude.toString(),
        altitude: Math.round(pos.coords.altitude ?? 0).toString(),
      });
    });
  }

  return (
    <div className="space-y-3">
      <div>
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
          <button type="button" onClick={searchLocation} disabled={searching}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors">
            {searching ? "…" : "Search"}
          </button>
          <button type="button" onClick={useMyLocation} title="Use browser location"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors">
            <Globe className="w-4 h-4" />
          </button>
        </div>
        {searchResults.length > 0 && (
          <ul className="mt-2 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            {searchResults.map((r, i) => (
              <li key={i}>
                <button type="button" onClick={() => selectResult(r)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors">
                  {r.name}{r.admin1 ? `, ${r.admin1}` : ""}, {r.country}
                  <span className="ml-2 text-slate-500 text-xs">{r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label className="block text-xs text-slate-400 uppercase mb-1">Location name</label>
        <input
          value={draft.location_name}
          onChange={(e) => setDraft({ ...draft, location_name: e.target.value })}
          required placeholder="Club station, Home QTH…"
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 uppercase mb-1">Latitude</label>
          <input value={draft.latitude} onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
            required type="number" step="0.0001" placeholder="51.5074"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 uppercase mb-1">Longitude</label>
          <input value={draft.longitude} onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
            required type="number" step="0.0001" placeholder="-0.1278"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 uppercase mb-1">Alt (m)</label>
          <input value={draft.altitude} onChange={(e) => setDraft({ ...draft, altitude: e.target.value })}
            type="number" placeholder="0"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-space-500" />
        </div>
      </div>
    </div>
  );
}

export default function GroupsClient({ memberships: initial, allGroups, userId }: Props) {
  const [memberships, setMemberships] = useState(initial);
  const [tab, setTab] = useState<"my" | "create" | "join">("my");
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [createLocation, setCreateLocation] = useState<LocationDraft>(emptyLocation);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState<LocationDraft>(emptyLocation);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createLocation.latitude || !createLocation.longitude || !createLocation.location_name) {
      setError("A tracking location is required to create a group.");
      return;
    }
    setSaving(true);
    setError(null);
    const invite_code = generateInviteCode();

    const { data: group, error: err } = await supabase
      .from("groups")
      .insert({
        name: createForm.name,
        description: createForm.description || null,
        created_by: userId,
        invite_code,
        location_name: createLocation.location_name,
        latitude: parseFloat(createLocation.latitude),
        longitude: parseFloat(createLocation.longitude),
        altitude: parseInt(createLocation.altitude || "0"),
      })
      .select()
      .single();

    if (err) { setError(err.message); setSaving(false); return; }

    const { data: member } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, role: "admin" })
      .select()
      .single();

    if (member) {
      setMemberships([...memberships, { ...member, groups: group }]);
      setCreateForm({ name: "", description: "" });
      setCreateLocation(emptyLocation);
      setTab("my");
    }
    setSaving(false);
  }

  async function joinGroup(group: MapGroup) {
    if (memberships.some(m => m.group_id === group.id)) return;
    setBusyId(group.id);
    setError(null);

    const { data: member, error: err } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, role: "member" })
      .select()
      .single();

    if (err) { setError(err.message); setBusyId(null); return; }

    if (member) {
      // Fetch the full group row so My Groups can render it consistently. If
      // that fetch fails, fall back to the discovery data we already have so
      // the UI never ends up in a stale state after a successful join.
      const { data: full } = await supabase.from("groups").select("*").eq("id", group.id).single();
      const groupRow: GroupRow = full ?? {
        id: group.id,
        name: group.name,
        description: group.description,
        invite_code: "",
        created_by: "",
        created_at: new Date().toISOString(),
        location_name: group.location_name,
        latitude: group.latitude,
        longitude: group.longitude,
        altitude: group.altitude,
      };
      setMemberships([...memberships, { ...member, groups: groupRow }]);
      router.refresh();
    }
    setBusyId(null);
  }

  async function leaveGroupById(groupId: string) {
    setBusyId(groupId);
    setError(null);
    const { error: err } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (err) { setError(err.message); setBusyId(null); return; }
    setMemberships(memberships.filter(m => m.group_id !== groupId));
    setBusyId(null);
    router.refresh();
  }

  async function leaveGroup(membershipId: string) {
    await supabase.from("group_members").delete().eq("id", membershipId);
    setMemberships(memberships.filter(m => m.id !== membershipId));
    router.refresh();
  }

  function startEditLocation(g: GroupRow) {
    setEditingId(g.id);
    setError(null);
    setEditLocation({
      location_name: g.location_name ?? "",
      latitude: g.latitude?.toString() ?? "",
      longitude: g.longitude?.toString() ?? "",
      altitude: (g.altitude ?? 0).toString(),
    });
  }

  async function saveLocation(groupId: string) {
    if (!editLocation.latitude || !editLocation.longitude || !editLocation.location_name) {
      setError("A tracking location is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const update = {
      location_name: editLocation.location_name,
      latitude: parseFloat(editLocation.latitude),
      longitude: parseFloat(editLocation.longitude),
      altitude: parseInt(editLocation.altitude || "0"),
    };
    const { error: err } = await supabase.from("groups").update(update).eq("id", groupId);
    if (err) { setError(err.message); setSaving(false); return; }
    setMemberships(memberships.map(m => m.group_id === groupId ? { ...m, groups: { ...m.groups, ...update } } : m));
    setEditingId(null);
    setSaving(false);
    router.refresh();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Groups</h1>
          <p className="text-slate-400 text-sm mt-1">Each group has one observing location — track satellites together</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(["my", "create", "join"] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(null); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-space-700 text-space-200" : "text-slate-400 hover:text-slate-200"}`}
          >
            {t === "my" ? "My Groups" : t === "create" ? "Create" : "Join"}
          </button>
        ))}
      </div>

      {tab === "my" && (
        <div>
          {memberships.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="mb-4">No groups yet.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setTab("create")} className="px-4 py-2 rounded-lg bg-space-700 hover:bg-space-600 text-white text-sm font-medium transition-colors">
                  Create a group
                </button>
                <button onClick={() => setTab("join")} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
                  Join a group
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {memberships.map(m => (
                <div key={m.id} className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{m.groups.name}</h3>
                        {m.role === "admin" && (
                          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-900/30 border border-yellow-800 text-yellow-400">
                            <Crown className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </div>
                      {m.groups.description && (
                        <p className="text-sm text-slate-400 mt-0.5">{m.groups.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => leaveGroup(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Leave
                    </button>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                    <MapPin className="w-4 h-4 text-space-400 flex-shrink-0" />
                    {m.groups.latitude != null && m.groups.longitude != null ? (
                      <div className="min-w-0">
                        <span className="text-sm text-slate-200">{m.groups.location_name ?? "Observing site"}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {m.groups.latitude.toFixed(4)}°, {m.groups.longitude.toFixed(4)}° · {m.groups.altitude ?? 0}m
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-orange-400">No tracking location set</span>
                    )}
                    {m.role === "admin" && editingId !== m.groups.id && (
                      <button
                        onClick={() => startEditLocation(m.groups)}
                        className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                  </div>

                  {/* Edit location form */}
                  {editingId === m.groups.id && (
                    <div className="mt-3 p-4 rounded-lg bg-slate-950 border border-slate-800">
                      {error && <div className="mb-3 p-2.5 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>}
                      <LocationPicker draft={editLocation} setDraft={setEditLocation} />
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => saveLocation(m.groups.id)} disabled={saving}
                          className="px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                          {saving ? "Saving…" : "Save location"}
                        </button>
                        <button onClick={() => { setEditingId(null); setError(null); }}
                          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Invite code */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800">
                    <span className="text-xs text-slate-500">Invite code:</span>
                    <code className="px-2.5 py-1 rounded bg-slate-800 text-space-300 text-sm font-mono tracking-widest">
                      {m.groups.invite_code}
                    </code>
                    <button
                      onClick={() => copyCode(m.groups.invite_code)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedCode === m.groups.invite_code ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode === m.groups.invite_code ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "create" && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <h2 className="font-semibold text-white mb-4">Create a group</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>}
            <div>
              <label className="block text-xs text-slate-400 uppercase mb-1.5">Group name</label>
              <input
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                required placeholder="e.g. London AMSAT Club, Friday Night Passes"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-space-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase mb-1.5">Description (optional)</label>
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="What this group is for…"
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-space-500 resize-none"
              />
            </div>
            <div className="pt-1 border-t border-slate-800">
              <p className="text-sm font-medium text-white mt-3 mb-1">Tracking location</p>
              <p className="text-xs text-slate-500 mb-3">Every member tracks satellites from this observing site.</p>
              <LocationPicker draft={createLocation} setDraft={setCreateLocation} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {saving ? "Creating…" : "Create group"}
              </button>
              <button type="button" onClick={() => { setTab("my"); setError(null); }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "join" && (
        <div className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>}

          <p className="text-sm text-slate-400">
            Tap a group on the map — the ring shows its ~100&nbsp;km coverage area, where pass details are effectively the same — then join to track satellites together.
          </p>

          {/* Map */}
          <div className="h-96 rounded-xl overflow-hidden border border-slate-800">
            <GroupsJoinMap
              groups={allGroups}
              isMember={(id) => memberships.some(m => m.group_id === id)}
              busyId={busyId}
              onJoin={joinGroup}
              onLeave={leaveGroupById}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Available to join</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> You&apos;re a member</span>
          </div>

          {/* List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">All groups</h3>
            {allGroups.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No groups exist yet. Create the first one.</div>
            ) : (
              allGroups.map(g => {
                const member = memberships.some(m => m.group_id === g.id);
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white truncate">{g.name}</h4>
                        {member && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-800 text-emerald-400">Member</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">
                          {g.location_name ?? (g.latitude != null ? `${g.latitude.toFixed(2)}°, ${g.longitude!.toFixed(2)}°` : "No location set")}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span>{g.member_count} member{g.member_count === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    {member ? (
                      <button
                        onClick={() => leaveGroupById(g.id)}
                        disabled={busyId === g.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-60 transition-colors flex-shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" /> {busyId === g.id ? "Leaving…" : "Leave"}
                      </button>
                    ) : (
                      <button
                        onClick={() => joinGroup(g)}
                        disabled={busyId === g.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-space-600 hover:bg-space-700 text-white font-medium disabled:opacity-60 transition-colors flex-shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> {busyId === g.id ? "Joining…" : "Join"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
