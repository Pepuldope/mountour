// Which trail marking a side walk to an added stop follows (Peter, 2026-10-29: "if side stop needs
// a different sign, it needs to show"). Read from the trail network's detail cells, whose lines
// carry their KST colours as a code ("bg" = blue and green; pipeline/network.py colour_code).
import { cellsInView } from "@/lib/trailNetwork";
import type { TrailNetworkMeta } from "@/lib/trailNetwork";
import { fetchLines } from "@/lib/packedLines";
import { haversineM, nearestOnPath } from "@/lib/geo";
import type { MarkColour } from "@/lib/tripSchema";

const CODE: Record<string, MarkColour> = { r: "red", b: "blue", g: "green", y: "yellow", k: "black" };
/** A walk point this close to a marked line follows it. */
const ON_LINE_M = 15;
/** Walk points this close to the trip's own line are still on it, and its marking says nothing about the side path. */
const ON_TRIP_M = 25;
/** At least this share of the walk on marked lines, or it counts as unmarked. */
const MARKED_SHARE = 0.5;

let metaP: Promise<TrailNetworkMeta | null> | null = null;
const cellP = new Map<string, Promise<GeoJSON.FeatureCollection | null>>();

function meta(): Promise<TrailNetworkMeta | null> {
  metaP ??= fetch("/data/trails/meta.json")
    .then((r) => (r.ok ? (r.json() as Promise<TrailNetworkMeta>) : null))
    .catch(() => null);
  return metaP;
}

function cell(key: string) {
  let p = cellP.get(key);
  if (!p) {
    p = fetchLines(`/data/trails/c/${key}.json`);
    cellP.set(key, p);
  }
  return p;
}

interface Line {
  code: string;
  pts: { lat: number; lon: number }[];
  box: [number, number, number, number];
}

/**
 * The marking along a walk of [lat, lon] points: its colour, null when it runs mostly off marked
 * trails, or undefined when that isn't known (no data, or trail data from before the colours, or
 * a walk that never really leaves the trip's own line). Points by the trip's own line are left out:
 * read there, the side path took the route's marking (Peter, 2026-10-29). Where a line carries
 * the route's marking and another, the other is named: the sign must differ from the route's.
 */
export function markingAlong(
  walk: [number, number][],
  lines: Line[],
  trip: readonly { lat: number; lon: number }[] = [],
  /** The route's marking where the walk turns off: on a shared line, the other marking is named. */
  route: MarkColour | null = null
): MarkColour | null | undefined {
  const skip = route ? Object.keys(CODE).find((k) => CODE[k] === route) : undefined;
  walk = densify(walk);
  if (trip.length >= 2) {
    walk = walk.filter(([lat, lon]) => (nearestOnPath(trip, { lat, lon })?.distanceM ?? Infinity) > ON_TRIP_M);
  }
  if (walk.length < 2 || lines.length === 0) return undefined;
  if (!lines.some((l) => l.code)) return undefined;
  const count: Record<string, number> = {};
  let marked = 0;
  for (const [lat, lon] of walk) {
    let best: Line | null = null;
    let bestD = ON_LINE_M;
    const pad = 0.0003;
    for (const l of lines) {
      if (lon < l.box[0] - pad || lon > l.box[2] + pad || lat < l.box[1] - pad || lat > l.box[3] + pad) continue;
      const hit = nearestOnPath(l.pts, { lat, lon });
      if (hit && hit.distanceM <= bestD) {
        best = l;
        bestD = hit.distanceM;
      }
    }
    if (!best?.code) continue;
    marked++;
    const code = skip && best.code.length > 1 ? best.code.replace(skip, "") : best.code;
    for (const c of code) count[c] = (count[c] ?? 0) + 1;
  }
  if (marked < walk.length * MARKED_SHARE) return null;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? (CODE[top] ?? null) : null;
}

/** A point every ~10 m: router lines are simplified to a few corners. */
function densify(walk: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < walk.length; i++) {
    out.push(walk[i]);
    if (i + 1 === walk.length) break;
    const [a, b] = [walk[i], walk[i + 1]];
    const m = haversineM({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });
    const n = Math.min(Math.floor(m / 10), 200);
    for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** The marked lines near a walk, from the network's detail cells. */
export async function linesNear(walk: [number, number][]): Promise<Line[]> {
  const m = await meta();
  if (!m || walk.length === 0) return [];
  const lats = walk.map((p) => p[0]);
  const lons = walk.map((p) => p[1]);
  const pad = 0.01;
  const keys = cellsInView(m.grid, new Set(m.cells), [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad]);
  const out: Line[] = [];
  for (const fc of await Promise.all(keys.map(cell))) {
    for (const f of fc?.features ?? []) {
      if (f.geometry.type !== "LineString") continue;
      const pts = f.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
      const la = pts.map((p) => p.lat);
      const lo = pts.map((p) => p.lon);
      out.push({ code: String(f.properties?.c ?? ""), pts, box: [Math.min(...lo), Math.min(...la), Math.max(...lo), Math.max(...la)] });
    }
  }
  return out;
}
