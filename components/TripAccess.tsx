"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { approachMin } from "@/lib/dayPlan";
import { useTripSettings } from "@/lib/tripSettings";
import type { TrailJoin } from "@/lib/trailJoin";
import type { LatLng, ParkingLot, TransitStop } from "@/lib/types";

/**
 * How the car reaches the trail on the trip page: which parking the visitor
 * picked, where the drive ends and how far it is on foot to the start. The
 * plan, the map, the parking card and the navigation buttons all read it, so
 * picking another parking updates all of them at once.
 */
export interface TripAccess {
  parkingLots: ParkingLot[];
  /** Index into parkingLots; 0 = our default (nearest good one). */
  choice: number;
  choose: (index: number) => void;
  parking: ParkingLot | null;
  /** Where the walk starts: the trail's first point. */
  trailStart: LatLng | null;
  /** Where the drive ends: the chosen parking, else the trail start (routing snaps it to the nearest road). */
  destination: LatLng | null;
  /** Parking -> trail start on foot, one way, minutes (0 when close or no parking). */
  parkingApproachMin: number;
  /** Nearest public-transport stop to the trail start. */
  stop: TransitStop | null;
  /** By car: the drive goes on. By train/bus: no drive, the walk starts at the stop. */
  transit: boolean;
  /** Where the walk to the trail starts: the chosen parking, or the stop. */
  walkFrom: LatLng | null;
  /** Walk to the trail for the chosen way of travel, one way, minutes. */
  approachMin: number;
  /** Where that walk reaches the trail: its start, or its nearest point when parked up the trail. */
  trailJoin: LatLng | null;
  /** Parked or got off up the trail: the part of the walk skipped (null = the whole trail). */
  skip: Pick<TrailJoin, "skip_out" | "skip_back" | "skip_m" | "skip_ascent_m"> | null;
}

const Ctx = createContext<TripAccess>({
  parkingLots: [],
  choice: 0,
  choose: () => {},
  parking: null,
  trailStart: null,
  destination: null,
  parkingApproachMin: 0,
  stop: null,
  transit: false,
  walkFrom: null,
  approachMin: 0,
  trailJoin: null,
  skip: null,
});

// The pick is remembered per trip for this browser session (back and forth between pages).
const KEY = "mountour-parking";
const EVENT = "mountour-parking";

function readAll(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function TripAccessProvider({
  slug,
  parkingLots,
  transitStops,
  trailStart,
  children,
}: {
  slug: string;
  parkingLots: ParkingLot[];
  transitStops: TransitStop[];
  trailStart: LatLng | null;
  children: ReactNode;
}) {
  const stored = useSyncExternalStore(
    subscribe,
    () => readAll()[slug] ?? 0,
    () => 0
  );
  const choice = stored >= 0 && stored < parkingLots.length ? stored : 0;
  const transit = useTripSettings().travel === "transit";

  const choose = useCallback(
    (index: number) => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ ...readAll(), [slug]: index }));
      } catch {
        // Storage blocked: the pick lasts until the next render only.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [slug]
  );

  const value = useMemo<TripAccess>(() => {
    const parking = parkingLots[choice] ?? null;
    const stop = [...transitStops].sort((a, b) => a.distance_m - b.distance_m)[0] ?? null;
    const parkingApproach = parking ? approachMin(parking.join?.walk_m ?? parking.walk_m) : 0;
    const stopApproach = stop ? approachMin(stop.join?.walk_m ?? stop.distance_m) : 0;
    const join = transit ? (stop?.join ?? null) : (parking?.join ?? null);
    return {
      parkingLots,
      choice,
      choose,
      parking,
      trailStart,
      destination: transit ? null : (parking?.location ?? trailStart),
      parkingApproachMin: parkingApproach,
      stop,
      transit,
      walkFrom: transit ? (stop?.location ?? null) : (parking?.location ?? null),
      approachMin: transit ? stopApproach : parkingApproach,
      trailJoin: join?.location ?? trailStart,
      skip: join && join.skip_m > 0 ? join : null,
    };
  }, [parkingLots, transitStops, choice, choose, trailStart, transit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTripAccess(): TripAccess {
  return useContext(Ctx);
}
