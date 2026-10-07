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
