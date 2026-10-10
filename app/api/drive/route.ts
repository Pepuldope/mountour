import type { DriveRoute } from "@/lib/drive";
import { roundCoord } from "@/lib/drive";

/**
 * GET /api/drive?from=lat,lon&to=lat,lon -> DriveRoute
 *
 * OpenRouteService when ORS_API_KEY is set (production; key stays server-side).
 * Without a key it falls back to the public OSRM demo server, which is fine for
 * local development but has no SLA.
 */

// Slovakia plus a generous margin (Vienna, Brno, Budapest, Kraków starts).
const AREA = { minLat: 45, maxLat: 52, minLon: 12, maxLon: 25 };
const MAX_POINTS = 400;
const DAY_S = 86400;

function parsePoint(raw: string | null): [number, number] | null {
  if (!raw) return null;
  const [lat, lon] = raw.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < AREA.minLat || lat > AREA.maxLat || lon < AREA.minLon || lon > AREA.maxLon) return null;
  return [roundCoord(lat), roundCoord(lon)];
}

/** Keep every n-th point (plus the last) so long drives stay light to send and draw. */
function thin(coords: [number, number][]): [number, number][] {
  const step = Math.max(1, Math.ceil(coords.length / MAX_POINTS));
  const out = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1];
  if (last && out[out.length - 1] !== last) out.push(last);
  return out;
}

/** GeoJSON [lon, lat] -> Leaflet [lat, lon]. */
function flip(coords: [number, number][]): [number, number][] {
  return coords.map(([lon, lat]) => [lat, lon]);
}

async function viaOrs(key: string, from: [number, number], to: [number, number]): Promise<DriveRoute> {
  const url =
    "https://api.openrouteservice.org/v2/directions/driving-car" +
    `?start=${from[1]},${from[0]}&end=${to[1]},${to[0]}`;
  const res = await fetch(url, {
    headers: { Authorization: key, Accept: "application/geo+json" },
    next: { revalidate: DAY_S },
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const data = await res.json();
  const f = data.features?.[0];
  if (!f) throw new Error("ORS: no route");
  return {
    durationMin: Math.round(f.properties.summary.duration / 60),
    distanceM: Math.round(f.properties.summary.distance),
    points: thin(flip(f.geometry.coordinates)),
  };
}

async function viaOsrm(from: [number, number], to: [number, number]): Promise<DriveRoute> {
  const url =
    "https://router.project-osrm.org/route/v1/driving/" +
    `${from[1]},${from[0]};${to[1]},${to[0]}?overview=simplified&geometries=geojson`;
  const res = await fetch(url, { next: { revalidate: DAY_S } });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) throw new Error(`OSRM: ${data.code}`);
  return {
    durationMin: Math.round(r.duration / 60),
    distanceM: Math.round(r.distance),
    points: thin(flip(r.geometry.coordinates)),
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const from = parsePoint(params.get("from"));
  const to = parsePoint(params.get("to"));
  if (!from || !to) {
    return Response.json({ error: "from/to must be lat,lon in or near Slovakia" }, { status: 400 });
  }

  try {
    const key = process.env.ORS_API_KEY;
    const route = key ? await viaOrs(key, from, to) : await viaOsrm(from, to);
    return Response.json(route, {
      headers: { "Cache-Control": `public, s-maxage=${DAY_S}, stale-while-revalidate=${DAY_S}` },
    });
  } catch (err) {
    console.error("drive route failed", err);
    return Response.json({ error: "Trasu autom sa nepodarilo vypočítať." }, { status: 502 });
  }
}
