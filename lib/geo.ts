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

export interface PathHit {
  /** Segment from point i to point i + 1. */
  i: number;
  /** How far along that segment, 0..1. */
  t: number;
  point: LatLng;
  /** Straight line from the place to the hit, metres. */
  distanceM: number;
}

/**
 * The point of a line (not just its vertices) closest to `p`: trails are
 * stored with few points, so a parking beside a long straight stretch is
 * far from every vertex but next to the line.
 */
export function nearestOnPath(points: readonly LatLng[], p: LatLng): PathHit | null {
  if (points.length === 0) return null;
  // Flat metres around p: fine over the few kilometres that matter here.
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110540;
  const xy = (q: LatLng) => [(q.lon - p.lon) * kx, (q.lat - p.lat) * ky];
  let best: PathHit = { i: 0, t: 0, point: points[0], distanceM: haversineM(points[0], p) };
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = xy(points[i]);
    const [bx, by] = xy(points[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best.distanceM - 1e-9) {
      const a = points[i];
      const b = points[i + 1];
      best = { i, t, point: { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) }, distanceM: d };
    }
  }
  return best;
}
