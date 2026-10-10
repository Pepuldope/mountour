import { roundCoord } from "@/lib/drive";
import type { DriveMatrix } from "@/lib/drive";

/**
 * GET /api/drive-matrix?from=lat,lon&to=lat,lon|lat,lon|... -> DriveMatrix
 *
 * Drive time from one start to many trailheads in a single upstream call, so the
 * home list can show and sort by real drive time. Same provider rules as
 * /api/drive: OpenRouteService with ORS_API_KEY, else the OSRM demo server.
 */

const AREA = { minLat: 45, maxLat: 52, minLon: 12, maxLon: 25 };
const MAX_DESTINATIONS = 50;
const DAY_S = 86400;

function parsePoint(raw: string): [number, number] | null {
  const [lat, lon] = raw.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < AREA.minLat || lat > AREA.maxLat || lon < AREA.minLon || lon > AREA.maxLon) return null;
  return [roundCoord(lat), roundCoord(lon)];
}

const toMin = (s: number | null) => (s == null ? null : Math.round(s / 60));
const toM = (m: number | null) => (m == null ? null : Math.round(m));

async function viaOrs(key: string, from: [number, number], to: [number, number][]): Promise<DriveMatrix> {
  const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [from, ...to].map(([lat, lon]) => [lon, lat]),
      sources: [0],
      destinations: to.map((_, i) => i + 1),
      metrics: ["duration", "distance"],
    }),
    next: { revalidate: DAY_S },
  });
  if (!res.ok) throw new Error(`ORS matrix ${res.status}`);
  const data = await res.json();
  return {
    durationsMin: (data.durations?.[0] ?? []).map(toMin),
    distancesM: (data.distances?.[0] ?? []).map(toM),
  };
}

async function viaOsrm(from: [number, number], to: [number, number][]): Promise<DriveMatrix> {
  const coords = [from, ...to].map(([lat, lon]) => `${lon},${lat}`).join(";");
  const dest = to.map((_, i) => i + 1).join(";");
  const url =
    `https://router.project-osrm.org/table/v1/driving/${coords}` +
    `?sources=0&destinations=${dest}&annotations=duration,distance`;
  const res = await fetch(url, { next: { revalidate: DAY_S } });
  if (!res.ok) throw new Error(`OSRM table ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error(`OSRM table: ${data.code}`);
  return {
    durationsMin: (data.durations?.[0] ?? []).map(toMin),
    distancesM: (data.distances?.[0] ?? []).map(toM),
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const from = parsePoint(params.get("from") ?? "");
  const to = (params.get("to") ?? "").split("|").filter(Boolean).map(parsePoint);
  if (!from || to.length === 0 || to.length > MAX_DESTINATIONS || to.some((p) => p === null)) {
    return Response.json({ error: "from=lat,lon&to=lat,lon|lat,lon in or near Slovakia" }, { status: 400 });
  }

  try {
    const key = process.env.ORS_API_KEY;
    const dests = to as [number, number][];
    const matrix = key ? await viaOrs(key, from, dests) : await viaOsrm(from, dests);
    return Response.json(matrix, {
      headers: { "Cache-Control": `public, s-maxage=${DAY_S}, stale-while-revalidate=${DAY_S}` },
    });
  } catch (err) {
    console.error("drive matrix failed", err);
    return Response.json({ error: "Časy cesty autom sa nepodarilo vypočítať." }, { status: 502 });
  }
}
