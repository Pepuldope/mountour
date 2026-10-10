import { roundCoord } from "@/lib/drive";
import type { TownDrives } from "@/lib/drive";
import { getDriveTimes, nearestTown } from "@/lib/trips";

/**
 * GET /api/drive-town?from=lat,lon -> TownDrives
 *
 * Car times to every trip from the precomputed town nearest to the start
 * (data/drive-times.json, routed weekly by the pipeline). No upstream API, so
 * the home list gets real road times without spending routing quota.
 */

const AREA = { minLat: 45, maxLat: 52, minLon: 12, maxLon: 25 };
const DAY_S = 86400;

export async function GET(req: Request) {
  const [lat, lon] = (new URL(req.url).searchParams.get("from") ?? "").split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < AREA.minLat || lat > AREA.maxLat || lon < AREA.minLon || lon > AREA.maxLon) {
    return Response.json({ error: "from=lat,lon in or near Slovakia" }, { status: 400 });
  }
  const table = getDriveTimes();
  const town = nearestTown({ lat: roundCoord(lat), lon: roundCoord(lon) });
  if (!town) return Response.json({ error: "Časy cesty autom nie sú k dispozícii." }, { status: 502 });
  const row = table.minutes[table.towns.indexOf(town)] ?? [];
  const body: TownDrives = {
    town: { name: town.name, lat: town.location.lat, lon: town.location.lon },
    minutes: Object.fromEntries(table.slugs.map((slug, i) => [slug, row[i] ?? null])),
  };
  return Response.json(body, {
    headers: { "Cache-Control": `public, s-maxage=${DAY_S}, stale-while-revalidate=${DAY_S}` },
  });
}
