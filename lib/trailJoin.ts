/**
 * Where a parking spot or a stop meets the trail. A parking up the valley
 * doesn't send you back down to the official start: you join the trail at
 * its nearest point and skip the stretch below it, both ways.
 */
import { haversineM, nearestOnPath } from "@/lib/geo";
import { stepHours } from "@/lib/tripProfile";
import type { LatLng } from "@/lib/types";

/** [lon, lat, ele] as in the trip files. */
type PathPoint = readonly [number, number, number | null, ...unknown[]];

export interface TrailJoin {
  /** Where the walk from the car (or the stop) reaches the trail. */
  location: LatLng;
  /** Straight line from the parking or stop to that point, metres. */
  walk_m: number;
  /** Share of the trail's walking time skipped before that point on the way out, 0..1. */
  skip_out: number;
  /** ...and after it on the way back (there-and-back trails), 0..1. */
  skip_back: number;
  /** Trail metres skipped in all. */
  skip_m: number;
  /** Climb skipped, metres. */
  skip_ascent_m: number;
}

/** Joining part-way must save at least this much walking to the trail, or we keep the official start. */
const MIN_SAVING_M = 100;

/**
 * The join point for a place `walkM` metres (straight line) from the trail
 * start, or null when the start itself is the sensible way in. Loops keep
 * their full length (you walk the whole loop from wherever you join).
 */
export function trailJoin(path: readonly PathPoint[], place: LatLng, walkM: number, loop: boolean): TrailJoin | null {
  if (path.length < 2) return null;
  const pts = path.map((q) => ({ lat: q[1], lon: q[0] }));
  const hit = nearestOnPath(pts, place);
  // At (or before) the first point, or no real saving: the official start it is.
  if (!hit || (hit.i === 0 && hit.t === 0) || hit.distanceM > walkM - MIN_SAVING_M) return null;

  const location = { lat: Number(hit.point.lat.toFixed(6)), lon: Number(hit.point.lon.toFixed(6)) };
  const walk_m = Math.round(hit.distanceM);
  if (loop) return { location, walk_m, skip_out: 0, skip_back: 0, skip_m: 0, skip_ascent_m: 0 };

  // Heights with gaps filled from the last known one.
  let last = path.find((p) => p[2] !== null)?.[2] ?? 0;
  const ele = path.map((p) => (last = p[2] ?? last));
  let up = 0;
  let down = 0;
  let total = 0;
  let along = 0;
  let climb = 0;
  for (let i = 1; i < path.length; i++) {
    const m = haversineM(pts[i - 1], pts[i]);
    const rise = ele[i] - ele[i - 1];
    const out = stepHours(m, rise);
    const back = stepHours(m, -rise);
    total += out + back;
    // Whole segments before the hit, plus the part of the hit segment before it.
    const share = i - 1 < hit.i ? 1 : i - 1 === hit.i ? hit.t : 0;
    if (share > 0) {
      up += stepHours(m * share, rise * share);
      down += stepHours(m * share, -rise * share);
      along += m * share;
      climb += Math.max(0, rise * share);
    }
  }
  if (total <= 0) return null;
  return {
    location,
    walk_m,
    skip_out: up / total,
    skip_back: down / total,
    skip_m: Math.round(2 * along),
    skip_ascent_m: Math.round(climb),
  };
}

/** The trail's walking time without the skipped part, rounded to 5 min. */
export function joinedMinutes(trailMin: number, skip: Pick<TrailJoin, "skip_out" | "skip_back"> | null): number {
  if (!skip) return trailMin;
  return Math.max(5, Math.round((trailMin * (1 - skip.skip_out - skip.skip_back)) / 5) * 5);
}
