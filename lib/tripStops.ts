"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Poi, PoiKind } from "@/lib/types";

/**
 * Stops the group adds to a trip (a buffet, a viewpoint up a side path, a lunch break), kept per
 * trail on this device. Each stop carries its minutes, so the plan adds them without the place list.
 */
export interface TripStop {
  /** The place's id on the trip page ("<slug>:poi:<i>"), or LUNCH. */
  id: string;
  name: string;
  /** Side trip there and back plus the time spent there. */
  min: number;
}

export const LUNCH: TripStop = { id: "obed", name: "Obed", min: 30 };

/** Time spent at a place, on top of getting there. */
export const STAY_MIN: Record<PoiKind, number> = {
  obcerstvenie: 30,
  chata: 30,
  hrad: 30,
  utulna: 10,
  vyhliadka: 10,
  pramen: 5,
  ihrisko: 20,
};

export function stopFor(p: Poi): TripStop {
  return {
    id: p.id,
    name: p.name,
    min: (p.detour_min ?? 0) + STAY_MIN[p.kind],
  };
}

const KEY = "mountour-stops";
const EVENT = "mountour-stops";
type All = Record<string, TripStop[]>;
const NONE: TripStop[] = [];

let cachedRaw: string | null = null;
let cachedAll: All = {};

function readAll(): All {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cachedAll;
  }
  // Same string -> same object, so useSyncExternalStore doesn't loop.
  if (raw === cachedRaw) return cachedAll;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    cachedAll =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as All)
        : {};
  } catch {
    cachedAll = {};
  }
  return cachedAll;
}

function write(all: All) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the stops last until the page closes.
    cachedRaw = null;
    cachedAll = all;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export const stopsMinutes = (stops: TripStop[]) =>
  stops.reduce((sum, s) => sum + s.min, 0);

export function useTripStops(slug: string | null) {
  const stops = useSyncExternalStore(
    subscribe,
    () => (slug ? (readAll()[slug] ?? NONE) : NONE),
    () => NONE,
  );

  const toggle = useCallback(
    (stop: TripStop) => {
      if (!slug) return;
      const all = readAll();
      const now = all[slug] ?? [];
      const next = now.some((s) => s.id === stop.id)
        ? now.filter((s) => s.id !== stop.id)
        : [...now, stop];
      const { [slug]: _, ...rest } = all; // eslint-disable-line @typescript-eslint/no-unused-vars
      write(next.length ? { ...rest, [slug]: next } : rest);
    },
    [slug],
  );

  const has = useCallback(
    (id: string) => stops.some((s) => s.id === id),
    [stops],
  );
  return { stops, toggle, has, minutes: stopsMinutes(stops) };
}
