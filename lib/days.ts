/**
 * Days and daylight for the home list: the day chips, Slovak day names, and
 * "does this trip fit that day's daylight?" Pure, so it is unit tested.
 */
import { SAFE_MARGIN_MIN } from "@/lib/dayPlan";
import { getSunTimes } from "@/lib/sun";
import type { LatLng } from "@/lib/types";
import { wallClock, zonedDate } from "@/lib/zoned";

const MIN = 60000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** The Slovak calendar date of an instant, YYYY-MM-DD. */
export function isoDate(d: Date): string {
  const w = wallClock(d);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
}

/** A calendar date as UTC midnight: only for its weekday and day numbers (getUTC*), never a clock time. */
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function calendarIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The calendar date `n` days after `iso`. */
export function addDaysIso(iso: string, n: number): string {
  const d = parseIso(iso);
  return calendarIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n)));
}

/** Whole calendar days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}

const WEEKDAY = ["nedeľa", "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota"];
/** "v sobotu", "vo štvrtok": the form used in sentences. */
const WEEKDAY_IN = ["v nedeľu", "v pondelok", "v utorok", "v stredu", "vo štvrtok", "v piatok", "v sobotu"];
const WEEKDAY_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];

export interface DayChip {
  iso: string;
  label: string;
}

/** Dnes, Zajtra, then the coming Saturday and Sunday unless they are already on the list. */
export function dayChips(now: Date): DayChip[] {
  const today = isoDate(now);
  const chips: DayChip[] = [
    { iso: today, label: "Dnes" },
    { iso: addDaysIso(today, 1), label: "Zajtra" },
  ];
  for (const weekday of [6, 0]) {
    const ahead = (weekday - parseIso(today).getUTCDay() + 7) % 7;
    const iso = addDaysIso(today, ahead);
    if (!chips.some((c) => c.iso === iso)) chips.push({ iso, label: WEEKDAY_SHORT[weekday] });
  }
  return chips;
}

export interface StripDay {
  iso: string;
  /** "So" */
  weekday: string;
  /** Day of the month. */
  day: number;
  weekend: boolean;
}

/** The days after tomorrow, for the "iný deň" strip (Dnes and Zajtra have their own buttons). */
export function dayStrip(now: Date, count = 14): StripDay[] {
  const today = isoDate(now);
  return Array.from({ length: count }, (_, i) => {
    const iso = addDaysIso(today, i + 2);
    const d = parseIso(iso);
    return { iso, weekday: WEEKDAY_SHORT[d.getUTCDay()], day: d.getUTCDate(), weekend: d.getUTCDay() % 6 === 0 };
  });
}

/** "So 17. 10." */
export function shortDay(iso: string): string {
  return `${WEEKDAY_SHORT[parseIso(iso).getUTCDay()]} ${shortDate(iso)}`;
}

/** "17. 10." */
export function shortDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`;
}

/** "sobota 17. 10." */
export function longDay(iso: string): string {
  return `${WEEKDAY[parseIso(iso).getUTCDay()]} ${shortDate(iso)}`;
}

/** After "na": "nedeľu 18. 10." ("Uložené na nedeľu 18. 10."). */
export function dayAfterNa(iso: string): string {
  return `${WEEKDAY_IN[parseIso(iso).getUTCDay()].replace(/^vo? /, "")} ${shortDate(iso)}`;
}

/** For sentences: "dnes", "zajtra", "v sobotu", or "v pondelok 19. 10." further out. */
export function dayInSentence(iso: string, now: Date): string {
  const today = isoDate(now);
  if (iso === today) return "dnes";
  if (iso === addDaysIso(today, 1)) return "zajtra";
  const weekday = WEEKDAY_IN[parseIso(iso).getUTCDay()];
  const days = daysBetween(today, iso);
  return days > 0 && days < 7 ? weekday : `${weekday} ${shortDate(iso)}`;
}

/** Departure times are shown rounded down to 5 min: "14:55", never a later "14:58". */
export function floorTo5(d: Date): Date {
  const step = 5 * MIN;
  return new Date(Math.floor(d.getTime() / step) * step);
}

export type FitStatus =
  /** Fits: you can still leave at or before `latest`. */
  | "fits"
  /** Today only: the latest departure has already passed. */
  | "too-late"
  /** Doesn't fit this day's daylight even leaving at sunrise. */
  | "too-long"
  /** Fits on paper, but only by leaving before EARLIEST_DEPARTURE_HOUR. */
  | "too-early";

/** Nobody leaves for a day trip at 3 a.m.: earlier latest departures don't count as fitting. */
export const EARLIEST_DEPARTURE_HOUR = 5;

export interface DayFit {
  status: FitStatus;
  /** Latest departure (hike start when the drive is unknown) that ends the hike SAFE_MARGIN_MIN before sunset. */
  latest: Date;
  sunset: Date;
}

export interface DayFitInput {
  /** YYYY-MM-DD */
  date: string;
  now: Date;
  /** One-way drive in minutes; null when unknown. */
  driveMin: number | null;
  hikeMin: number;
  location: LatLng;
}

/**
 * Does the trip fit the day's daylight? Today is strict (the latest departure
 * must still be ahead of us); other days only need the hike to fit between
 * sunrise and SAFE_MARGIN_MIN before sunset, because people plan ahead and can
 * leave early.
 */
export function dayFit({ date, now, driveMin, hikeMin, location }: DayFitInput): DayFit | null {
  const day = parseIso(date);
  if (Number.isNaN(day.getTime())) return null;
  const sun = getSunTimes(day, location.lat, location.lon);
  if (!sun) return null;
  const drive = driveMin ?? 0;
  const latest = floorTo5(new Date(sun.sunset.getTime() - (SAFE_MARGIN_MIN + hikeMin + drive) * MIN));
  const earliest = new Date(sun.sunrise.getTime() - drive * MIN);

  let status: FitStatus = "fits";
  if (latest < earliest) status = "too-long";
  else if (latest < zonedDate(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), EARLIEST_DEPARTURE_HOUR)) status = "too-early";
  else if (date === isoDate(now) && latest < now) status = "too-late";
  return { status, latest, sunset: sun.sunset };
}

/** "pol dňa": the whole outing (there, hike, back) fits in this many minutes. */
export const HALF_DAY_MIN = 5 * 60;
