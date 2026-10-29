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

type Binding = "ROUTE_LIMIT" | "COUNT_LIMIT" | "READ_LIMIT";

async function limiter(binding: Binding): Promise<RateLimiter | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as Record<string, unknown>)[binding] as RateLimiter | undefined) ?? null;
  } catch {
    return null;
  }
}

async function overLimit(req: Request, binding: Binding, prefix: string): Promise<boolean> {
  const rl = await limiter(binding);
  if (!rl) return false;
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    const { success } = await rl.limit({ key: `${prefix}${ip}` });
    return !success;
  } catch {
    // The limiter being down must not cost the route.
    return false;
  }
}

/** A 429 answer when this visitor asked for too many new routes this minute, else null. */
export async function overRouteLimit(req: Request): Promise<Response | null> {
  if (!(await overLimit(req, "ROUTE_LIMIT", ""))) return null;
  return Response.json({ error: "Príliš veľa trás naraz, skúste o chvíľu." }, { status: 429, headers: { "Retry-After": String(LIMIT_RETRY_S) } });
}

/**
 * The usage counters and saved reviews (each a database write) and new trip lists (each reads the
 * whole trip table) get a limit of their own (COUNT_LIMIT, 60 a minute per address, kept per
 * `use`): loose enough for a whole class behind one school address (a repeat visit the same day
 * writes nothing, a class shares its town's list), tight enough that one script can't spend the
 * day's free database writes or reads.
 */
export async function overCallLimit(req: Request, use: "visit" | "event" | "review" | "vylety" | "feedback" | "push"): Promise<boolean> {
  return overLimit(req, "COUNT_LIMIT", `${use}:`);
}

/**
 * New weather and review-totals answers (a call out or a small database read; repeats come from
 * the edge cache and aren't counted) get a looser one (READ_LIMIT, 300 a minute per address,
 * kept per `use`). The load test (2026-10-27) had 100 people on one school address open different
 * trips: at 60 a minute most of them saw no weather.
 */
export async function overReadLimit(req: Request, use: "weather" | "reviews"): Promise<boolean> {
  return overLimit(req, "READ_LIMIT", `${use}:`);
}

export const TOO_MANY = () =>
  Response.json({ error: "Príliš veľa požiadaviek naraz, skúste o chvíľu." }, { status: 429, headers: { "Retry-After": String(LIMIT_RETRY_S) } });

export const OTHER_SITE = () => Response.json({ error: "only for turuj pages" }, { status: 403 });
