"use client";

import { useSyncExternalStore } from "react";
import { googleMapsUrl, googleWalkUrl, mapyUrl, mapyWalkUrl } from "@/lib/links";
import type { WalkRoute } from "@/lib/links";
import type { LatLng } from "@/lib/types";

type App = "google" | "mapy";

// The visitor's maps app, remembered in this browser for every trip.
const KEY = "mountour-maps-app";
const EVENT = "mountour-maps-app";

function readApp(): App {
  try {
    return localStorage.getItem(KEY) === "mapy" ? "mapy" : "google";
  } catch {
    return "google";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function pickApp(app: App) {
  try {
    localStorage.setItem(KEY, app);
  } catch {
    // Storage blocked: the pick lasts until the next render only.
  }
  window.dispatchEvent(new Event(EVENT));
}

const segBtn = (on: boolean) =>
  `rounded-[10px] px-2 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
    on ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
  }`;

const navButton =
  "flex-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-center text-sm font-semibold hover:border-[var(--accent)]";

/**
 * Hand-off to a maps app in two legs, because one Google Maps link carries one travel
 * mode: drive to the parking, then walk the trail from the car (or the stop).
 */
export function NavHandoff({
  drive,
  start,
  walkFrom,
  walk,
  join,
}: {
  /** Where the drive ends; null by train or bus (the timetable block hands that off). */
  drive: LatLng | null;
  start: LatLng | null;
  walkFrom: LatLng | null;
  walk: WalkRoute;
  join: LatLng | null;
}) {
  const app = useSyncExternalStore(subscribe, readApp, () => "google" as App);
  const canWalk = walkFrom !== null && walk.points.length > 1;
  if (!drive && !canWalk) return null;
  const google = app === "google";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Navigovať v</span>
        <div role="group" aria-label="Mapy na navigáciu" className="grid grid-cols-2 gap-[3px] rounded-xl bg-[var(--segment-bg)] p-[3px]">
          <button type="button" aria-pressed={google} onClick={() => pickApp("google")} className={segBtn(google)}>
            Google
          </button>
          <button type="button" aria-pressed={!google} onClick={() => pickApp("mapy")} className={segBtn(!google)}>
            Mapy.com
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        {drive && (
          <a
            href={google ? googleMapsUrl(drive) : mapyUrl(drive, start)}
            data-umami-event="nav_open"
            data-umami-event-app={app}
            target="_blank"
            rel="noopener noreferrer"
            className={navButton}
          >
            Na parkovisko
          </a>
        )}
        {canWalk && (
          <a
            href={google ? googleWalkUrl(walkFrom, walk, join) : mapyWalkUrl(walkFrom, walk, join)}
            data-umami-event="nav_open"
            data-umami-event-app={`${app}-walk`}
            target="_blank"
            rel="noopener noreferrer"
            className={navButton}
          >
            Po trase
          </a>
        )}
      </div>
      {canWalk && (
        <p className="text-xs text-[var(--muted)]">
          {google
            ? "Google vie po trase len 3 body a cestu medzi nimi si volí sám. Mapy.com idú po značených chodníkoch."
            : `Po trase ide po značených chodníkoch${walk.loop ? " celým okruhom" : " hore aj späť"} k ${drive ? "autu" : "zastávke"}.`}
        </p>
      )}
    </div>
  );
}
