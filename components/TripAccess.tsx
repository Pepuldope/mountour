"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { approachMin } from "@/lib/dayPlan";
import { useTripSettings } from "@/lib/tripSettings";
import type { TrailJoin } from "@/lib/trailJoin";
import type { WalkLine } from "@/lib/tripSchema";
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
  /** Where the ride from the start ends: the parking by car, the stop by train or bus. */
  rideTo: LatLng | null;
  /** Where the walk starts: the trail's first point. */
  trailStart: LatLng | null;
  /** Where the drive ends: the chosen parking, else the trail start (routing snaps it to the nearest road). */
  destination: LatLng | null;
  /** Parking -> trail start on foot, one way, minutes (0 when close or no parking). */
  parkingApproachMin: number;
  /** Stops near the trail, nearest walk first. */
  stops: TransitStop[];
  /** Index into stops; 0 = the nearest. */
  stopChoice: number;
  chooseStop: (index: number) => void;
  /** The picked stop (by default the nearest). */
  stop: TransitStop | null;
  /** By car: the drive goes on. By train/bus: an estimated ride to the stop, the walk starts there. */
  transit: boolean;
  /** No car park at this start, only a stop: bus or train whatever the remembered choice. */
  noCar: boolean;
  /** Where the walk to the trail starts: the chosen parking, or the stop. */
  walkFrom: LatLng | null;
  /** That walk on paths, worked out weekly (null: none stored, ask the router). */
  walkLine: WalkLine | null;
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
  rideTo: null,
  parkingApproachMin: 0,
  stops: [],
  stopChoice: 0,
  chooseStop: () => {},
  stop: null,
  transit: false,
  noCar: false,
  walkFrom: null,
  walkLine: null,
  approachMin: 0,
  trailJoin: null,
  skip: null,
});

// Picks are remembered per trip for this browser session (back and forth between pages).
const PARKING_KEY = "mountour-parking";
const STOP_KEY = "mountour-stop";
const EVENT = "mountour-parking";

function readAll(key: string): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Which of `count` options is picked for this trip (0 = our default), and a setter. */
function usePick(key: string, slug: string, count: number): [number, (index: number) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => readAll(key)[slug] ?? 0,
    () => 0
  );
  const pick = useCallback(
    (index: number) => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ ...readAll(key), [slug]: index }));
      } catch {
        // Storage blocked: the pick lasts until the next render only.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key, slug]
  );
  return [stored >= 0 && stored < count ? stored : 0, pick];
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
  const [choice, choose] = usePick(PARKING_KEY, slug, parkingLots.length);
  // Nearest walk to the trail first (a stop up the trail counts from where it joins).
  const stops = useMemo(
    () => [...transitStops].sort((a, b) => (a.join?.walk_m ?? a.distance_m) - (b.join?.walk_m ?? b.distance_m)),
    [transitStops]
  );
  const [stopChoice, chooseStop] = usePick(STOP_KEY, slug, stops.length);
  // Without a car park the bus is the only way; the remembered choice stays as it is for other trips.
  const noCar = parkingLots.length === 0 && transitStops.length > 0;
  const { travel } = useTripSettings();
  const transit = noCar || travel === "transit";

  const value = useMemo<TripAccess>(() => {
    const parking = parkingLots[choice] ?? null;
    const stop = stops[stopChoice] ?? null;
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
      rideTo: transit ? (stop?.location ?? null) : (parking?.location ?? trailStart),
      parkingApproachMin: parkingApproach,
      stops,
      stopChoice,
      chooseStop,
      stop,
      transit,
      noCar,
      walkFrom: transit ? (stop?.location ?? null) : (parking?.location ?? null),
      walkLine: transit ? (stop?.walk ?? null) : (parking?.walk ?? null),
      approachMin: transit ? stopApproach : parkingApproach,
      trailJoin: join?.location ?? trailStart,
      skip: join && join.skip_m > 0 ? join : null,
    };
  }, [parkingLots, stops, choice, choose, stopChoice, chooseStop, trailStart, transit, noCar]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTripAccess(): TripAccess {
  return useContext(Ctx);
}
