/**
 * The walk a visitor actually does, said the same way everywhere: the home list, the search,
 * the trip page's facts, its route list and the route comparison all show these numbers.
 * The walk starts at the parking (by car) or the stop (by bus or train): the walk from there
 * to the trail and back counts, and a parking or stop up the trail skips the stretch below it.
 */
import { approachMin, hikeMinutes } from "@/lib/dayPlan";
import { joinedMinutes } from "@/lib/trailJoin";
import type { TrailJoin } from "@/lib/trailJoin";

export interface WalkFacts {
  /** Walking time, the walk to the trail and back included (no kids pace). */
  min: number;
  /** Metres on foot, the walk to the trail and back included. */
  m: number;
  /** Climb, metres. */
  ascentM: number;
  /** Walk from the parking or stop to the trail, one way, minutes (0 when it is right there). */
  approachMin: number;
  /** Parked or got off up the trail: the stretch below is skipped. */
  skipped: boolean;
}

interface TrailNumbers {
  distance_m: number;
  ascent_m: number;
  duration_min: number;
}

/** Where the walk starts: a parking (walk_m) or a stop (distance_m), with its join to the trail. */
export interface WalkStart {
  join: Pick<TrailJoin, "walk_m" | "skip_out" | "skip_back" | "skip_m" | "skip_ascent_m"> | null;
  /** Straight line to the trail start, metres. */
  walk_m?: number;
  distance_m?: number;
}

export function walkFacts(trail: TrailNumbers, from: WalkStart | null): WalkFacts {
  const join = from?.join ?? null;
  const skip = join && join.skip_m > 0 ? join : null;
  const approachM = from ? (join?.walk_m ?? from.walk_m ?? from.distance_m ?? 0) : 0;
  const approach = approachMin(approachM);
  return {
    min: joinedMinutes(trail.duration_min, skip) + 2 * approach,
    // Under 150 m the walk to the trail is part of getting ready, in metres as in minutes.
    m: Math.max(0, trail.distance_m - (skip?.skip_m ?? 0)) + (approach > 0 ? 2 * approachM : 0),
    ascentM: Math.max(0, trail.ascent_m - (skip?.skip_ascent_m ?? 0)),
    approachMin: approach,
    skipped: skip !== null,
  };
}

/** Walking time for this group: kids walk slower. */
export function walkMinutes(facts: WalkFacts, withKids: boolean): number {
  return hikeMinutes(facts.min, withKids);
}

export function formatKm(m: number): string {
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** The stop a trip starts from by bus or train: the shortest walk to the trail (a stop up the trail counts from where it joins). */
export function stopsByWalk<S extends { join: { walk_m: number } | null; distance_m: number }>(stops: readonly S[]): S[] {
  return [...stops].sort((a, b) => (a.join?.walk_m ?? a.distance_m) - (b.join?.walk_m ?? b.distance_m));
}

/** Both ways of getting there for one route, for lists that follow the car/bus switch. */
export interface RouteWalk {
  car: WalkFacts | null;
  bus: WalkFacts | null;
}

/** The walk shown for a route in a list: by bus when travelling by bus (or when the route has no car park), else by car. */
export function pickWalk(w: RouteWalk | undefined, transit: boolean, parking: boolean): WalkFacts | null {
  if (!w) return null;
  return (transit || !parking ? w.bus : w.car) ?? w.car ?? w.bus;
}
