"use client";

import { Fragment, useMemo } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapGroup {
  id: string;
  name: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  member_count: number;
}

// Pass details are effectively identical anywhere within this radius of the
// group's observing site, so it doubles as the group's "coverage" area.
const COVERAGE_RADIUS_M = 100_000; // 100 km

interface Props {
  groups: MapGroup[];
  isMember: (groupId: string) => boolean;
  busyId: string | null;
  onJoin: (group: MapGroup) => void;
  onLeave: (groupId: string) => void;
}

export default function GroupsJoinMap({ groups, isMember, busyId, onJoin, onLeave }: Props) {
  const located = useMemo(
    () => groups.filter((g) => g.latitude != null && g.longitude != null),
    [groups]
  );

  const center: [number, number] = useMemo(() => {
    if (located.length === 0) return [20, 0];
    const lat = located.reduce((s, g) => s + (g.latitude as number), 0) / located.length;
    const lng = located.reduce((s, g) => s + (g.longitude as number), 0) / located.length;
    return [lat, lng];
  }, [located]);

  return (
    <MapContainer
      center={center}
      zoom={located.length > 0 ? 4 : 2}
      style={{ height: "100%", width: "100%", background: "#0a0a1a" }}
      zoomControl={true}
      worldCopyJump
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      {located.map((g) => {
        const member = isMember(g.id);
        const accent = member ? "#34d399" : "#60a5fa";
        const pos: [number, number] = [g.latitude as number, g.longitude as number];
        return (
          <Fragment key={g.id}>
            {/* 100 km coverage area */}
            <Circle
              center={pos}
              radius={COVERAGE_RADIUS_M}
              pathOptions={{ color: accent, weight: 1, fillColor: accent, fillOpacity: 0.08 }}
            />
            {/* Core dot */}
            <CircleMarker
              center={pos}
              radius={6}
              pathOptions={{ color: accent, weight: 2, fillColor: accent, fillOpacity: 0.9 }}
            >
              <Popup>
                <div className="text-xs" style={{ minWidth: 160 }}>
                  <div className="font-semibold text-sm mb-0.5">{g.name}</div>
                  {g.location_name && <div className="text-slate-600">{g.location_name}</div>}
                  <div className="text-slate-500 mb-2">
                    {g.member_count} member{g.member_count === 1 ? "" : "s"}
                  </div>
                  {member ? (
                    <button
                      onClick={() => onLeave(g.id)}
                      disabled={busyId === g.id}
                      style={{ background: "#7f1d1d", color: "#fecaca" }}
                      className="w-full rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      {busyId === g.id ? "Leaving…" : "Leave group"}
                    </button>
                  ) : (
                    <button
                      onClick={() => onJoin(g)}
                      disabled={busyId === g.id}
                      style={{ background: "#2563eb", color: "#fff" }}
                      className="w-full rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      {busyId === g.id ? "Joining…" : "Join group"}
                    </button>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
