"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LatLng } from "@/lib/types";

/**
 * A saved trip: one trail + the day it's planned for, kept on this device only
 * (no accounts). Snapshots everything the saved-trips page needs, so it renders
 * offline without the trail database.
 */
export interface SavedTrip {
  slug: string;
  name: string;
  date: string;
  time: string;
  start: { lat: number; lon: number; label: string } | null;
  /** One-way drive at save time; null without a start. */
  driveMin: number | null;
  hikeMin: number;
  sun: LatLng;
  savedAt: string;
  /** Offline copy state: the page, GPX and map tiles. */
  offline: "ok" | "failed" | "pending";
}

const KEY = "mountour-saved-trips";
const EVENT = "mountour-saved-trips";
const EMPTY: SavedTrip[] = [];

let cachedRaw: string | null = null;
let cachedList: SavedTrip[] = EMPTY;

function read(): SavedTrip[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  // Same string -> same array, so useSyncExternalStore doesn't loop.
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as SavedTrip[]) : EMPTY;
    cachedList = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(list: SavedTrip[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full / blocked: nothing we can do; the UI keeps the old list.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export const tripCacheName = (slug: string) => `mountour-trip-${slug}`;

export function useSavedTrips() {
  const trips = useSyncExternalStore(subscribe, read, () => EMPTY);

  /** One saved entry per trail: saving again replaces it. Newest first. */
  const save = useCallback((trip: SavedTrip) => {
    write([trip, ...read().filter((t) => t.slug !== trip.slug)]);
  }, []);

  const patch = useCallback((slug: string, change: Partial<SavedTrip>) => {
    write(read().map((t) => (t.slug === slug ? { ...t, ...change } : t)));
  }, []);

  const remove = useCallback(async (slug: string) => {
    write(read().filter((t) => t.slug !== slug));
    try {
      await caches.delete(tripCacheName(slug));
    } catch {
      // No Cache API (old browser / insecure context): only the record is removed.
    }
  }, []);

  return { trips, save, patch, remove };
}
