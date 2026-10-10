"use client";

import { useMemo } from "react";
import { hikeMinutes, planDay } from "@/lib/dayPlan";
import type { DayPlan } from "@/lib/dayPlan";
import { estimateDriveMin } from "@/lib/drive";
import type { DriveRoute } from "@/lib/drive";
import { useDriveRoute } from "@/lib/useDriveRoute";
import type { DriveStatus } from "@/lib/useDriveRoute";
import { useTripDay, useTripSettings } from "@/lib/tripSettings";
import { useUserLocation } from "@/lib/userLocation";
import type { LatLng } from "@/lib/types";

export interface TripPlan {
  plan: DayPlan | null;
  /** The day and departure planned for (null until hydrated). */
  date: string | null;
  time: string | null;
  /** Walking time for this group (kids pace applied). */
  hikeMin: number;
  /** One-way drive used in the plan; null without a start. */
  driveMin: number | null;
  /** driveMin is a straight-line estimate because routing failed. */
  driveApprox: boolean;
  driveStatus: DriveStatus;
  route: DriveRoute | null;
}

/** One trail's day, from the shared inputs (start, day, departure, kids). Cheap to call in several places. */
export function useTripPlan(sun: LatLng | null, destination: LatLng | null, baseHikeMin: number): TripPlan {
  const { start } = useUserLocation();
  const { withKids } = useTripSettings();
  const { date, time } = useTripDay();
  const drive = useDriveRoute(start, destination);
  const hikeMin = hikeMinutes(baseHikeMin, withKids);
  const driveApprox = drive.status === "error" && start !== null && destination !== null;
  const driveMin = drive.route?.durationMin ?? (driveApprox ? estimateDriveMin(start!, destination!) : null);

  const plan = useMemo(
    () => (date && time && sun ? planDay({ date, start: time, driveMin, hikeMin, location: sun }) : null),
    [date, time, driveMin, hikeMin, sun]
  );

  return { plan, date, time, hikeMin, driveMin, driveApprox, driveStatus: drive.status, route: drive.route };
}
