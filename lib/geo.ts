import type { LatLng } from "@/lib/types";

const EARTH_RADIUS_M = 6371008.8;

/** Great-circle (straight-line) distance between two points, in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How far along a path (metres from its first point) the point closest to `p`
 * lies. Path points are [lon, lat, ...] as in the trip files.
 */
export function distanceAlongM(path: readonly (readonly [number, number, ...unknown[]])[], p: LatLng): number {
  let walked = 0;
  let best = Infinity;
  let at = 0;
  for (let i = 0; i < path.length; i++) {
    const here = { lat: path[i][1], lon: path[i][0] };
    if (i > 0) walked += haversineM({ lat: path[i - 1][1], lon: path[i - 1][0] }, here);
    const d = haversineM(here, p);
    if (d < best) {
      best = d;
      at = walked;
    }
  }
  return at;
}
