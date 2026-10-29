// "Kde som?" on a trip (C10, Peter 2026-10-29): where a location fix lies on the planned walk.
// A web app gets no GPS while the phone is locked, so this works from one fix at a time:
// each time the visitor looks, we place them on the route and say what comes next.
import { cleanRuns } from "@/lib/markSigns";
import { stepHours } from "@/lib/tripProfile";
import type { MarkColour, TripDetail } from "@/lib/tripSchema";
import type { LatLng } from "@/lib/types";

/** Further than this from the route, the visitor is off it (GPS in a forest is often 20-50 m out). */
export const OFF_ROUTE_M = 150;
/** This close to the goal counts as having reached it: from here on we are on the way back. */
export const AT_GOAL_M = 80;
/** A fix this close to another stretch of the walk may be either: the one next in walking order wins. */
const SAME_SPOT_M = 30;

export type WalkTrip = Pick<TripDetail, "path" | "marking_runs" | "turnaround_index" | "route">;

export interface Walk {
  /** The whole walk in walking order: there and back for "tam-a-spat", the loop for "okruh". */
  points: LatLng[];
  /** Metres walked before each point. */
  m: number[];
  /** DIN walking hours before each point (only the ratios count, the trip's duration is the total). */
  h: number[];
  /** Marking of the stretch from points[k] to points[k + 1] (short noise runs folded in). */
  colour: (MarkColour | null)[];
  /** Index of the goal in points. */
  goal: number;
  loop: boolean;
}

function metres(a: LatLng, b: LatLng): number {
  const kx = 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 111320);
}

export function buildWalk(trip: WalkTrip): Walk | null {
  const path = trip.path;
  if (path.length < 2) return null;
  const loop = trip.route === "okruh";
  const segColour: (MarkColour | null)[] = path.map(() => null);
  for (const r of cleanRuns(path, trip.marking_runs)) for (let i = r.from; i < r.to && i < path.length; i++) segColour[i] = r.colour;

  let last = path.find((p) => p[2] !== null)?.[2] ?? 0;
  const ele = path.map((p) => (last = p[2] ?? last));
  // Stored one way: a there-and-back walk comes back the same way, reversed.
  const order = loop ? path.map((_, i) => i) : [...path.keys(), ...[...path.keys()].reverse().slice(1)];
  const points = order.map((i) => ({ lat: path[i][1], lon: path[i][0] }));
  const m = [0];
  const h = [0];
  const colour: (MarkColour | null)[] = [];
  for (let k = 1; k < order.length; k++) {
    const a = order[k - 1];
    const b = order[k];
    const d = metres(points[k - 1], points[k]);
    m.push(m[k - 1] + d);
    h.push(h[k - 1] + stepHours(d, ele[b] - ele[a]));
    colour.push(segColour[Math.min(a, b)]);
  }
  const goal = loop ? Math.min(Math.max(trip.turnaround_index, 0), path.length - 1) : path.length - 1;
  return { points, m, h, colour, goal, loop };
}

export interface OnTrail {
  /** Position along the walk: segment index plus how far along it (k.t). */
  at: number;
  /** What to pass as `prevAt` with the next fix: at the goal, the way back starts. */
  memo: number;
  /** The nearest point of the route. */
  snapped: LatLng;
  /** Straight line from the fix to the route, metres. */
  offM: number;
  offRoute: boolean;
  doneM: number;
  totalM: number;
  /** Share of the walking time behind the visitor, 0..1. */
  doneShare: number;
  /** Share of the walking time from here to the goal (0 once past it). */
  toGoalShare: number;
  /** Share of the walking time from the goal back to the end (there and back: the way down). */
  goalToEndShare: number;
  /** Share of the walking time back to the start if the visitor turned here (null on a loop or past the goal). */
  turnShare: number | null;
  pastGoal: boolean;
  /** The marking to follow now (null = unmarked stretch). */
  colour: MarkColour | null;
  /** The next change of marking ahead, if any. */
  next: { inM: number; colour: MarkColour | null } | null;
}

/** A spot `fraction` along segment k, as one number. */
const interp = (arr: number[], k: number, t: number) => arr[k] + (arr[Math.min(k + 1, arr.length - 1)] - arr[k]) * t;

/**
 * Where a fix lies on the walk. `prevAt` is where the last fix was (null for the first one):
 * a there-and-back walk passes every spot twice, and the stretch next in walking order wins.
 */
