"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/** Sends one analytics event when it mounts (e.g. "trip_open" on a trip page). */
export function TrackEvent({ name, data }: { name: AnalyticsEvent; data?: Record<string, string> }) {
  const key = JSON.stringify(data ?? {});
  useEffect(() => {
    // Umami's script loads after hydration; give it a moment before sending.
    const timer = setTimeout(() => track(name, JSON.parse(key)), 1500);
    return () => clearTimeout(timer);
  }, [name, key]);

  return null;
}
