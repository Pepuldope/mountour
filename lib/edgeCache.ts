// Cloudflare's own cache in front of the routing APIs: the same parking and
// trail start give the same walk for everyone, so the router is asked once a
// day per pair, not on every visit. Free, no binding. Outside Cloudflare
// (local dev, Vercel) there is no `caches.default` and this just computes.

type EdgeCache = {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
};

function edgeCache(): EdgeCache | null {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return c?.default ?? null;
}

/**
 * A cached answer for this GET, else `compute()`; good answers are kept for `maxAgeS`.
 * `params` (the parsed, rounded inputs) make the key, so extra or reordered query
 * parameters can't skip the cache; without them the URL is the key.
 */
export async function withEdgeCache(
  req: Request,
  maxAgeS: number,
  compute: () => Promise<Response>,
  params?: Record<string, string>
): Promise<Response> {
  const cache = edgeCache();
  const url = new URL(req.url);
  if (params) url.search = new URLSearchParams(params).toString();
  const key = new Request(url.toString(), { method: "GET" });
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch {
      // A cache hiccup must not cost the route.
    }
  }
  const res = await compute();
  if (cache && res.ok) {
    try {
      const copy = new Response(res.clone().body, res);
      copy.headers.set("Cache-Control", `public, max-age=${maxAgeS}`);
      await cache.put(key, copy);
    } catch {
      // Not cached this time; the answer still goes out.
    }
  }
  return res;
}
