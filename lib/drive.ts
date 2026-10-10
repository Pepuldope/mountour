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

/** Drive time from one start to many destinations, in destination order. null = unroutable. */
export interface DriveMatrix {
  durationsMin: (number | null)[];
  distancesM: (number | null)[];
}

/** Roads are ~1.4x the straight line here; ~60 km/h door to door; rounded to 5 min. */
const ROAD_FACTOR = 1.4;
const AVG_KMH = 60;

/**
 * Rough drive time from the straight-line distance, for when the routing API
 * is down or offline. Shown with "~" so it never reads as a real route.
 */
export function estimateDriveMin(from: LatLng, to: LatLng): number {
  const km = (haversineM(from, to) / 1000) * ROAD_FACTOR;
  return Math.max(5, Math.round(((km / AVG_KMH) * 60 + 5) / 5) * 5);
}
