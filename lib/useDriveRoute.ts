"use client";

import { useEffect, useState } from "react";
import type { DriveRoute } from "@/lib/drive";
import { driveKey } from "@/lib/drive";
import type { LatLng } from "@/lib/types";

export type DriveStatus = "idle" | "loading" | "ok" | "error";

// Shared across components so the map and the timeline make one request.
const cache = new Map<string, Promise<DriveRoute>>();

function load(from: LatLng, to: LatLng): Promise<DriveRoute> {
  const key = driveKey(from, to);
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/drive?from=${from.lat},${from.lon}&to=${to.lat},${to.lon}`).then((res) => {
      if (!res.ok) throw new Error(`drive ${res.status}`);
      return res.json() as Promise<DriveRoute>;
    });
    // A failure (offline, API down) shouldn't stick: drop it so a later render retries.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useDriveRoute(
  from: LatLng | null,
  to: LatLng | null
): { status: DriveStatus; route: DriveRoute | null } {
  const key = from && to ? driveKey(from, to) : null;
  const [state, setState] = useState<{ key: string | null; status: DriveStatus; route: DriveRoute | null }>({
    key: null,
    status: "idle",
    route: null,
  });

  useEffect(() => {
    if (!from || !to || !key) return;
    let cancelled = false;
    load(from, to).then(
      (route) => !cancelled && setState({ key, status: "ok", route }),
      () => !cancelled && setState({ key, status: "error", route: null })
    );
    return () => {
      cancelled = true;
    };
    // `from`/`to` are tracked through `key` (rounded), so GPS jitter doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { status: "idle", route: null };
  if (state.key !== key) return { status: "loading", route: null };
  return { status: state.status, route: state.route };
}
