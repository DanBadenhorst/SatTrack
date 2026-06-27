const N2YO_BASE = "https://api.n2yo.com/rest/v1/satellite";
const API_KEY = process.env.N2YO_API_KEY!;

export interface Pass {
  startAz: number;
  startAzCompass: string;
  startEl: number;
  startUTC: number;
  maxAz: number;
  maxAzCompass: string;
  maxEl: number;
  maxUTC: number;
  endAz: number;
  endAzCompass: string;
  endEl: number;
  endUTC: number;
  mag: number;
  duration: number;
}

export interface PassesResponse {
  info: {
    satid: number;
    satname: string;
    transactionscount: number;
    passescount: number;
  };
  passes: Pass[];
}

export interface SatPosition {
  satlatitude: number;
  satlongitude: number;
  sataltitude: number;
  azimuth: number;
  elevation: number;
  ra: number;
  dec: number;
  timestamp: number;
  eclipsed: boolean;
}

export interface PositionsResponse {
  info: { satid: number; satname: string; transactionscount: number };
  positions: SatPosition[];
}

export interface TLEResponse {
  info: { satid: number; satname: string; transactionscount: number };
  tle: string;
}

const passCache = new Map<string, { data: PassesResponse; fetchedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function getPasses(
  noradId: number,
  lat: number,
  lng: number,
  alt: number = 0,
  days: number = 3,
  minElevation: number = 10
): Promise<PassesResponse> {
  // NOTE: the 6th param of N2YO's /visualpasses endpoint is "min visibility in
  // seconds", NOT minimum elevation. We fetch the full visible set (min
  // visibility 1s) and filter by peak elevation ourselves below. Caching the
  // raw set independently of minElevation lets the elevation slider re-filter
  // without spending extra N2YO transactions.
  const cacheKey = `${noradId}-${lat.toFixed(3)}-${lng.toFixed(3)}-${days}`;
  const cached = passCache.get(cacheKey);
  let data: PassesResponse;

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    data = cached.data;
  } else {
    const url = `${N2YO_BASE}/visualpasses/${noradId}/${lat}/${lng}/${alt}/${days}/1/&apiKey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) {
      throw new Error(`N2YO API error: ${res.status} ${res.statusText}`);
    }
    data = await res.json();
    passCache.set(cacheKey, { data, fetchedAt: Date.now() });
  }

  const passes = (data.passes ?? []).filter((p) => p.maxEl >= minElevation);
  return {
    ...data,
    info: { ...data.info, passescount: passes.length },
    passes,
  };
}

export async function getRadioPasses(
  noradId: number,
  lat: number,
  lng: number,
  alt: number = 0,
  days: number = 3,
  minElevation: number = 10
): Promise<PassesResponse> {
  const cacheKey = `radio-${noradId}-${lat.toFixed(3)}-${lng.toFixed(3)}-${days}-${minElevation}`;
  const cached = passCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${N2YO_BASE}/radiopasses/${noradId}/${lat}/${lng}/${alt}/${days}/${minElevation}/&apiKey=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) {
    throw new Error(`N2YO API error: ${res.status} ${res.statusText}`);
  }

  const data: PassesResponse = await res.json();
  passCache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

export async function getSatellitePositions(
  noradId: number,
  lat: number,
  lng: number,
  alt: number = 0,
  seconds: number = 1
): Promise<PositionsResponse> {
  const url = `${N2YO_BASE}/positions/${noradId}/${lat}/${lng}/${alt}/${seconds}/&apiKey=${API_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`N2YO API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getTLE(noradId: number): Promise<TLEResponse> {
  const url = `${N2YO_BASE}/tle/${noradId}/&apiKey=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`N2YO API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function searchSatellites(
  searchTerm: string,
  categoryId: number = 0
) {
  const url = `${N2YO_BASE}/above/0/0/0/90/${categoryId}/&apiKey=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return { above: [] };
  const data = await res.json();
  const term = searchTerm.toLowerCase();
  return {
    above: (data.above ?? []).filter((s: { satname: string }) =>
      s.satname.toLowerCase().includes(term)
    ),
  };
}

export function formatPassTime(utcSeconds: number): string {
  return new Date(utcSeconds * 1000).toLocaleString();
}

export function isGoodPass(pass: Pass, minElevation: number = 30): boolean {
  return pass.maxEl >= minElevation;
}
