// The edge-cache keys of the answers every trip page asks for, shared by their API routes and by
// worker.ts, which hands back a kept answer without starting Next.js (load test, 2026-10-29).
// null: not a valid request, so the route answers it (with its error).

const SLUG = /^[a-z0-9-]{1,120}$/;
const WEATHER_AREA = { minLat: 47, maxLat: 50, minLon: 16, maxLon: 23 };
/** MET's grid is 2.5 km: places snap to ~1 km and heights to 10 m, so nearby trips share a forecast. */
const snap = (n: number) => Math.round(n * 100) / 100;

/** /api/review?slug=.. */
export function reviewKey(q: URLSearchParams): { slug: string } | null {
  const slug = q.get("slug") ?? "";
  return SLUG.test(slug) ? { slug } : null;
}

/** /api/weather?lat=..&lon=..[&alt=metres] */
export function weatherKey(q: URLSearchParams): { lat: string; lon: string; alt: string } | null {
  const lat = snap(Number(q.get("lat")));
  const lon = snap(Number(q.get("lon")));
  const alt = q.get("alt") ? Math.round(Number(q.get("alt")) / 10) * 10 : null;
  const { minLat, maxLat, minLon, maxLon } = WEATHER_AREA;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null;
  if (alt !== null && (!Number.isFinite(alt) || alt < 0 || alt > 3000)) return null;
  return { lat: lat.toFixed(2), lon: lon.toFixed(2), alt: alt === null ? "" : String(alt) };
}
