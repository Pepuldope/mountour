"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface UserFix {
  lat: number;
  lon: number;
  /** Horizontal accuracy radius in metres. */
  accuracy: number;
}

export type LocationStatus = "idle" | "locating" | "ok" | "denied" | "unsupported" | "unavailable";

interface UserLocationState {
  status: LocationStatus;
  fix: UserFix | null;
  /** Slovak, user-facing; null when there is nothing to say. */
  message: string | null;
  locate: () => void;
}

const STORAGE_KEY = "mountour-user-fix";

const MESSAGES: Partial<Record<LocationStatus, string>> = {
  locating: "Zisťujem tvoju polohu...",
  denied: "Prístup k polohe je zamietnutý. Zadaj miesto výletu ručne.",
  unsupported: "Tento prehliadač nepodporuje zisťovanie polohy. Zadaj miesto ručne.",
  unavailable: "Polohu sa nepodarilo zistiť. Skús to znova alebo zadaj miesto ručne.",
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

const UserLocationContext = createContext<UserLocationState>({
  status: "idle",
  fix: null,
  message: null,
  locate: () => {},
});

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [fix, setFix] = useState<UserFix | null>(null);

  // Restore the last fix after hydration (sessionStorage doesn't exist on the server).
  useEffect(() => {
    const cached = readCached();
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setStatus("ok");
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const value = useMemo<UserLocationState>(
    () => ({ status, fix, message: MESSAGES[status] ?? null, locate }),
    [status, fix, locate]
  );

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation(): UserLocationState {
  return useContext(UserLocationContext);
}
