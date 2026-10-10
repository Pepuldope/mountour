"use client";

import { useMemo } from "react";
import { planDay } from "@/lib/dayPlan";
import type { DayPlan } from "@/lib/dayPlan";
import type { DriveRoute } from "@/lib/drive";
import { useDriveRoute } from "@/lib/useDriveRoute";
import type { DriveStatus } from "@/lib/useDriveRoute";
import { useTripSettings } from "@/lib/tripSettings";
import { useUserLocation } from "@/lib/userLocation";
import type { LatLng } from "@/lib/types";

export interface TripPlan {
  plan: DayPlan | null;
  driveStatus: DriveStatus;
  route: DriveRoute | null;
}

/** One trail's day, from the shared inputs (start, date, departure). Cheap to call in several places. */
export function useTripPlan(sun: LatLng | null, destination: LatLng | null, hikeMin: number): TripPlan {
  const { start } = useUserLocation();
  const { date, time } = useTripSettings();
  const drive = useDriveRoute(start, destination);
  const driveMin = drive.route?.durationMin ?? null;

  const plan = useMemo(
    () => (date && time && sun ? planDay({ date, start: time, driveMin, hikeMin, location: sun }) : null),
    [date, time, driveMin, hikeMin, sun]
  );

  return { plan, driveStatus: drive.status, route: drive.route };
}
