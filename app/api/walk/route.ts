import { haversineM } from "@/lib/geo";
import { withEdgeCache } from "@/lib/edgeCache";
import { OTHER_SITE, fromOtherSite, overRouteLimit } from "@/lib/routeGuard";
import { RateLimited, walkRoute } from "@/lib/routing";

/**
 * GET /api/walk?from=lat,lon&to=lat,lon -> DriveRoute (on foot)
 *
 * The short walk from a parking spot (or where the car stops) to the trail
 * start. OpenRouteService on foot when ORS_API_KEY is set (hiking paths, else
 * plain walking); without a key, the FOSSGIS foot router (development only). Both ends are public places,
 * never the visitor's home. The client draws a straight line if this fails.
 */

const AREA = { minLat: 47, maxLat: 50, minLon: 16, maxLon: 23 };
/** Parking spots sit within ~1 km of the start; anything longer isn't a "walk to the trail". */
const MAX_M = 5000;
const DAY_S = 86400;
/** The router counts per minute: a few seconds' wait usually gets through. */
const RETRY_S = 8;
/** A parking lot's middle can sit well inside a big lot, away from any path. */
const SNAP_M = 1000;

function parsePoint(raw: string | null): [number, number] | null {
  if (!raw) return null;
  const [lat, lon] = raw.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < AREA.minLat || lat > AREA.maxLat || lon < AREA.minLon || lon > AREA.maxLon) return null;
  // ~1 m: the same place always gives the same cache key.
  return [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5];
}

export async function GET(req: Request) {
  if (fromOtherSite(req)) return OTHER_SITE();
  const params = new URL(req.url).searchParams;
  const from = parsePoint(params.get("from"));
  const to = parsePoint(params.get("to"));
  if (!from || !to) {
    return Response.json({ error: "from/to must be lat,lon in Slovakia" }, { status: 400 });
  }
  if (haversineM({ lat: from[0], lon: from[1] }, { lat: to[0], lon: to[1] }) > MAX_M) {
    return Response.json({ error: "too far for a walk to the trail" }, { status: 400 });
  }

  // Same places, same answer for everyone: Cloudflare keeps it a day, the router is asked once.
  // Keyed on the rounded places, so extra query parameters can't skip the cache.
  const cacheKey = { from: from.join(","), to: to.join(",") };
  return withEdgeCache(req, DAY_S, async () => {
    // A new route spends router quota: only so many a minute per visitor.
    const limited = await overRouteLimit(req);
    if (limited) return limited;
    try {
      const key = process.env.ORS_API_KEY;
      const route = await walkRoute(key, from, to, SNAP_M);
      return Response.json(route, {
        headers: { "Cache-Control": `public, s-maxage=${DAY_S}, stale-while-revalidate=${DAY_S}` },
      });
    } catch (err) {
      console.error("walk route failed", err);
      // The router's per-minute limit: say when to ask again (the page waits and retries once).
      if (err instanceof RateLimited) {
        return Response.json({ error: "Cestu pešo sa nepodarilo vypočítať." }, { status: 503, headers: { "Retry-After": String(RETRY_S) } });
      }
      return Response.json({ error: "Cestu pešo sa nepodarilo vypočítať." }, { status: 502 });
    }
  }, cacheKey);
}
