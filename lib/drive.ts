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
