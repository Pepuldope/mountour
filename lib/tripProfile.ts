/**
 * The walk as a height profile over time, for the sun-arc picture on the
 * trip page. Pure: built on the server from TripDetail.path, then laid on the
 * day's clock in the browser.
 */
import type { DestinationKind, MarkColour, TripDetail } from "@/lib/tripSchema";

export interface ProfilePoint {
  /** Height, metres. */
  ele: number;
  /** Share of the walking time spent before this point, 0..1. */
  at: number;
  /** Trail marking from the previous point to this one; null = unmarked. */
  colour: MarkColour | null;
}

export interface TripProfile {
  /** The whole walk: there and back for "tam-a-spat", the loop for "okruh". */
  points: ProfilePoint[];
  /** Index into points of the goal (peak, lake, castle...). */
  goalIndex: number;
  goalName: string;
  goalKind: DestinationKind;
  loop: boolean;
}

/** About this many points is plenty for a 360 px wide picture. */
const MAX_POINTS = 140;

function metres(a: [number, number, unknown], b: [number, number, unknown]): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * DIN 33466 walking hours for one step: 4 km/h flat, 300 m/h up, 500 m/h
 * down; the larger of flat and climb plus half the smaller. Only ratios are
 * used, the trip's own duration_min stays the total.
 */
export function stepHours(distM: number, dEleM: number): number {
  const flat = distM / 4000;
  const climb = dEleM > 0 ? dEleM / 300 : -dEleM / 500;
  return Math.max(flat, climb) + Math.min(flat, climb) / 2;
}

export function buildProfile(trip: TripDetail): TripProfile | null {
  const path = trip.path;
  if (path.length < 2) return null;

  // segColour[i] = marking of the stretch from path[i] to path[i + 1].
  const segColour: (MarkColour | null)[] = path.map(() => null);
  for (const run of trip.marking_runs) {
    for (let i = run.from; i < run.to && i < path.length; i++) segColour[i] = run.colour;
  }

  // Fill missing heights with the last known one.
  let last = path.find((p) => p[2] !== null)?.[2] ?? trip.start.ele_m ?? 0;
  const ele = path.map((p) => (last = p[2] ?? last));

  const loop = trip.route === "okruh";
  const turn = Math.min(Math.max(trip.turnaround_index, 0), path.length - 1);
  // There-and-back paths are stored one way: walk them back reversed.
  const order = loop ? path.map((_, i) => i) : [...path.keys(), ...[...path.keys()].reverse().slice(1)];
  const goalAt = loop ? turn : path.length - 1;

  const cost = [0];
  for (let k = 1; k < order.length; k++) {
    const a = order[k - 1];
    const b = order[k];
    cost.push(cost[k - 1] + stepHours(metres(path[a], path[b]), ele[b] - ele[a]));
  }
  const total = cost[cost.length - 1] || 1;

  // Keep every nth point plus the goal and the end, so the picture stays light.
  const step = Math.max(1, Math.ceil(order.length / MAX_POINTS));
  const keep = new Set<number>([0, goalAt, order.length - 1]);
  for (let k = 0; k < order.length; k += step) keep.add(k);
  const kept = [...keep].sort((a, b) => a - b);

  // A point carries the colour of the stretch just walked to reach it (the first one, of the first stretch).
  const colourOf = (k: number) => segColour[k === 0 ? 0 : Math.min(order[k], order[k - 1])];

  return {
    points: kept.map((k) => ({ ele: ele[order[k]], at: cost[k] / total, colour: colourOf(k) })),
    goalIndex: kept.indexOf(goalAt),
    goalName: trip.destination.name,
    goalKind: trip.destination.kind,
    loop,
  };
}

/** What the goal is called in the day's steps, and how "being there" reads. */
export const GOAL_WORDS: Record<DestinationKind, { noun: string; at: string }> = {
  vrchol: { noun: "vrchol", at: "Na vrchole" },
  vyhliadka: { noun: "vyhliadka", at: "Na vyhliadke" },
  hrad: { noun: "hrad", at: "Pri hrade" },
  chata: { noun: "chata", at: "Na chate" },
  pleso: { noun: "pleso", at: "Pri plese" },
  vodopad: { noun: "vodopád", at: "Pri vodopáde" },
  jaskyna: { noun: "jaskyňa", at: "Pri jaskyni" },
  ine: { noun: "cieľ", at: "V cieli" },
};
