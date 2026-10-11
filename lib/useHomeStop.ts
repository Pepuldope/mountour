"use client";

import { useEffect, useState } from "react";
import { nearestHomeStop } from "@/lib/stops";
import type { HomeStop } from "@/lib/stops";
import type { LatLng } from "@/lib/types";

/** The stop to leave from, near the start point (null while looking, or none within reach). */
export function useHomeStop(start: LatLng | null): HomeStop | null {
  const key = start ? `${start.lat.toFixed(4)},${start.lon.toFixed(4)}` : null;
  const [found, setFound] = useState<{ key: string; stop: HomeStop | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [lat, lon] = key.split(",").map(Number);
    nearestHomeStop({ lat, lon }).then((stop) => !cancelled && setFound({ key, stop }));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return found && found.key === key ? found.stop : null;
}
