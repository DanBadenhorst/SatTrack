"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix leaflet default marker
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const satIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#60a5fa;border-radius:50%;border:2px solid #93c5fd;box-shadow:0 0 8px #3b82f6;"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const observerIcon = L.divIcon({
  html: `<div style="width:10px;height:10px;background:#f59e0b;border-radius:50%;border:2px solid #fbbf24;"></div>`,
  className: "",
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

interface Props {
  noradId: number;
  lat: number;
  lng: number;
  alt: number;
}

interface Position {
  satlatitude: number;
  satlongitude: number;
  sataltitude: number;
  azimuth: number;
  elevation: number;
  timestamp: number;
  eclipsed: boolean;
}

function AutoCenter({ pos }: { pos: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(pos, map.getZoom());
  }, [pos, map]);
  return null;
}

export default function PassMap({ noradId, lat, lng, alt }: Props) {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchPosition() {
    try {
      const res = await fetch(`/api/satellite-position?norad=${noradId}&lat=${lat}&lng=${lng}&alt=${alt}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.positions?.[0]) setPosition(data.positions[0]);
    } catch {
      setError("Position unavailable");
    }
  }

  useEffect(() => {
    fetchPosition();
    intervalRef.current = setInterval(fetchPosition, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [noradId, lat, lng, alt]);

  const satPos: [number, number] = position
    ? [position.satlatitude, position.satlongitude]
    : [0, 0];

  return (
    <div className="relative h-full w-full">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-sm z-10">
          {error}
        </div>
      )}
      <MapContainer
        center={position ? satPos : [lat, lng]}
        zoom={3}
        style={{ height: "100%", width: "100%", background: "#0a0a1a" }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {/* Observer marker */}
        <Marker position={[lat, lng]} icon={observerIcon}>
          <Popup>Your location</Popup>
        </Marker>
        {/* Satellite marker */}
        {position && (
          <Marker position={satPos} icon={satIcon}>
            <Popup>
              <div className="text-xs">
                <div className="font-semibold mb-1">NORAD {noradId}</div>
                <div>Alt: {position.sataltitude.toFixed(0)} km</div>
                <div>Az: {position.azimuth.toFixed(1)}°</div>
                <div>El: {position.elevation.toFixed(1)}°</div>
                <div>{position.eclipsed ? "In shadow" : "Sunlit"}</div>
              </div>
            </Popup>
          </Marker>
        )}
        {position && <AutoCenter pos={satPos} />}
      </MapContainer>

      {position && (
        <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300">
          <div className="font-mono">Az {position.azimuth.toFixed(1)}° · El {position.elevation.toFixed(1)}°</div>
          <div className="text-slate-500">{position.sataltitude.toFixed(0)} km · {position.eclipsed ? "Eclipsed" : "Sunlit"}</div>
        </div>
      )}
    </div>
  );
}
