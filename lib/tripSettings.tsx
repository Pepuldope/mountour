"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isoDate } from "@/lib/days";

/** The trip inputs, shared by the home list and every trip page so nothing resets on navigation. */
export interface TripSettings {
  /** The picked day, YYYY-MM-DD; null = no day picked (home lists every trip). */
  date: string | null;
  /** Departure HH:MM chosen on a trip page; null = the default for the day. */
  time: string | null;
  /** "pol dňa": the whole outing fits in HALF_DAY_MIN. */
  halfDay: boolean;
  withKids: boolean;
}

interface TripSettingsState extends TripSettings {
  /** Today's date in the visitor's timezone; null until hydrated (the server has no "now"). */
  today: string | null;
  update: (patch: Partial<TripSettings>) => void;
}

const STORAGE_KEY = "mountour-trip-v2";
/** After this hour "now" makes a poor default departure: plan tomorrow morning instead. */
const LATE_HOUR = 15;
const MORNING = "08:00";

function pad(n: number) {
  return String(n).padStart(2, "0");
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

/** Default departure on a given day: soon if it's today, else 08:00. */
export function defaultTimeFor(date: string, now = new Date()): string {
  const soon = defaultDeparture(now);
  return soon.date === date ? soon.time : MORNING;
}

const DEFAULTS: TripSettings = { date: null, time: null, halfDay: false, withKids: false };

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

const TripSettingsContext = createContext<TripSettingsState>({ ...DEFAULTS, today: null, update: () => {} });

export function TripSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TripSettings>(DEFAULTS);
  const [today, setToday] = useState<string | null>(null);

  // "Now" and storage only exist in the browser: fill them in after hydration.
  useEffect(() => {
    const stored = readStored();
    const now = isoDate(new Date());
    // A stored day in the past is stale (tab left open overnight): forget it and its time.
    const stale = !!stored?.date && stored.date < now;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(now);
    setSettings({ ...DEFAULTS, ...stored, ...(stale ? { date: null, time: null } : {}) });
  }, []);

  const update = useCallback((patch: Partial<TripSettings>) => {
    setSettings((prev) => {
      // A new day resets a hand-picked departure: 08:00 on Saturday isn't 15:30 today.
      const next = { ...prev, ...patch };
      if (patch.date !== undefined && patch.date !== prev.date && patch.time === undefined) next.time = null;
      store(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...settings, today, update }), [settings, today, update]);
  return <TripSettingsContext.Provider value={value}>{children}</TripSettingsContext.Provider>;
}

export function useTripSettings(): TripSettingsState {
  return useContext(TripSettingsContext);
}

/**
 * The day and departure a trip page plans for: the picked day (else today, or
 * tomorrow when it's late) and the chosen time (else a sensible default).
 * Both null until hydrated.
 */
export function useTripDay(): { date: string | null; time: string | null; picked: boolean } {
  const { date, time, today } = useTripSettings();
  return useMemo(() => {
    if (!today) return { date: null, time: null, picked: false };
    const day = date ?? defaultDeparture().date;
    return { date: day, time: time ?? defaultTimeFor(day), picked: date !== null };
  }, [date, time, today]);
}
