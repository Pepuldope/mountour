"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";
import { reverseTown } from "@/lib/geocode";
import "@/lib/legacyStorage";

export interface UserFix {
  lat: number;
  lon: number;
  /** Horizontal accuracy radius in metres. */
  accuracy: number;
  /** The town the fix is in ("Pezinok"), once looked up. */
  town?: string | null;
}

/** Where the trip starts: a typed place wins over GPS. */
export interface StartPoint {
  lat: number;
  lon: number;
  label: string;
  source: "gps" | "manual";
}

export type LocationStatus = "idle" | "locating" | "ok" | "denied" | "unsupported" | "unavailable";

interface UserLocationState {
  status: LocationStatus;
  /** Stored start restored from this device (false during the first render). */
  ready: boolean;
  fix: UserFix | null;
  /** The trip's start: the typed place if any, else the GPS fix, else null. */
  start: StartPoint | null;
  /** Set (or clear with null) a typed start place. */
  setManualStart: (place: Omit<StartPoint, "source"> | null) => void;
  /** Slovak, user-facing; null when there is nothing to say. */
  message: string | null;
  locate: () => void;
  /** "Vybrať bod na mape": the next tap on the home map sets the start there. */
  picking: boolean;
  setPicking: (on: boolean) => void;
  /** A start anywhere on the map: named "Bod na mape" at once, then after the nearest village. */
  pickPoint: (lat: number, lon: number) => void;
}

const STORAGE_KEY = "turuj-user-fix";
// A typed start (usually home) is worth remembering across visits; a GPS fix is not.
const MANUAL_KEY = "turuj-start";

const MESSAGES: Partial<Record<LocationStatus, string>> = {
  locating: "Zisťujeme vašu polohu…",
  denied: "Prístup k polohe je zamietnutý. Stačí vybrať mesto.",
  unsupported: "Tento prehliadač nepodporuje polohu. Stačí vybrať mesto.",
  unavailable: "Polohu sa nepodarilo zistiť. Skúste znova alebo vyberte mesto.",
};

function readCached(): UserFix | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as UserFix;
    return Number.isFinite(v.lat) && Number.isFinite(v.lon) ? v : null;
  } catch {
    return null;
  }
}

function writeCached(fix: UserFix) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fix));
  } catch {
    // Private mode / storage blocked: the fix just won't survive navigation.
  }
}

function readManual(): Omit<StartPoint, "source"> | null {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Omit<StartPoint, "source">;
    return Number.isFinite(v.lat) && Number.isFinite(v.lon) && typeof v.label === "string" ? v : null;
  } catch {
    return null;
  }
}

function writeManual(place: Omit<StartPoint, "source"> | null) {
  try {
    if (place) localStorage.setItem(MANUAL_KEY, JSON.stringify(place));
    else localStorage.removeItem(MANUAL_KEY);
  } catch {
    // Storage blocked: the start just won't be remembered.
  }
}

const UserLocationContext = createContext<UserLocationState>({
  status: "idle",
  ready: false,
  fix: null,
  start: null,
  setManualStart: () => {},
  message: null,
  locate: () => {},
  picking: false,
  setPicking: () => {},
  pickPoint: () => {},
});

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [fix, setFix] = useState<UserFix | null>(null);
  const [manual, setManual] = useState<Omit<StartPoint, "source"> | null>(null);
  const [ready, setReady] = useState(false);
  const [picking, setPicking] = useState(false);
  // How the first start of this visit came about, for the "start_set" event.
  const startHow = useRef<"gps" | "manual" | "remembered" | null>(null);
  const startSent = useRef(false);

  // Restore after hydration (browser storage doesn't exist on the server).
  useEffect(() => {
    const restored = readManual();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManual(restored);
    const cached = readCached();
    if (restored || cached) startHow.current = "remembered";
    if (cached) {
      setFix(cached);
      setStatus("ok");
    }
    setReady(true);
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: UserFix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        writeCached(next);
        startHow.current = "gps";
        setFix(next);
        // Asking for GPS means "start from where I am": drop a typed place.
        writeManual(null);
        setManual(null);
        setStatus("ok");
        // Name the place, so the start reads "Pezinok" and can be shared without coordinates.
        reverseTown(next.lat, next.lon)
          .then((town) => {
            if (!town) return;
            const named = { ...next, town };
            writeCached(named);
            setFix((cur) => (cur === next ? named : cur));
          })
          .catch(() => {});
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const setManualStart = useCallback((place: Omit<StartPoint, "source"> | null) => {
    writeManual(place);
    if (place) startHow.current = "manual";
    setManual(place);
  }, []);

  const pickPoint = useCallback(
    (lat: number, lon: number) => {
      const point = { lat, lon, label: "Bod na mape" };
      setManualStart(point);
      setPicking(false);
      reverseTown(lat, lon)
        .then((town) => {
          if (!town) return;
          // Only if the start is still this point (not moved again meanwhile).
          setManual((cur) => {
            if (cur?.lat !== lat || cur?.lon !== lon) return cur;
            const named = { lat, lon, label: town };
            writeManual(named);
            return named;
          });
        })
        .catch(() => {});
    },
    [setManualStart]
  );

  const start = useMemo<StartPoint | null>(() => {
    if (manual) return { ...manual, source: "manual" };
    if (fix) return { lat: fix.lat, lon: fix.lon, label: fix.town ?? "Vaša poloha", source: "gps" };
    return null;
  }, [manual, fix]);

  // Activation: once per visit, the first time a start is known. Only how, never where.
  useEffect(() => {
    if (!start || startSent.current) return;
    startSent.current = true;
    const how = startHow.current ?? start.source;
    // Umami's script loads after hydration; give it a moment, as TrackEvent does.
    setTimeout(() => track("start_set", { how }), 1500);
  }, [start]);

  const value = useMemo<UserLocationState>(
    () => ({ status, ready, fix, start, setManualStart, message: MESSAGES[status] ?? null, locate, picking, setPicking, pickPoint }),
    [status, ready, fix, start, setManualStart, locate, picking, pickPoint]
  );

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation(): UserLocationState {
  return useContext(UserLocationContext);
}
