import type { DriveRoute } from "@/lib/drive";
import { haversineM } from "@/lib/geo";

/**
 * GET /api/walk?from=lat,lon&to=lat,lon -> DriveRoute (on foot)
 *
 * The short walk from a parking spot (or where the car stops) to the trail
 * start. OpenRouteService foot-hiking when ORS_API_KEY is set; without a key,
 * the FOSSGIS foot router (development only). Both ends are public places,
 * never the visitor's home. The client draws a straight line if this fails.
 */

const AREA = { minLat: 47, maxLat: 50, minLon: 16, maxLon: 23 };
/** Parking spots sit within ~1 km of the start; anything longer isn't a "walk to the trail". */
const MAX_M = 5000;
const DAY_S = 86400;

function parsePoint(raw: string | null): [number, number] | null {
  if (!raw) return null;
  const [lat, lon] = raw.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < AREA.minLat || lat > AREA.maxLat || lon < AREA.minLon || lon > AREA.maxLon) return null;
  return [lat, lon];
}

/** GeoJSON [lon, lat] -> our [lat, lon]. */
const flip = (coords: [number, number][]): [number, number][] => coords.map(([lon, lat]) => [lat, lon]);

async function viaOrs(key: string, from: [number, number], to: [number, number]): Promise<DriveRoute> {
  const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-hiking/geojson", {
    method: "POST",
    headers: { Authorization: key, Accept: "application/geo+json", "Content-Type": "application/json" },
    body: JSON.stringify({
      coordinates: [
        [from[1], from[0]],
        [to[1], to[0]],
      ],
      radiuses: [500, 500],
    }),
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const f = (await res.json()).features?.[0];
  if (!f) throw new Error("ORS: no route");
  return {
    durationMin: Math.round(f.properties.summary.duration / 60),
    distanceM: Math.round(f.properties.summary.distance),
    points: flip(f.geometry.coordinates),
  };
}

async function viaFossgis(from: [number, number], to: [number, number]): Promise<DriveRoute> {
  const url =
    "https://routing.openstreetmap.de/routed-foot/route/v1/driving/" +
    `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url, { next: { revalidate: DAY_S } });
  if (!res.ok) throw new Error(`FOSSGIS ${res.status}`);
  const data = await res.json();
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) throw new Error(`FOSSGIS: ${data.code}`);
  return {
    durationMin: Math.round(r.duration / 60),
    distanceM: Math.round(r.distance),
    points: flip(r.geometry.coordinates),
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const from = parsePoint(params.get("from"));
  const to = parsePoint(params.get("to"));
  if (!from || !to) {
    return Response.json({ error: "from/to must be lat,lon in Slovakia" }, { status: 400 });
  }
  if (haversineM({ lat: from[0], lon: from[1] }, { lat: to[0], lon: to[1] }) > MAX_M) {
    return Response.json({ error: "too far for a walk to the trail" }, { status: 400 });
  }

  try {
    const key = process.env.ORS_API_KEY;
    const route = key ? await viaOrs(key, from, to) : await viaFossgis(from, to);
    return Response.json(route, {
      headers: { "Cache-Control": `public, s-maxage=${DAY_S}, stale-while-revalidate=${DAY_S}` },
    });
  } catch (err) {
    console.error("walk route failed", err);
    return Response.json({ error: "Cestu pešo sa nepodarilo vypočítať." }, { status: 502 });
  }
}
