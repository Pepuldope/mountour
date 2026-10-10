// MounTour service worker.
//
// Cache-on-plan, not cache-everything: nothing is precached at install time.
// A trip is only cached when the visitor taps "Ulozit vylet offline" on its
// trip sheet, which postMessage()s a CACHE_TRIP request here with the exact
// URLs to store (the trip page itself, its GPX file, and the OpenTopoMap +
// Waymarked Trails tiles for the trail's bbox at zoom 13-15).

const CACHE_PREFIX = "mountour-trip-";
// The app's own build assets (/_next/static/, content-hashed, never change) and
// the saved-trips page. Shared by every trip, so deleting one trip keeps them.
const STATIC_CACHE = "mountour-static";
const SHELL_URLS = ["/ulozene"];

// OpenTopoMap is requested from a/b/c, but only the "a." URLs are cached
// (see lib/mapLayers.ts), so tile lookups are normalised to "a.".
function cacheKey(req) {
  const url = new URL(req.url);
  if (/^[bc]\.tile\.opentopomap\.org$/.test(url.hostname)) {
    url.hostname = "a." + url.hostname.slice(2);
    return url.toString();
  }
  return req.url;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "CACHE_TRIP") return;

  const { slug, urls } = msg;
  const cacheName = CACHE_PREFIX + slug;
  const port = event.ports && event.ports[0];

  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      const shared = await caches.open(STATIC_CACHE);
      for (const url of SHELL_URLS) {
        try {
          const res = await fetch(url);
          if (res.ok) await shared.put(url, res);
        } catch {
          // Offline right now: the saved-trips page just won't be refreshed.
        }
      }
      let done = 0;
      const total = urls.length;
      for (const url of urls) {
        try {
          const res = await fetch(url, { mode: "cors" }).catch(() => fetch(url));
          if (res && (res.ok || res.type === "opaque")) {
            const target = new URL(url, self.location.origin).pathname.startsWith("/_next/static/")
              ? shared
              : cache;
            await target.put(url, res.clone());
          }
        } catch {
          // Best-effort: one failed tile shouldn't abort the whole trip cache.
        }
        done += 1;
        if (port) port.postMessage({ type: "PROGRESS", done, total });
      }
      if (port) port.postMessage({ type: "DONE", done, total });
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Build assets are content-hashed: cache-first, and keep every one we see so a
  // saved trip page can still hydrate offline.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const key = cacheKey(req);
      // Pages: network first so a saved trip shows fresh data when online;
      // fall back to the saved copy (ignoring ?query) when offline.
      if (req.mode === "navigate") {
        try {
          return await fetch(req);
        } catch (err) {
          const saved = await caches.match(key, { ignoreSearch: true });
          if (saved) return saved;
          throw err;
        }
      }
      const cached = await caches.match(key);
      if (cached) {
        // Cache-first for anything we've explicitly stored (tiles, GPX,
        // the trip page). Refresh in the background when online.
        event.waitUntil(
          fetch(req)
            .then(async (res) => {
              if (res && res.ok) {
                const cache = await caches.open(await matchingCacheName(key));
                if (cache) cache.put(key, res.clone());
              }
            })
            .catch(() => {})
        );
        return cached;
      }
      try {
        return await fetch(req);
      } catch (err) {
        throw err;
      }
    })()
  );
});

async function matchingCacheName(req) {
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    if (await cache.match(req)) return name;
  }
  return names[0];
}
