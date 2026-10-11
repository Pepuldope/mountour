"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { approachMin } from "@/lib/dayPlan";
import type { LatLng, ParkingLot } from "@/lib/types";

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
  approachMin: number;
}

const Ctx = createContext<TripAccess>({
  parkingLots: [],
  choice: 0,
  choose: () => {},
  parking: null,
  trailStart: null,
  destination: null,
  approachMin: 0,
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
  trailStart,
  children,
}: {
  slug: string;
  parkingLots: ParkingLot[];
  trailStart: LatLng | null;
  children: ReactNode;
}) {
  const stored = useSyncExternalStore(
    subscribe,
    () => readAll()[slug] ?? 0,
    () => 0
  );
  const choice = stored >= 0 && stored < parkingLots.length ? stored : 0;

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
    return {
      parkingLots,
      choice,
      choose,
      parking,
      trailStart,
      destination: parking?.location ?? trailStart,
      approachMin: parking ? approachMin(parking.walk_m) : 0,
    };
  }, [parkingLots, choice, choose, trailStart]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTripAccess(): TripAccess {
  return useContext(Ctx);
}
