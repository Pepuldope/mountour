/**
 * Where a parking spot or a stop meets the trail. A parking up the valley
 * doesn't send you back down to the official start: you join the trail at
 * its nearest point and skip the stretch below it, both ways.
 */
import { haversineM, nearestOnPath } from "@/lib/geo";
import type { PathHit } from "@/lib/geo";
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
  /** Set when the join was found on the stored walk: keep its first `walk_cut` + 1 points, then the join. */
  walk_cut?: number;
}

/** The stored walk on paths ([lon, lat] points, metres in all). */
interface StoredWalk {
  line: readonly (readonly [number, number])[];
  m: number;
}

/** A walk point this close to the trail is on it. */
const TOUCH_M = 25;

/** Joining part-way must save at least this much walking to the trail, or we keep the official start. */
const MIN_SAVING_M = 100;

/**
 * The join point for a place `walkM` metres (straight line) from the trail
 * start, or null when the start itself is the sensible way in. Loops keep
 * their full length (you walk the whole loop from wherever you join).
 */
export function trailJoin(path: readonly PathPoint[], place: LatLng, walkM: number, loop: boolean, walk?: StoredWalk | null): TrailJoin | null {
  if (path.length < 2) return null;
  const pts = path.map((q) => ({ lat: q[1], lon: q[0] }));
  const near = nearestOnPath(pts, place);
  // At (or before) the first point, or no real saving: the official start it is.
  const straight = !near || (near.i === 0 && near.t === 0) || near.distanceM > walkM - MIN_SAVING_M ? null : near;

  // The stored walk often heads for the start but meets the trail on the way, then follows it
  // down to the start (Peter: "sends you to the start instead of cutting"). Join where it first
  // meets the trail when that is further up than the straight-line join.
  const touch = walk ? firstTouch(pts, walk) : null;
  const useTouch = touch && alongM(pts, touch.hit) >= MIN_SAVING_M && (!straight || touch.hit.i + touch.hit.t > straight.i + straight.t);
  const hit = useTouch ? touch.hit : straight;
  if (!hit) return null;
  const cut = useTouch ? { walk_cut: touch.k } : {};

  const location = { lat: Number(hit.point.lat.toFixed(6)), lon: Number(hit.point.lon.toFixed(6)) };
  const walk_m = Math.round(useTouch ? touch.walkedM + hit.distanceM : hit.distanceM);
  if (loop) return { location, walk_m, skip_out: 0, skip_back: 0, skip_m: 0, skip_ascent_m: 0, ...cut };

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
    ...cut,
  };
}

/** The first point of the walk that is on the trail, with the metres walked to get there. */
function firstTouch(pts: readonly LatLng[], walk: StoredWalk): { k: number; hit: PathHit; walkedM: number } | null {
  let walkedM = 0;
  for (let k = 0; k < walk.line.length; k++) {
    const q = { lat: walk.line[k][1], lon: walk.line[k][0] };
    if (k > 0) walkedM += haversineM({ lat: walk.line[k - 1][1], lon: walk.line[k - 1][0] }, q);
    const hit = nearestOnPath(pts, q);
    if (hit && hit.distanceM <= TOUCH_M) return { k, hit, walkedM };
  }
  return null;
}

/** Trail metres from the start to a hit. */
function alongM(pts: readonly LatLng[], hit: PathHit): number {
  let m = 0;
  for (let i = 0; i < hit.i; i++) m += haversineM(pts[i], pts[i + 1]);
  return hit.i + 1 < pts.length ? m + hit.t * haversineM(pts[hit.i], pts[hit.i + 1]) : m;
}

/** The trail's walking time without the skipped part, rounded to 5 min. */
export function joinedMinutes(trailMin: number, skip: Pick<TrailJoin, "skip_out" | "skip_back"> | null): number {
  if (!skip) return trailMin;
  return Math.max(5, Math.round((trailMin * (1 - skip.skip_out - skip.skip_back)) / 5) * 5);
}
