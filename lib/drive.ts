import { haversineM } from "@/lib/geo";
import type { LatLng } from "@/lib/types";

/** One-way drive from the trip's start to the parking lot / trailhead. */
export interface DriveRoute {
  durationMin: number;
  distanceM: number;
  /** [lat, lon] pairs, simplified for drawing. */
  points: [number, number][];
}

/** ~100 m: enough for a drive estimate, coarse enough to cache and not leak an exact home address. */
export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function driveKey(from: LatLng, to: LatLng): string {
  return [from.lat, from.lon, to.lat, to.lon].map(roundCoord).join(",");
}

/** Precomputed drive times from the town nearest to the start, by trip slug. null = unroutable. */
export interface TownDrives {
  town: { name: string; lat: number; lon: number };
  minutes: Record<string, number | null>;
}

/**
 * Two rough models, the shorter wins: nearby, roads are ~1.4x the straight line at ~60 km/h;
 * further away the motorway takes over (~1.3x at ~85 km/h, plus ~30 min of towns and the last
 * valley road). Checked against the pipeline's 30k real town-to-trailhead drives
 * (data/drive-times.json, 2026-10-11): typical error 15% instead of 26%; the old single model
 * made Bratislava - Veľký Choč 4 h 35 for a 2 h 50 drive.
 */
const NEAR = { roadFactor: 1.4, kmh: 60, extraMin: 5 };
const FAR = { roadFactor: 1.3, kmh: 85, extraMin: 30 };

/**
 * Bus or train, door to the stop by the trail, from the road time between the same places.
 * There is no free timetable data yet, so this is an estimate shown with "~" next to the cp.sk
 * link: buses and trains run ~1.4x slower than a car on the same trip (stops, detours through
 * villages, a change), plus ~20 min to walk to the stop at home and wait for the connection.
 */
const TRANSIT_FACTOR = 1.4;
const TRANSIT_EXTRA_MIN = 20;

export function transitMinutes(roadMin: number): number {
  return Math.round((roadMin * TRANSIT_FACTOR + TRANSIT_EXTRA_MIN) / 5) * 5;
}

/**
 * Rough drive time from the straight-line distance, for when the routing API
 * is down or offline. Shown with "~" so it never reads as a real route.
 */
export function estimateDriveMin(from: LatLng, to: LatLng): number {
  const km = haversineM(from, to) / 1000;
  const model = (m: typeof NEAR) => ((km * m.roadFactor) / m.kmh) * 60 + m.extraMin;
  return Math.max(5, Math.round(Math.min(model(NEAR), model(FAR)) / 5) * 5);
}

/** Starts further than this from the nearest precomputed town get "~" on their drive times. */
export const TOWN_EXACT_KM = 10;

/** Minutes per straight-line km nearer to or further from the trip than the table town (fitted on the town tables). */
const MIN_PER_KM = 1.2;

/**
 * A drive time with no router call, as the home list and the trip page (while its route loads) show it:
 * the weekly table from the town nearest the start, corrected by how much nearer or further the start
 * is from the trip than that town (straight line), else the straight-line estimate.
 *
 * Adding the drive to the town instead counted it even when the start lay on the way, and came out
 * 16 min too long on average (Peter 2026-10-23: 45 min on the list, 35 on the trip page). Checked on
 * the 141 town tables (one town as the start, its nearest as the table): median error ~3 min, no bias.
 */
export function quickDriveMin(start: LatLng, to: LatLng, drives: TownDrives | null, tableMin: number | null): number {
  if (!drives || tableMin === null) return estimateDriveMin(start, to);
  const town = { lat: drives.town.lat, lon: drives.town.lon };
  const nearerKm = (haversineM(town, to) - haversineM(start, to)) / 1000;
  return Math.max(3, Math.round(tableMin - nearerKm * MIN_PER_KM));
}
