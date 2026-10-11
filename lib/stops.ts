// Where to catch the bus or train from the start point. Every named stop in
// Slovakia sits in static files per grid cell (pipeline/stops.py); the browser
// fetches the cells around the start and picks the nearest stop itself, so the
// start never leaves the device.
import { haversineM } from "@/lib/geo";
import type { LatLng, TransitMode } from "@/lib/types";

export interface HomeStop {
  name: string;
  mode: TransitMode;
  location: LatLng;
  /** Straight line from the start, metres. */
  distance_m: number;
}

interface StopsMeta {
  grid: { lon0: number; lat0: number; dx: number; dy: number };
  cells: string[];
}

type Row = [name: string, mode: "a" | "v" | "e", lat: number, lon: number];

const BASE = "/data/stops";
const MODE: Record<Row[1], TransitMode> = { a: "autobus", v: "vlak", e: "elektricka" };
/** Look this far around the start (~2 km), so a start near a cell edge still finds its stop. */
const PAD_DEG = 0.02;
/** A train station this much further than the nearest bus stop is still worth naming (it often goes direct). */
const STATION_EXTRA_M = 800;
/** Further than this, there's no stop "near your start" to speak of. */
export const MAX_HOME_STOP_M = 5000;

let metaP: Promise<StopsMeta | null> | null = null;
const cellP = new Map<string, Promise<Row[]>>();

function json<T>(url: string): Promise<T | null> {
  return fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);
}

function cell(key: string): Promise<Row[]> {
  let p = cellP.get(key);
  if (!p) {
    p = json<Row[]>(`${BASE}/${key}.json`).then((rows) => rows ?? []);
    cellP.set(key, p);
  }
  return p;
}

/** Grid cells ("ix_iy") within PAD_DEG of a point. */
export function cellsAround(grid: StopsMeta["grid"], available: Set<string>, p: LatLng): string[] {
  const out = new Set<string>();
  for (const dLat of [-PAD_DEG, 0, PAD_DEG]) {
    for (const dLon of [-PAD_DEG, 0, PAD_DEG]) {
      const key = `${Math.floor((p.lon + dLon - grid.lon0) / grid.dx)}_${Math.floor((p.lat + dLat - grid.lat0) / grid.dy)}`;
      if (available.has(key)) out.add(key);
    }
  }
  return [...out];
}

/**
 * The stop to leave from: the nearest one, or a train station not much
 * further (a train from the town's station usually beats a bus from the corner).
 */
export function pickHomeStop(rows: Row[], from: LatLng): HomeStop | null {
  let best: HomeStop | null = null;
  let station: HomeStop | null = null;
  for (const [name, mode, lat, lon] of rows) {
    const location = { lat, lon };
    const d = haversineM(from, location);
    if (d > MAX_HOME_STOP_M) continue;
    const s = { name, mode: MODE[mode], location, distance_m: Math.round(d) };
    if (!best || d < best.distance_m) best = s;
    if (mode === "v" && (!station || d < station.distance_m)) station = s;
  }
  if (best && station && station !== best && station.distance_m - best.distance_m <= STATION_EXTRA_M) return station;
  return best;
}

export async function nearestHomeStop(from: LatLng): Promise<HomeStop | null> {
  metaP ??= json<StopsMeta>(`${BASE}/meta.json`);
  const meta = await metaP;
  if (!meta) return null;
  const keys = cellsAround(meta.grid, new Set(meta.cells), from);
  const rows = (await Promise.all(keys.map(cell))).flat();
  return pickHomeStop(rows, from);
}
