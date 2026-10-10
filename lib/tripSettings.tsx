"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** The trip inputs, shared by the home list and every trip page so nothing resets on navigation. */
export interface TripSettings {
  /** Local date YYYY-MM-DD; null until hydrated. */
  date: string | null;
  /** Local HH:MM: departure (or hike start without a known drive); null until hydrated. */
  time: string | null;
  /** Whole-day time budget in hours (drive there + hike + drive back). */
  hours: number;
  withKids: boolean;
}

interface TripSettingsState extends TripSettings {
  update: (patch: Partial<TripSettings>) => void;
}

const STORAGE_KEY = "mountour-trip";
/** After this hour "now" makes a poor default departure: suggest tomorrow morning instead. */
const LATE_HOUR = 15;
const MORNING = "08:00";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Now rounded up to the next quarter hour, or tomorrow 08:00 when it's already late. */
export function defaultDeparture(now = new Date()): { date: string; time: string } {
  const d = new Date(Math.ceil(now.getTime() / (15 * 60000)) * 15 * 60000);
  if (d.getHours() >= LATE_HOUR || d.getDate() !== now.getDate()) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { date: isoDate(tomorrow), time: MORNING };
  }
  return { date: isoDate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

const DEFAULTS: TripSettings = { date: null, time: null, hours: 6, withKids: false };

function readStored(): Partial<TripSettings> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<TripSettings>) : null;
  } catch {
    return null;
  }
}

function store(s: TripSettings) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: settings just reset on reload.
  }
}

const TripSettingsContext = createContext<TripSettingsState>({ ...DEFAULTS, update: () => {} });

export function TripSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TripSettings>(DEFAULTS);

  // "Now" and storage only exist in the browser: fill them in after hydration.
  useEffect(() => {
    const stored = readStored();
    const fallback = defaultDeparture();
    // A stored date in the past is stale (tab left open overnight): start fresh.
    const staleDate = !stored?.date || stored.date < isoDate(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings({
      ...DEFAULTS,
      ...stored,
      date: staleDate ? fallback.date : stored!.date!,
      time: staleDate || !stored?.time ? fallback.time : stored.time,
    });
  }, []);

  const update = useCallback((patch: Partial<TripSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      store(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...settings, update }), [settings, update]);
  return <TripSettingsContext.Provider value={value}>{children}</TripSettingsContext.Provider>;
}

export function useTripSettings(): TripSettingsState {
  return useContext(TripSettingsContext);
}
