"use client";

import { useEffect, useRef } from "react";
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
}

export default function GroupGlobe({ satellites, size = 84 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);
  const dotsRef = useRef<TrackedDot[]>([]);
  const dotGeoRef = useRef<THREE.SphereGeometry | null>(null);
  const dotMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

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
        next.push({ satrec, mesh });
      } catch {
        // Skip satellites with malformed TLE data.
      }
    }
    dotsRef.current = next;

    return () => {
      for (const { mesh } of next) satGroup.remove(mesh);
    };
  }, [satellites]);

  return <div ref={mountRef} style={{ width: size, height: size }} aria-hidden="true" />;
}
