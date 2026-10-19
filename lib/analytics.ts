import { COUNTED_HOSTS } from "@/lib/site";

// Product events sent to Umami (see components/Analytics.tsx). Umami sets no
// cookies and stores nothing on the device. Never put coordinates, typed
// places or anything personal into event data: a trail slug is the most.

/** Every event name in one place, so the dashboard stays tidy. */
export type AnalyticsEvent =
  | "start_set" // a start is known: GPS, a typed place, or one remembered from an earlier visit
  | "trip_open" // a trip page was viewed
  | "trip_saved" // "Uložiť výlet" tapped
  | "share" // "Poslať partii" tapped
  | "share_sent" // the share sheet sent it, or the text was copied
  | "shared_open" // a friend opened a shared plan link
  | "gpx_download" // "Stiahnuť GPX trasu" tapped
  | "nav_open" // hand-off to Google Maps / a map app
  | "transit_open" // cp.sk link opened
  | "tester_signup_open"; // "Chcem testovať" footer link tapped

type EventData = Record<string, string | number | boolean>;

/** Also added to our own monthly totals (app/api/event, lib/eventCounts.ts), since Umami's free plan has no export. */
const KEPT: ReadonlySet<AnalyticsEvent> = new Set(["start_set", "trip_saved", "share_sent", "shared_open", "nav_open"]);

declare global {
  interface Window {
    umami?: { track: (name: string, data?: EventData) => void };
  }
}

/**
 * How long since the visitor landed, as a coarse bucket ("0-2 min"), for the
 * "plan sent within two minutes" goal. Read from the page's own clock, which
 * keeps running across in-app navigation and stores nothing on the device.
 */
export function sinceArrival(): string {
  if (typeof performance === "undefined") return "unknown";
  const min = performance.now() / 60_000;
  if (min < 2) return "0-2 min";
  if (min < 5) return "2-5 min";
  if (min < 15) return "5-15 min";
  return "15+ min";
}

/** Send one event. Silently does nothing when Umami isn't loaded or is blocked. */
export function track(name: AnalyticsEvent, data?: EventData): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(name, data);
    if (KEPT.has(name) && COUNTED_HOSTS.includes(window.location.host) && !navigator.webdriver) {
      const detail = data?.took ?? data?.how ?? "";
      const body = JSON.stringify({ name, detail });
      if (!navigator.sendBeacon?.("/api/event", body)) {
        fetch("/api/event", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    }
  } catch {
    // Analytics must never break the app.
  }
}
