import { getCloudflareContext } from "@opennextjs/cloudflare";
import staticAssetsCache, { NAME } from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";
import { computeCacheKey } from "@opennextjs/cloudflare/overrides/internal";
import type { CacheEntryType, CacheValue, IncrementalCache, WithLastModified } from "@opennextjs/aws/types/overrides";

// Where the Worker keeps finished pages, so it draws each page once per deploy
// instead of on every visit (error 1102, 2026-10-14: drawing a trip page costs
// several times the free plan's 10 ms of CPU per request).
//
// 1. Pages built ahead (home, sitemap, info pages) ship with the deploy as
//    static files. Keeping the static-assets cache's name makes the deploy copy
//    them there (opennextjs-cloudflare populateCache).
// 2. Trip pages are drawn on their first visit and kept in the free KV store
//    PAGE_CACHE (wrangler.jsonc). Keys carry the build id, so a deploy (also the
//    weekly trip data) starts fresh; entries expire on their own.
//
// KV allows 1,000 writes a day on the free plan. Past that, a page is simply
// drawn again on each visit, as before: every KV error is swallowed here.

/** Old builds' pages: unreachable after the next deploy, so let KV drop them. */
const TTL_SECONDS = 3 * 24 * 3600;

interface KvLike {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

function kv(): KvLike | undefined {
  try {
    return (getCloudflareContext().env as unknown as Record<string, unknown>).PAGE_CACHE as KvLike | undefined;
  } catch {
    return undefined;
  }
}

const kvKey = (key: string, cacheType: string) =>
  computeCacheKey(key, { prefix: "pages", buildId: process.env.OPEN_NEXT_BUILD_ID, cacheType: cacheType as "cache" });

const pageCache: IncrementalCache = {
  name: NAME,

  async get<T extends CacheEntryType = "cache">(key: string, cacheType?: T) {
    type Entry = WithLastModified<CacheValue<T>> | null;
    try {
      const built = await staticAssetsCache.get(key, cacheType);
      if (built) return built as Entry;
    } catch {
      // No static assets (local `next start`): try KV.
    }
    // Only whole pages go to KV; data fetches are not worth a write each.
    if ((cacheType ?? "cache") !== "cache") return null;
    try {
      return ((await kv()?.get(kvKey(key, "cache"), "json")) ?? null) as Entry;
    } catch {
      return null;
    }
  },

  async set(key, value, cacheType) {
    if ((cacheType ?? "cache") !== "cache") return;
    // A mistyped or probed address must not spend a KV write.
    if (((value as { meta?: { status?: number } }).meta?.status ?? 200) >= 400) return;
    try {
      await kv()?.put(kvKey(key, "cache"), JSON.stringify({ value, lastModified: Date.now() }), {
        expirationTtl: TTL_SECONDS,
      });
    } catch {
      // Over the daily write limit or KV unavailable: the page still renders.
    }
  },

  async delete(key) {
    try {
      await kv()?.delete(kvKey(key, "cache"));
    } catch {
      // Nothing to do.
    }
  },
};

export default pageCache;
