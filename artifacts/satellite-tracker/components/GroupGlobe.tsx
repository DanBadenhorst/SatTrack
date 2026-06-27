"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as satellite from "satellite.js";

export interface GlobeSatellite {
  norad_id: number;
  name: string;
  line1: string;
  line2: string;
}

interface Props {
  satellites: GlobeSatellite[];
  size?: number;
}

const EARTH_RADIUS_KM = 6371;
// Opaque blue Earth with visible land/ocean (equirectangular blue-marble).
const EARTH_TEXTURE_URL =
  "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg";

interface TrackedDot {
  satrec: satellite.SatRec;
  mesh: THREE.Mesh;
  name: string;
}

interface Tooltip {
  name: string;
  x: number;
  y: number;
}

// Screen-space radius (px) within which a dot counts as hovered. Generous so the
// tiny dots on the ~84px globe are easy to target with mouse or touch.
const HOVER_RADIUS_PX = 12;

export default function GroupGlobe({ satellites, size = 84 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);
  const dotsRef = useRef<TrackedDot[]>([]);
  const dotGeoRef = useRef<THREE.SphereGeometry | null>(null);
  const dotMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // One-time scene setup. Reads live satellites from dotsRef each frame.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.55, 3.1);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL available (e.g. headless environments) — render nothing.
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    // System group spins slowly (decorative). Earth + satellites rotate together
    // so geographic alignment with the texture is preserved.
    const system = new THREE.Group();
    scene.add(system);

    const earthGeo = new THREE.SphereGeometry(1, 48, 48);
    const fallbackMat = new THREE.MeshPhongMaterial({ color: 0x1d4ed8, shininess: 8 });
    const earth = new THREE.Mesh(earthGeo, fallbackMat);
    system.add(earth);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    let earthTexture: THREE.Texture | null = null;
    loader.load(
      EARTH_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        earthTexture = tex;
        earth.material = new THREE.MeshPhongMaterial({ map: tex, shininess: 6 });
        fallbackMat.dispose();
      },
      undefined,
      () => {
        // Keep the opaque blue fallback sphere on texture load failure.
      }
    );

    const satGroup = new THREE.Group();
    system.add(satGroup);
    satGroupRef.current = satGroup;

    const dotGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    dotGeoRef.current = dotGeo;
    dotMatRef.current = dotMat;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(5, 3, 5);
    scene.add(dir);

    // Hover/tap detection: find the visible dot nearest the pointer in screen
    // space (forgiving for tiny dots) and skip ones hidden behind the Earth.
    const worldPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    const isOccludedByEarth = (p: THREE.Vector3) => {
      // Ray from camera to the dot; the Earth is a unit sphere at the origin.
      camDir.copy(p).sub(camera.position);
      const distToDot = camDir.length();
      camDir.divideScalar(distToDot);
      const b = camera.position.dot(camDir);
      const c = camera.position.lengthSq() - 1;
      const disc = b * b - c;
      if (disc < 0) return false; // ray misses the Earth entirely
      const t = -b - Math.sqrt(disc); // nearest sphere intersection
      return t > 0 && t < distToDot - 0.02; // Earth sits in front of the dot
    };

    const pickDot = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      let best: { name: string; x: number; y: number } | null = null;
      let bestDist = HOVER_RADIUS_PX;
      for (const { mesh, name } of dotsRef.current) {
        if (!mesh.visible) continue;
        mesh.getWorldPosition(worldPos);
        if (isOccludedByEarth(worldPos)) continue;
        worldPos.project(camera);
        if (worldPos.z > 1) continue; // outside the view frustum
        const sx = (worldPos.x * 0.5 + 0.5) * rect.width;
        const sy = (-worldPos.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - px, sy - py);
        if (d < bestDist) {
          bestDist = d;
          best = { name, x: sx, y: sy };
        }
      }
      return best;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const hit = pickDot(e.clientX, e.clientY);
      setTooltip(hit);
      renderer.domElement.style.cursor = hit ? "pointer" : "default";
    };
    const handlePointerLeave = () => {
      setTooltip(null);
      renderer.domElement.style.cursor = "default";
    };
    const handlePointerDown = (e: PointerEvent) => {
      // Touch: a tap surfaces the nearest dot's name.
      if (e.pointerType === "touch") setTooltip(pickDot(e.clientX, e.clientY));
    };

    const canvas = renderer.domElement;
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("pointerdown", handlePointerDown);

    let raf = 0;
    let last = performance.now();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      system.rotation.y += dt * 0.08;

      const date = new Date();
      const gmst = satellite.gstime(date);
      for (const { satrec, mesh } of dotsRef.current) {
        try {
          const pv = satellite.propagate(satrec, date);
          const eci = pv.position;
          if (typeof eci === "boolean" || Number.isNaN(eci.x)) {
            mesh.visible = false;
            continue;
          }
          const geo = satellite.eciToGeodetic(eci, gmst);
          const lat = geo.latitude;
          const lon = geo.longitude;
          const r = 1.08 + Math.min(Math.max(geo.height, 0) / EARTH_RADIUS_KM, 0.6) * 0.5;
          mesh.position.set(
            r * Math.cos(lat) * Math.cos(lon),
            r * Math.sin(lat),
            -r * Math.cos(lat) * Math.sin(lon)
          );
          mesh.visible = true;
        } catch {
          mesh.visible = false;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      for (const { mesh } of dotsRef.current) satGroup.remove(mesh);
      dotsRef.current = [];
      earthGeo.dispose();
      fallbackMat.dispose();
      dotGeo.dispose();
      dotMat.dispose();
      earthTexture?.dispose();
      if (earth.material instanceof THREE.Material) earth.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      satGroupRef.current = null;
      dotGeoRef.current = null;
      dotMatRef.current = null;
    };
  }, [size]);

  // Rebuild satellite dots whenever the tracked set changes.
  useEffect(() => {
    const satGroup = satGroupRef.current;
    const geo = dotGeoRef.current;
    const mat = dotMatRef.current;
    if (!satGroup || !geo || !mat) return;

    for (const { mesh } of dotsRef.current) satGroup.remove(mesh);

    const next: TrackedDot[] = [];
    for (const s of satellites) {
      try {
        const satrec = satellite.twoline2satrec(s.line1, s.line2);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        satGroup.add(mesh);
        next.push({ satrec, mesh, name: s.name });
      } catch {
        // Skip satellites with malformed TLE data.
      }
    }
    dotsRef.current = next;

    return () => {
      for (const { mesh } of next) satGroup.remove(mesh);
    };
  }, [satellites]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div ref={mountRef} style={{ width: size, height: size }} aria-hidden="true" />
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
          className="rounded-md bg-slate-950/90 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-space-200 shadow-lg"
        >
          {tooltip.name}
        </div>
      )}
    </div>
  );
}
