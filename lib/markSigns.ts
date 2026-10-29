// Where the walk changes from one trail marking to another (Peter, 2026-10-29: "so that tourists
// know which one to follow on which part of the trip"). The map puts a small KST sign there.
import type { MarkColour, MarkingRun, TripDetail } from "@/lib/tripSchema";
import type { LatLng } from "@/lib/types";

/**
 * Runs shorter than this are noise: a few metres of road between two red stretches, a junction
 * drawn a step early. A fifth of the stored runs are under 50 m, and a sign for each would bury the map.
 */
export const MIN_RUN_M = 80;

export interface MarkSign {
  location: LatLng;
  /** The marking from here on, walking the way there (null = no marking). */
  colour: MarkColour | null;
  /** The marking before this point, which is the one to follow from here on the way back. */
  before: MarkColour | null;
}

type Pt = TripDetail["path"][number];

function metres(a: Pt, b: Pt): number {
  const kx = 111320 * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 111320);
}

interface Run {
  from: number;
  to: number;
  colour: MarkColour | null;
  m: number;
}

/** The runs with short ones folded into their neighbours, so only real changes are left. */
export function cleanRuns(path: Pt[], runs: MarkingRun[]): Run[] {
  const last = path.length - 1;
  const lengthOf = (from: number, to: number) => {
    let m = 0;
    for (let i = from; i < Math.min(to, last); i++) m += metres(path[i], path[i + 1]);
    return m;
  };
  const out: Run[] = runs
    .filter((r) => r.from <= last && r.to > r.from)
    .map((r) => ({ from: r.from, to: Math.min(r.to, last), colour: r.colour, m: lengthOf(r.from, r.to) }));
  // Two neighbours with the same marking are one run.
  const join = () => {
    for (let i = out.length - 1; i > 0; i--) {
      if (out[i].colour === out[i - 1].colour) {
        out[i - 1] = { ...out[i - 1], to: out[i].to, m: out[i - 1].m + out[i].m };
        out.splice(i, 1);
      }
    }
  };
  join();
  for (;;) {
    let k = -1;
    for (let i = 0; i < out.length; i++) if (out[i].m < MIN_RUN_M && (k < 0 || out[i].m < out[k].m)) k = i;
    if (k < 0 || out.length < 2) break;
    const prev = out[k - 1];
    const next = out[k + 1];
    // A short unmarked step between two markings: the new one starts where the old one ends.
    // A short marked one goes to its longer neighbour.
    const into = !next ? k - 1 : !prev ? k + 1 : out[k].colour === null || prev.m >= next.m ? k - 1 : k + 1;
    const r = out[into];
    out[into] = { ...r, from: Math.min(r.from, out[k].from), to: Math.max(r.to, out[k].to), m: r.m + out[k].m };
    out.splice(k, 1);
    join();
  }
  return out;
}

export interface MarkSigns {
  /** The marking the walk starts on. */
  start: MarkColour | null;
  signs: MarkSign[];
}

/** One sign at each point where the marking changes, the way the trip is stored (the way there). */
export function markSigns(trip: Pick<TripDetail, "path" | "marking_runs">): MarkSigns {
  const runs = cleanRuns(trip.path, trip.marking_runs);
  return {
    start: runs[0]?.colour ?? null,
    signs: runs.slice(1).map((r, i) => {
      const [lon, lat] = trip.path[r.from];
      return { location: { lat, lon }, colour: r.colour, before: runs[i].colour };
    }),
  };
}
