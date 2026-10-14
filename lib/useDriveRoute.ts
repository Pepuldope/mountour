"use client";

import { useEffect, useState } from "react";
import type { DriveRoute, TownDrives } from "@/lib/drive";
import { roundCoord } from "@/lib/drive";
import type { LatLng } from "@/lib/types";

export type DriveStatus = "idle" | "loading" | "ok" | "error";

// Shared across components so the map, the timeline and the list make one request each.
const cache = new Map<string, Promise<unknown>>();

/** One retry after a short pause when the router is busy or down (not for a bad request). */
function fetchJson<T>(url: string, retries = 1): Promise<T> {
  return fetch(url).then(
    (res) => {
      if (res.ok) return res.json() as Promise<T>;
      // Busy router (its per-minute limit): wait as long as the server says, up to 15 s.
      const wait = Math.min(15, Number(res.headers.get("Retry-After")) || 0) * 1000;
      if (res.status >= 500 && retries > 0) return pause(wait).then(() => fetchJson<T>(url, retries - 1));
      throw new Error(`${url} ${res.status}`);
    },
    (err) => (retries > 0 ? pause().then(() => fetchJson<T>(url, retries - 1)) : Promise.reject(err))
  );
}

const pause = (ms = 0) => new Promise((resolve) => setTimeout(resolve, Math.max(1500, ms)));

function load<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetchJson<T>(url);
    // A failure (offline, API down) shouldn't stick: drop it so a later render retries.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** Rounded (~100 m) so GPS jitter doesn't refetch, and the exact spot isn't sent anywhere. */
function pt(p: LatLng): string {
  return `${roundCoord(p.lat)},${roundCoord(p.lon)}`;
}

export function useCachedJson<T>(url: string | null): { status: DriveStatus; data: T | null } {
  const [state, setState] = useState<{ url: string | null; status: DriveStatus; data: T | null }>({
    url: null,
    status: "idle",
    data: null,
  });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    load<T>(url).then(
      (data) => !cancelled && setState({ url, status: "ok", data }),
      () => !cancelled && setState({ url, status: "error", data: null })
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return { status: "idle", data: null };
  if (state.url !== url) return { status: "loading", data: null };
  return { status: state.status, data: state.data };
}

/** A public place (parking, trail start): precise enough to tell parking spots 50 m apart. */
function place(p: LatLng): string {
  return `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
}

/** One drive, with geometry, for the trip page: from the visitor (rounded) to a parking (exact). */
export function useDriveRoute(
  from: LatLng | null,
  to: LatLng | null
): { status: DriveStatus; route: DriveRoute | null } {
  const url = from && to ? `/api/drive?from=${pt(from)}&to=${place(to)}` : null;
  const { status, data } = useCachedJson<DriveRoute>(url);
  return { status, route: data };
}

/** Drive times from one start to every trip (the home list), via the nearest precomputed town. */
export function useTownDrives(from: LatLng | null): { status: DriveStatus; drives: TownDrives | null } {
  const url = from ? `/api/drive-town?from=${pt(from)}` : null;
  const { status, data } = useCachedJson<TownDrives>(url);
  return { status, drives: data };
}

/** The walk from where the car stops to the trail start (both public places). */
export function useWalkRoute(
  from: LatLng | null,
  to: LatLng | null
): { status: DriveStatus; route: DriveRoute | null } {
  const url = from && to ? `/api/walk?from=${place(from)}&to=${place(to)}` : null;
  const { status, data } = useCachedJson<DriveRoute>(url);
  return { status, route: data };
}
