import type { LatLng } from "@/lib/types";

/** Minimal GPX track-point parser — no dependency, just DOMParser. */
export function parseGpxTrack(gpxText: string): LatLng[] {
  const doc = new DOMParser().parseFromString(gpxText, "application/xml");
  const points = Array.from(doc.getElementsByTagName("trkpt"));
  return points
    .map((pt) => {
      const lat = parseFloat(pt.getAttribute("lat") ?? "");
      const lon = parseFloat(pt.getAttribute("lon") ?? "");
      return { lat, lon };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

const trackCache = new Map<string, Promise<LatLng[]>>();

/** Fetches + parses a GPX file once per page load; resolves to [] on any failure. */
export function fetchTrack(gpxUrl: string): Promise<LatLng[]> {
  let p = trackCache.get(gpxUrl);
  if (!p) {
    p = fetch(gpxUrl)
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => (text ? parseGpxTrack(text) : []))
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
