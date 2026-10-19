import { countedDetail, countEvent } from "@/lib/eventCounts";
import { fromOtherSite } from "@/lib/routeGuard";
import { isBot, localDay } from "@/lib/visitDays";

// Adds one to this month's total of a counted action (lib/eventCounts.ts).
// Called by lib/analytics.ts next to the Umami event. Without the Cloudflare
// database it does nothing. Same guards as /api/visit; anything not on the
// list is dropped, so the table can't grow beyond a few dozen rows a month.

const MAX_BODY = 200;

export async function POST(request: Request): Promise<Response> {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (isBot(userAgent) || fromOtherSite(request)) return new Response(null, { status: 204 });

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return new Response(null, { status: 204 });
    const { name, detail: sent } = JSON.parse(raw) as { name?: unknown; detail?: unknown };
    const detail = countedDetail(name, sent);
    if (detail !== null) await countEvent(localDay(new Date()).slice(0, 7), name as string, detail);
  } catch (err) {
    console.warn("[event] not counted:", err);
  }

  return new Response(null, { status: 204 });
}
