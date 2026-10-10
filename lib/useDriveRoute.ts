"use client";

import { useEffect, useState } from "react";
import type { DriveMatrix, DriveRoute } from "@/lib/drive";
import { roundCoord } from "@/lib/drive";
import type { LatLng } from "@/lib/types";

export type DriveStatus = "idle" | "loading" | "ok" | "error";

// Shared across components so the map, the timeline and the list make one request each.
const cache = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      return res.json() as Promise<T>;
    });
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

function useCachedJson<T>(url: string | null): { status: DriveStatus; data: T | null } {
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

/** One drive, with geometry, for the trip page. */
export function useDriveRoute(
  from: LatLng | null,
  to: LatLng | null
): { status: DriveStatus; route: DriveRoute | null } {
  const url = from && to ? `/api/drive?from=${pt(from)}&to=${pt(to)}` : null;
  const { status, data } = useCachedJson<DriveRoute>(url);
  return { status, route: data };
}

/** Drive times from one start to many destinations (the home list), in one request. */
export function useDriveMatrix(
  from: LatLng | null,
  to: LatLng[]
): { status: DriveStatus; matrix: DriveMatrix | null } {
  const url = from && to.length > 0 ? `/api/drive-matrix?from=${pt(from)}&to=${to.map(pt).join("|")}` : null;
  const { status, data } = useCachedJson<DriveMatrix>(url);
  return { status, matrix: data };
}
