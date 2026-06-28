// Open-Meteo cloud-cover lookup (free, no API key) used to hint whether a pass
// will actually be visible from the ground. One request per location covers the
// whole look-ahead window for every satellite/pass.

const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cloudCache = new Map<string, { map: Map<number, number>; fetchedAt: number }>();

// Returns a map of UTC-hour epoch (seconds) -> cloud cover percent (0–100).
export async function getCloudCoverMap(
  lat: number,
  lng: number,
  days: number = 3
): Promise<Map<number, number>> {
  // Open-Meteo allows up to 16 forecast days; weather beyond ~7 is unreliable
  // but we still surface whatever it returns. Coerce malformed input to 3.
  const safeDays = Number.isFinite(days) ? days : 3;
  const forecastDays = Math.min(Math.max(Math.ceil(safeDays), 1), 16);
  const key = `${lat.toFixed(2)}-${lng.toFixed(2)}-${forecastDays}`;
  const cached = cloudCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.map;

  const url = `${WEATHER_BASE}?latitude=${lat}&longitude=${lng}&hourly=cloud_cover&forecast_days=${forecastDays}&timezone=UTC`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status} ${res.statusText}`);
  const data = await res.json();

  const times: string[] = data?.hourly?.time ?? [];
  const cover: number[] = data?.hourly?.cloud_cover ?? [];
  const map = new Map<number, number>();
  for (let i = 0; i < times.length; i++) {
    // Times come back as "YYYY-MM-DDTHH:00" in UTC (timezone=UTC); pin the zone.
    const ms = Date.parse(`${times[i]}Z`);
    if (!Number.isNaN(ms) && cover[i] != null) {
      map.set(Math.floor(ms / 1000), cover[i]);
    }
  }

  cloudCache.set(key, { map, fetchedAt: Date.now() });
  return map;
}

// Cloud cover percent at the hour containing the given UTC timestamp, or
// undefined if it's outside the forecast horizon.
export function cloudCoverAt(map: Map<number, number>, utcSeconds: number): number | undefined {
  const hourEpoch = Math.floor(utcSeconds / 3600) * 3600;
  return map.get(hourEpoch);
}

// Attaches `cloudCover` (% at the pass start) to each pass for the given
// location. Best-effort: on any weather failure the passes are returned
// unchanged so callers never break on weather.
export async function enrichPassesWithWeather<T extends { startUTC: number }>(
  passes: T[],
  lat: number,
  lng: number,
  days: number = 3
): Promise<(T & { cloudCover?: number })[]> {
  let map: Map<number, number>;
  try {
    map = await getCloudCoverMap(lat, lng, days);
  } catch (err) {
    console.error("[weather] cloud cover fetch failed:", err);
    return passes;
  }
  return passes.map((p) => ({ ...p, cloudCover: cloudCoverAt(map, p.startUTC) }));
}
