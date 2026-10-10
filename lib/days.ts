/**
 * Days and daylight for the home list: the day chips, Slovak day names, and
 * "does this trip fit that day's daylight?" Pure, so it is unit tested.
 */
import { SAFE_MARGIN_MIN } from "@/lib/dayPlan";
import { getSunTimes } from "@/lib/sun";
import type { LatLng } from "@/lib/types";

const MIN = 60000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const chips: DayChip[] = [
    { iso: isoDate(today), label: "Dnes" },
    { iso: isoDate(addDays(today, 1)), label: "Zajtra" },
  ];
  for (const weekday of [6, 0]) {
    const ahead = (weekday - today.getDay() + 7) % 7;
    const iso = isoDate(addDays(today, ahead));
    if (!chips.some((c) => c.iso === iso)) chips.push({ iso, label: WEEKDAY_SHORT[weekday] });
  }
  return chips;
}

/** "17. 10." */
export function shortDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
}

/** "sobota 17. 10." */
export function longDay(iso: string): string {
  return `${WEEKDAY[parseIso(iso).getDay()]} ${shortDate(iso)}`;
}

/** For sentences: "dnes", "zajtra", "v sobotu", or "v pondelok 19. 10." further out. */
export function dayInSentence(iso: string, now: Date): string {
  const today = isoDate(now);
  if (iso === today) return "dnes";
  if (iso === isoDate(addDays(now, 1))) return "zajtra";
  const d = parseIso(iso);
  const days = Math.round((d.getTime() - parseIso(today).getTime()) / 86400000);
  return days > 0 && days < 7 ? WEEKDAY_IN[d.getDay()] : `${WEEKDAY_IN[d.getDay()]} ${shortDate(iso)}`;
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
  | "too-long";

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
  const sun = getSunTimes(new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())), location.lat, location.lon);
  if (!sun) return null;
  const drive = driveMin ?? 0;
  const latest = floorTo5(new Date(sun.sunset.getTime() - (SAFE_MARGIN_MIN + hikeMin + drive) * MIN));
  const earliest = new Date(sun.sunrise.getTime() - drive * MIN);

  let status: FitStatus = "fits";
  if (latest < earliest) status = "too-long";
  else if (date === isoDate(now) && latest < now) status = "too-late";
  return { status, latest, sunset: sun.sunset };
}

/** "pol dňa": the whole outing (there, hike, back) fits in this many minutes. */
export const HALF_DAY_MIN = 5 * 60;
