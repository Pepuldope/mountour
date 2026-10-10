// Product events sent to Umami (see components/Analytics.tsx). Umami sets no
// cookies and stores nothing on the device. Never put coordinates, typed
// places or anything personal into event data: a trail slug is the most.

/** Every event name in one place, so the dashboard stays tidy. */
export type AnalyticsEvent =
  | "trip_open" // a trip page was viewed
  | "trip_saved" // "Uložiť výlet" tapped
  | "share" // plan shared with the group
  | "nav_open" // hand-off to Google Maps / a map app
  | "transit_open" // cp.sk link opened
  | "tester_signup_open" // tester sign-up form opened
  | "feedback_open"; // post-test feedback form opened

type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (name: string, data?: EventData) => void };
  }
}

/** Send one event. Silently does nothing when Umami isn't loaded or is blocked. */
export function track(name: AnalyticsEvent, data?: EventData): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }
}
