import type { LatLng } from "@/lib/types";

/**
 * Minimal GPX track-point parser — no dependency, just DOMParser. A place's file holds a track per
 * route (pipeline/publish.py), each with its trip's slug in <desc>: `track` picks one, else the
 * first (the main route) is used.
 */
export function parseGpxTrack(gpxText: string, track?: string): LatLng[] {
  const doc = new DOMParser().parseFromString(gpxText, "application/xml");
  const tracks = Array.from(doc.getElementsByTagName("trk"));
  const trk =
    (track && tracks.find((t) => t.getElementsByTagName("desc")[0]?.textContent === track)) || tracks[0] || doc;
  const points = Array.from(trk.getElementsByTagName("trkpt"));
  return points
    .map((pt) => {
      const lat = parseFloat(pt.getAttribute("lat") ?? "");
      const lon = parseFloat(pt.getAttribute("lon") ?? "");
      return { lat, lon };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

/**
 * The place's GPX cut down to one route: the track whose <desc> is `track`, else the first (the
 * main route). Null when the file can't be read. Every track in the file carries the place's name,
 * so `name` (the route as the page calls it) replaces it, and a maps app or watch shows which one it is.
 */
export function routeGpx(gpxText: string, track?: string, name?: string): string | null {
  const doc = new DOMParser().parseFromString(gpxText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return null;
  const tracks = Array.from(doc.getElementsByTagName("trk"));
  if (tracks.length === 0) return null;
  const keep = (track && tracks.find((t) => t.getElementsByTagName("desc")[0]?.textContent === track)) || tracks[0];
  for (const t of tracks) if (t !== keep) t.parentNode?.removeChild(t);
  if (name) {
    const trkName = keep.getElementsByTagName("name")[0];
    const meta = doc.getElementsByTagName("metadata")[0]?.getElementsByTagName("name")[0];
    if (trkName) trkName.textContent = name;
    if (meta) meta.textContent = name;
  }
  return new XMLSerializer().serializeToString(doc);
}

const trackCache = new Map<string, Promise<LatLng[]>>();

/** Fetches + parses a GPX track ("/gpx/<place>.gpx#<slug>") once per page load; resolves to [] on any failure. */
export function fetchTrack(gpxUrl: string): Promise<LatLng[]> {
  let p = trackCache.get(gpxUrl);
  if (!p) {
    p = fetch(gpxUrl)
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => (text ? parseGpxTrack(text, decodeURIComponent(new URL(gpxUrl, "http://x").hash.slice(1))) : []))
      .catch(() => []);
    trackCache.set(gpxUrl, p);
    // Don't pin failures (offline / not cached yet): allow a retry next time.
    p.then((track) => {
      if (track.length === 0) trackCache.delete(gpxUrl);
    });
  }
  return p;
}

/** "/gpx/<file>" URL for a trail's gpx_path, or null. */
export function gpxUrlFor(gpxPath: string | null): string | null {
  return gpxPath ? `/gpx/${gpxPath.split("/").pop()}` : null;
}
