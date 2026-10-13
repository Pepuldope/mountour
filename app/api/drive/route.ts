import { roundCoord } from "@/lib/drive";
import { driveRoute, finishDrive, simplifyLine, walkRoute } from "@/lib/routing";

/**
 * GET /api/drive?from=lat,lon&to=lat,lon -> DriveRoute
 *
 * OpenRouteService when ORS_API_KEY is set (production; key stays server-side).
 * Without a key it falls back to the public OSRM demo server, which is fine for
 * local development but has no SLA. When the road route stops short of the
 * parking, the last stretch follows tracks and minor roads (lib/routing.ts).
 */

// Slovakia plus a generous margin (Vienna, Brno, Budapest, Kraków starts).
const AREA = { minLat: 45, maxLat: 52, minLon: 12, maxLon: 25 };
/** Simplify the drawn line to within this many metres of the road (small, so bends stay on the road when zoomed in). */
const SHAPE_TOL_M = 2;
const DAY_S = 86400;
/** How far from a road a point may be and still be routed (to the nearest road). */
const SNAP_M = 3000;
/** The last stretch starts on a road and ends at the parking, both close to a way. */
const TAIL_SNAP_M = 300;

function parsePoint(raw: string | null, round: (n: number) => number): [number, number] | null {
  if (!raw) return null;
  const [lat, lon] = raw.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < AREA.minLat || lat > AREA.maxLat || lon < AREA.minLon || lon > AREA.maxLon) return null;
  return [round(lat), round(lon)];
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  // The visitor's start stays coarse (~100 m, never an exact home); the parking is a public place.
  const from = parsePoint(params.get("from"), roundCoord);
  const to = parsePoint(params.get("to"), (n) => Math.round(n * 1e5) / 1e5);
  if (!from || !to) {
    return Response.json({ error: "from/to must be lat,lon in or near Slovakia" }, { status: 400 });
  }

  try {
    const key = process.env.ORS_API_KEY;
    const road = await driveRoute(key, from, to, SNAP_M);
    const full = await finishDrive(road, to, (a, b) => walkRoute(key, a, b, TAIL_SNAP_M));
    const route = { ...full, points: simplifyLine(full.points, SHAPE_TOL_M) };
    return Response.json(route, {
      headers: { "Cache-Control": `public, s-maxage=${DAY_S}, stale-while-revalidate=${DAY_S}` },
    });
  } catch (err) {
    console.error("drive route failed", err);
    return Response.json({ error: "Trasu autom sa nepodarilo vypočítať." }, { status: 502 });
  }
}
