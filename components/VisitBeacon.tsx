"use client";

import { useEffect } from "react";
import { applyOptOut, countsHere } from "@/lib/analytics";

/**
 * Tells the server "someone visited today" once per page load (see
 * app/api/visit/route.ts). Sends nothing in the body. Also where "?nepocitat=1"
 * switches counting off for this browser (lib/analytics.ts).
 */
export function VisitBeacon() {
  useEffect(() => {
    applyOptOut();
    if (!countsHere()) return;
    try {
      if (!navigator.sendBeacon?.("/api/visit")) {
        fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {});
      }
    } catch {
      // Counting must never break the app.
    }
  }, []);

  return null;
}
