import { getCloudflareContext } from "@opennextjs/cloudflare";

// The routing APIs spend the free OpenRouteService quota (2,000 routes a day),
// so a script asking for random places could use it up for everyone. Two cheap
// guards: other sites' pages may not call them, and one visitor may ask for
// only so many new routes a minute (Cloudflare's free rate limiter, bound as
// ROUTE_LIMIT in wrangler.jsonc). Answers already in the edge cache cost nothing
// and are not counted.

interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

/** Wait this long after hitting the limit (the limiter counts per minute). */
const LIMIT_RETRY_S = 60;

/** A request from another site's page (the browser says so); scripts and our own pages pass. */
export function fromOtherSite(req: Request): boolean {
  const site = req.headers.get("Sec-Fetch-Site");
  return site !== null && site !== "same-origin" && site !== "none";
}

async function limiter(): Promise<RateLimiter | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as Record<string, unknown>).ROUTE_LIMIT as RateLimiter | undefined) ?? null;
  } catch {
    return null;
  }
}

/** A 429 answer when this visitor asked for too many new routes this minute, else null. */
export async function overRouteLimit(req: Request): Promise<Response | null> {
  const rl = await limiter();
  if (!rl) return null;
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    const { success } = await rl.limit({ key: ip });
    if (success) return null;
  } catch {
    // The limiter being down must not cost the route.
    return null;
  }
  return Response.json({ error: "Príliš veľa trás naraz, skúste o chvíľu." }, { status: 429, headers: { "Retry-After": String(LIMIT_RETRY_S) } });
}

export const OTHER_SITE = () => Response.json({ error: "only for mountour pages" }, { status: 403 });
