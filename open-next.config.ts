import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import pageCache from "./lib/pageCache";

// Serve finished pages from the cache (lib/pageCache.ts) instead of drawing
// them again on every visit: drawing a page costs the Worker more than the free
// plan's 10 ms of CPU per request, which showed up as error 1102 on 2026-10-14.
// Nothing here revalidates: new trip data arrives with the next deploy (every
// push to main, including the weekly data refresh), so no page may use
// `revalidate`.
export default defineCloudflareConfig({
  incrementalCache: pageCache,
  enableCacheInterception: true,
});
