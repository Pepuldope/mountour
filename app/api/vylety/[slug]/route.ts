import { withEdgeCache } from "@/lib/edgeCache";
import { getTripLive } from "@/lib/tripDb";

/**
 * GET /api/vylety/<slug> -> one trip with its walk, parking, stops and places
 * (the shape of public/data/trips/<slug>.json), from the database or the files.
 */

const HOUR_S = 3600;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  // Cloudflare keeps each answer an hour, so repeat asks read no database rows.
  return withEdgeCache(req, HOUR_S, async () => {
    const { trip, source } = await getTripLive(slug);
    if (!trip) return Response.json({ error: "Výlet sa nenašiel." }, { status: 404, headers: { "X-Zdroj": source } });
    return Response.json(
      { zdroj: source, trip },
      { headers: { "Cache-Control": `public, s-maxage=${HOUR_S}, stale-while-revalidate=${HOUR_S}`, "X-Zdroj": source } }
    );
  }, {});
}