export function locate(walk: Walk, fix: LatLng, prevAt: number | null): OnTrail {
  const kx = 111320 * Math.cos((fix.lat * Math.PI) / 180);
  const ky = 110540;
  const xy = (q: LatLng) => [(q.lon - fix.lon) * kx, (q.lat - fix.lat) * ky];
  const hits: { k: number; t: number; d: number }[] = [];
  for (let k = 0; k + 1 < walk.points.length; k++) {
    const [ax, ay] = xy(walk.points[k]);
    const [bx, by] = xy(walk.points[k + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
    hits.push({ k, t, d: Math.hypot(ax + t * dx, ay + t * dy) });
  }
  const best = Math.min(...hits.map((h) => h.d));
  // Each pass of the walk by this spot (a run of neighbouring stretches) counts once, at its closest.
  const near: typeof hits = [];
  let runEnd = -2;
  for (const h of hits) {
    if (h.d > best + SAME_SPOT_M) continue;
    if (h.k === runEnd + 1 && near.length) {
      if (h.d < near[near.length - 1].d) near[near.length - 1] = h;
    } else near.push(h);
    runEnd = h.k;
  }
  // Walking on: the first close stretch not behind the last fix (a little slack for GPS jitter back).
  const from = prevAt === null ? 0 : Math.max(0, prevAt - 1);
  const ahead = near.filter((h) => h.k + h.t >= from);
  const pick = (ahead.length ? ahead : near).reduce((a, b) => (b.k + b.t < a.k + a.t ? b : a));
  const at = pick.k + pick.t;
  const a = walk.points[pick.k];
  const b = walk.points[pick.k + 1];
  const snapped = { lat: a.lat + pick.t * (b.lat - a.lat), lon: a.lon + pick.t * (b.lon - a.lon) };

  const totalH = walk.h[walk.h.length - 1] || 1;
  const hAt = interp(walk.h, pick.k, pick.t);
  const doneM = interp(walk.m, pick.k, pick.t);
  const pastGoal = at >= walk.goal || metres(fix, walk.points[walk.goal]) < AT_GOAL_M;

  let next: OnTrail["next"] = null;
  for (let k = pick.k + 1; k < walk.colour.length; k++) {
    if (walk.colour[k] !== walk.colour[k - 1]) {
      next = { inM: walk.m[k] - doneM, colour: walk.colour[k] };
      break;
    }
  }
  return {
    at,
    memo: pastGoal ? Math.max(at, walk.goal) : at,
    snapped,
    offM: pick.d,
    offRoute: pick.d > OFF_ROUTE_M,
    doneM,
    totalM: walk.m[walk.m.length - 1],
    doneShare: hAt / totalH,
    toGoalShare: pastGoal ? 0 : Math.max(0, (walk.h[walk.goal] - hAt) / totalH),
    goalToEndShare: (totalH - walk.h[walk.goal]) / totalH,
    turnShare: walk.loop || pastGoal ? null : (totalH - interp(walk.h, 2 * walk.goal - pick.k - 1, 1 - pick.t)) / totalH,
    pastGoal,
    colour: walk.colour[Math.min(pick.k, walk.colour.length - 1)] ?? null,
    next,
  };
}

/** "Otočili sme sa skôr": the same spot on the way back of a there-and-back walk. */
export function turnBack(walk: Walk, at: number): number {
  if (walk.loop || at >= walk.goal) return at;
  return 2 * walk.goal - at;
}

export interface Timing {
  /** Walking minutes left to the end. */
  leftMin: number;
  /** When the walk ends at the planned pace. */
  finish: Date;
  /** When the goal is reached at this pace (null on the way back or on a loop). */
  atGoal: Date | null;
  /** Be at the goal by this time to be back before sunset (null on the way back, or no sunset). */
  latestAtGoal: Date | null;
  /** Back at the start if the group turned here now (null on a loop or past the goal). */
  backIfTurned: Date | null;
  /** Ends after sunset at this pace. */
  late: boolean;
}

/** The clock for a position: `walkMin` is the whole walk at this group's pace (kids included). */
export function timing(pos: OnTrail, walkMin: number, now: Date, sunset: Date | null): Timing {
  const leftMin = Math.max(0, Math.round(walkMin * (1 - pos.doneShare)));
  const finish = new Date(now.getTime() + leftMin * 60000);
  const latestAtGoal =
    sunset && !pos.pastGoal ? new Date(sunset.getTime() - Math.round(walkMin * pos.goalToEndShare) * 60000) : null;
  const inMin = (share: number) => new Date(now.getTime() + Math.round(walkMin * share) * 60000);
  const out = !pos.pastGoal && pos.turnShare !== null;
  return {
    leftMin,
    finish,
    atGoal: out ? inMin(pos.toGoalShare) : null,
    latestAtGoal,
    backIfTurned: out ? inMin(pos.turnShare!) : null,
    late: !!sunset && finish > sunset,
  };
}
