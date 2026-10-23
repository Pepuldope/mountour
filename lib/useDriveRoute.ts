"use client";

import { useEffect, useMemo, useState } from "react";
import type { DriveRoute, TownDrives } from "@/lib/drive";
import { roundCoord } from "@/lib/drive";
import { nearestTown } from "@/lib/trips";
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
  useEffect(() => {
    if (from && to && data) rememberDrive(from, to, data.durationMin);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return { status, route: data };
}

// Drives the trip page worked out, so the home list shows the same minutes for trips already opened
// (its own numbers are estimates from the weekly town tables). Rounded start, so no exact home address.
const KNOWN_KEY = "mountour-drives";
const KNOWN_MAX = 300;

function readKnown(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KNOWN_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

let known: Record<string, number> | null = null;

function rememberDrive(from: LatLng, to: LatLng, min: number) {
  known ??= readKnown();
  const key = `${pt(from)}|${place(to)}`;
  if (known[key] === min) return;
  delete known[key];
  known[key] = min;
  const keys = Object.keys(known);
  for (const k of keys.slice(0, Math.max(0, keys.length - KNOWN_MAX))) delete known[k];
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(known));
  } catch {
    // Storage blocked: the home list keeps its estimates.
  }
}

/** The trip page's drive for this start and parking, if it was opened from here. */
export function knownDriveMin(from: LatLng, to: LatLng): number | null {
  if (typeof window === "undefined") return null;
  known ??= readKnown();
  return known[`${pt(from)}|${place(to)}`] ?? null;
}

/**
 * Drive times from one start to every trip (the home list), via the nearest precomputed town:
 * its weekly table straight from the static files, so a home visit costs no database reads.
 */
export function useTownDrives(from: LatLng | null): { status: DriveStatus; drives: TownDrives | null } {
  const town = from ? nearestTown({ lat: roundCoord(from.lat), lon: roundCoord(from.lon) }) : null;
  const { status, data } = useCachedJson<{ minutes: TownDrives["minutes"] }>(town ? `/data/drive/${town.id}.json` : null);
  const drives = useMemo(
    () => (town && data ? { town: { name: town.name, lat: town.location.lat, lon: town.location.lon }, minutes: data.minutes } : null),
    [town, data]
  );
  return { status, drives };
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

/**
 * Several short walks at once (the side trips to added stops): each pair's route, or null while it
 * loads or when the router fails (the map then draws a straight line).
 */
export function useWalkRoutes(pairs: [LatLng, LatLng][]): (DriveRoute | null)[] {
  const urls = pairs.map(([from, to]) => `/api/walk?from=${place(from)}&to=${place(to)}`);
  const key = urls.join("|");
  const [done, setDone] = useState<Record<string, DriveRoute | null>>({});
  useEffect(() => {
    let cancelled = false;
    for (const url of key ? key.split("|") : []) {
      load<DriveRoute>(url).then(
        (route) => !cancelled && setDone((d) => ({ ...d, [url]: route })),
        () => !cancelled && setDone((d) => ({ ...d, [url]: null }))
      );
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return useMemo(() => (key ? key.split("|") : []).map((u) => done[u] ?? null), [key, done]);
}
