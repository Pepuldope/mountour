import { withEdgeCache } from "@/lib/edgeCache";
import { OTHER_SITE, fromOtherSite, overRouteLimit } from "@/lib/routeGuard";
import { RateLimited, driveMatrix } from "@/lib/routing";
import { getDriveTargets } from "@/lib/tripFiles";

/**
 * GET /api/drives?from=lat,lon -> { minutes: { [slug]: number | null } }
 *
 * The drive from one start to every trip on the home list, in one router call (lib/routing.ts
 * driveMatrix), for starts away from the towns with weekly tables, where the list could only
 * estimate (Peter, 2026-10-23: "a shame we can't have the precise times"). The start is rounded to
 * ~1 km, so neighbours share one answer and the 500 calls a day go far; Cloudflare keeps it a week.
 * Without the router key (local dev) it answers 503 and the list keeps its estimates.
 */

const AREA = { minLat: 45, maxLat: 52, minLon: 12, maxLon: 25 };
const WEEK_S = 7 * 86400;
/** ~1 km: a drive time doesn't change within it, and it says less about where someone lives than the ~100 m elsewhere. */
const round = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: Request) {
  if (fromOtherSite(req)) return OTHER_SITE();
  const [lat, lon] = (new URL(req.url).searchParams.get("from") ?? "").split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < AREA.minLat || lat > AREA.maxLat || lon < AREA.minLon || lon > AREA.maxLon) {
    return Response.json({ error: "from must be lat,lon in or near Slovakia" }, { status: 400 });
  }
  const from: [number, number] = [round(lat), round(lon)];
  return withEdgeCache(
    req,
    WEEK_S,
    async () => {
      const key = process.env.ORS_API_KEY;
      if (!key) return Response.json({ error: "no router" }, { status: 503 });
      const limited = await overRouteLimit(req);
      if (limited) return limited;
      try {
        const { slugs, points } = await getDriveTargets();
        const mins = await driveMatrix(key, from, points);
        const minutes = Object.fromEntries(slugs.map((s, i) => [s, mins[i]]));
        return Response.json({ from, minutes }, { headers: { "Cache-Control": `public, s-maxage=${WEEK_S}` } });
      } catch (err) {
        console.error("drive matrix failed", err);
        return Response.json({ error: "busy" }, { status: err instanceof RateLimited ? 503 : 502 });
      }
    },
    { from: from.join(",") }
  );
}
