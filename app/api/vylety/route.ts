import { withEdgeCache } from "@/lib/edgeCache";
import { listTrips } from "@/lib/tripDb";
import { getTowns } from "@/lib/trips";

/**
 * GET /api/vylety?z=<town>&den=YYYY-MM-DD&limit=N -> { trips, zdroj, generated_at }
 *
 * The trip list from the database (static files when it is not loaded):
 * with a start town (an id from data/towns.json, e.g. "zilina") nearest
 * first by drive there and back plus the walk, else best known first. `closed`
 * marks trips a closure rule covers on `den` (default today).
 */

const MAX_LIMIT = 500;
const HOUR_S = 3600;

function todayInSlovakia(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bratislava" });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const town = params.get("z");
  const date = params.get("den") ?? todayInSlovakia();
  const limit = Number(params.get("limit") ?? MAX_LIMIT);

  if (town !== null && !getTowns().some((t) => t.id === town)) {
    return Response.json({ error: "z: neznáme mesto, napr. z=bratislava" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "den: YYYY-MM-DD" }, { status: 400 });
  if (!Number.isInteger(limit) || limit < 1) return Response.json({ error: "limit: kladné celé číslo" }, { status: 400 });

  // Each answer reads up to 500 database rows: Cloudflare keeps it an hour.
  const capped = Math.min(limit, MAX_LIMIT);
  return withEdgeCache(req, HOUR_S, async () => {
    const { trips, source, generated_at } = await listTrips({ town, date, limit: capped });
    return Response.json(
      { zdroj: source, generated_at, count: trips.length, trips },
      { headers: { "Cache-Control": `public, s-maxage=${HOUR_S}, stale-while-revalidate=${HOUR_S}`, "X-Zdroj": source } }
    );
  }, { z: town ?? "", den: date, limit: String(capped) });
}
