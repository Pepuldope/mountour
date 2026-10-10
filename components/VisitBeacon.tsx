"use client";

import { useEffect } from "react";
import { COUNTED_HOSTS } from "@/lib/site";

/**
 * Tells the server "someone visited today" once per page load (see
 * app/api/visit/route.ts). Sends nothing in the body and stores nothing here.
 */
export function VisitBeacon() {
  useEffect(() => {
    if (!COUNTED_HOSTS.includes(window.location.host)) return;
    if (navigator.webdriver) return;
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
