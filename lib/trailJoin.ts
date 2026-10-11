/**
 * Where a parking spot or a stop meets the trail. A parking up the valley
 * doesn't send you back down to the official start: you join the trail at
 * its nearest point and skip the stretch below it, both ways.
 */
import { haversineM } from "@/lib/geo";
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
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversineM(place, { lat: path[i][1], lon: path[i][0] });
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best === 0 || bestD > walkM - MIN_SAVING_M) return null;

  const location = { lat: path[best][1], lon: path[best][0] };
  if (loop) return { location, walk_m: Math.round(bestD), skip_out: 0, skip_back: 0, skip_m: 0, skip_ascent_m: 0 };

  // Heights with gaps filled from the last known one.
  let last = path.find((p) => p[2] !== null)?.[2] ?? 0;
  const ele = path.map((p) => (last = p[2] ?? last));
  let up = 0;
  let down = 0;
  let total = 0;
  let along = 0;
  let climb = 0;
  for (let i = 1; i < path.length; i++) {
    const m = haversineM({ lat: path[i - 1][1], lon: path[i - 1][0] }, { lat: path[i][1], lon: path[i][0] });
    const out = stepHours(m, ele[i] - ele[i - 1]);
    const back = stepHours(m, ele[i - 1] - ele[i]);
    total += out + back;
    if (i <= best) {
      up += out;
      down += back;
      along += m;
      climb += Math.max(0, ele[i] - ele[i - 1]);
    }
  }
  if (total <= 0) return null;
  return {
    location,
    walk_m: Math.round(bestD),
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
