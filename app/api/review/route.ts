import { parseReview, reviewSummary, saveReview } from "@/lib/reviews";
import { OTHER_SITE, TOO_MANY, fromOtherSite, overCallLimit } from "@/lib/routeGuard";
import { isBot } from "@/lib/visitDays";

// Quick reviews (lib/reviews.ts). POST stores one from this browser, GET gives a
// trip's totals. Same guards as the other counters: our pages only, and only so
// many writes a minute from one address (the address itself is never stored).

const MAX_BODY = 1000;
const SLUG = /^[a-z0-9-]{1,120}$/;

export async function POST(request: Request): Promise<Response> {
  if (isBot(request.headers.get("user-agent") ?? "") || fromOtherSite(request)) return OTHER_SITE();
  if (await overCallLimit(request, "review")) return TOO_MANY();
  let review = null;
  try {
    const raw = await request.text();
    if (raw.length <= MAX_BODY) review = parseReview(JSON.parse(raw));
  } catch {
    review = null;
  }
  if (!review) return Response.json({ error: "Hodnotenie sa nedá uložiť." }, { status: 400 });
  try {
    const saved = await saveReview(review, new Date());
    return Response.json({ saved });
  } catch (err) {
    console.warn("[review] not saved:", err);
    return Response.json({ error: "Hodnotenie sa teraz nepodarilo uložiť, skúste neskôr." }, { status: 503 });
  }
}

export async function GET(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!SLUG.test(slug)) return Response.json({ error: "bad slug" }, { status: 400 });
  if (await overCallLimit(request, "review")) return TOO_MANY();
  try {
    const summary = await reviewSummary(slug);
    // A few minutes old is fine: new reviews come slowly.
    return Response.json(summary ?? { n: 0 }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.warn("[review] summary failed:", err);
    return Response.json({ n: 0 });
  }
}
