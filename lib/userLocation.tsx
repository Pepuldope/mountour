"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { reverseTown } from "@/lib/geocode";

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
  fix: UserFix | null;
  /** The trip's start: the typed place if any, else the GPS fix, else null. */
  start: StartPoint | null;
  /** Set (or clear with null) a typed start place. */
  setManualStart: (place: Omit<StartPoint, "source"> | null) => void;
  /** Slovak, user-facing; null when there is nothing to say. */
  message: string | null;
  locate: () => void;
}

const STORAGE_KEY = "mountour-user-fix";
// A typed start (usually home) is worth remembering across visits; a GPS fix is not.
const MANUAL_KEY = "mountour-start";

const MESSAGES: Partial<Record<LocationStatus, string>> = {
  locating: "Zisťujem vašu polohu...",
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
  fix: null,
  start: null,
  setManualStart: () => {},
  message: null,
  locate: () => {},
});

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [fix, setFix] = useState<UserFix | null>(null);
  const [manual, setManual] = useState<Omit<StartPoint, "source"> | null>(null);

  // Restore after hydration (browser storage doesn't exist on the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManual(readManual());
    const cached = readCached();
    if (cached) {
      setFix(cached);
      setStatus("ok");
    }
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
    setManual(place);
  }, []);

  const start = useMemo<StartPoint | null>(() => {
    if (manual) return { ...manual, source: "manual" };
    if (fix) return { lat: fix.lat, lon: fix.lon, label: fix.town ?? "Vaša poloha", source: "gps" };
    return null;
  }, [manual, fix]);

  const value = useMemo<UserLocationState>(
    () => ({ status, fix, start, setManualStart, message: MESSAGES[status] ?? null, locate }),
    [status, fix, start, setManualStart, locate]
  );

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation(): UserLocationState {
  return useContext(UserLocationContext);
}
