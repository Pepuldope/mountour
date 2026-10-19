"use client";

import { TripCard } from "@/components/TripCard";
import { nearestStop } from "@/lib/data";
import { hikeMinutes } from "@/lib/dayPlan";
import type { TrailDetail } from "@/lib/types";

const noop = () => {};

/** A town page's trips as the same cards the home list uses, with the drive from that town. */
export function TownTripList({ trips }: { trips: { detail: TrailDetail; carMin: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {trips.map(({ detail, carMin }) => (
        <TripCard
          key={detail.trail.slug}
          item={{
            detail,
            hikeMin: hikeMinutes(detail.trail.duration_min, false),
            walkM: detail.trail.distance_m,
            ascentM: detail.trail.ascent_m,
            driveMin: carMin,
            carMin,
            driveApprox: false,
            driveLoading: false,
            distanceM: null,
            fit: null,
            closed: false,
            stop: null,
            nearStop: nearestStop(detail),
            noStop: false,
          }}
          dayWord={null}
          transit={false}
          active={false}
          onActive={noop}
          registerItem={noop}
        />
      ))}
    </div>
  );
}
