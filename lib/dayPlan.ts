/**
 * The day of a trip laid against daylight: drive there, hike, drive back.
 *
 * Pure and dependency-free so the safety-relevant part (are you off the trail
 * before dark?) is unit tested. "Before dark" is measured at the END OF THE
 * HIKE, not at home: driving back after sunset is fine, walking a forest trail
 * after it is the beginner mistake this app exists to prevent.
 */
import { CIVIL_TWILIGHT_DEG, getSunTimes } from "@/lib/sun";
import type { LatLng } from "@/lib/types";

export type SegmentKind = "drive-there" | "hike" | "drive-back";

export interface Segment {
  kind: SegmentKind;
  start: Date;
  end: Date;
}

/**
 * ok          - off the trail at least SAFE_MARGIN_MIN before sunset
 * tight       - before sunset, but with less than SAFE_MARGIN_MIN to spare
 * after-sunset - finishing in twilight (sunset .. civil dusk)
 * after-dusk  - finishing in the dark
 */
export type Verdict = "ok" | "tight" | "after-sunset" | "after-dusk";

export interface DayPlan {
  segments: Segment[];
  /** Start of civil twilight. */
  dawn: Date;
  sunrise: Date;
  sunset: Date;
  /** End of civil twilight. */
  dusk: Date;
  hikeStart: Date;
  hikeEnd: Date;
  /** Minutes between the end of the hike and sunset; negative = after sunset. */
  marginMin: number;
  verdict: Verdict;
  /** The hike would start before sunrise. */
  startsInDark: boolean;
  /** Latest departure (or hike start, without a drive) that still ends the hike SAFE_MARGIN_MIN before sunset. */
  latestStart: Date;
}

export interface DayPlanInput {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local time the day starts, HH:MM: leaving home, or the hike itself when driveMin is null. */
  start: string;
  /** One-way drive in minutes; null when unknown (no start point / offline). */
  driveMin: number | null;
  hikeMin: number;
  /** Where the sun is computed (trailhead or parking). */
  location: LatLng;
}

/** "Vyraz najneskôr" gets you off the trail this long before sunset (PD4; tune after tests). */
export const SAFE_MARGIN_MIN = 30;
/** With kids, walking takes this much longer (PD4; tune after tests). */
export const KIDS_PACE = 1.3;

/** Walking time for this group, rounded to 5 min. */
export function hikeMinutes(baseMin: number, withKids: boolean): number {
  return withKids ? Math.round((baseMin * KIDS_PACE) / 5) * 5 : baseMin;
}

const MIN = 60000;

function addMin(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * MIN);
}

/** Returns null for unparseable input or a date with no sunset (polar regions). */
export function planDay(input: DayPlanInput): DayPlan | null {
  const [y, mo, d] = input.date.split("-").map(Number);
  const [h, mi] = input.start.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null;

  // Local wall-clock time in the visitor's timezone; sun times are absolute
  // instants, so the two compare correctly whatever the timezone.
  const dayStart = new Date(y, mo - 1, d, h, mi);
  const utcDay = new Date(Date.UTC(y, mo - 1, d));
  const sun = getSunTimes(utcDay, input.location.lat, input.location.lon);
  const twilight = getSunTimes(utcDay, input.location.lat, input.location.lon, CIVIL_TWILIGHT_DEG);
  if (!sun || !twilight) return null;

  const drive = input.driveMin ?? 0;
  const segments: Segment[] = [];
  const hikeStart = addMin(dayStart, drive);
  const hikeEnd = addMin(hikeStart, input.hikeMin);

  if (input.driveMin !== null) {
    segments.push({ kind: "drive-there", start: dayStart, end: hikeStart });
  }
  segments.push({ kind: "hike", start: hikeStart, end: hikeEnd });
  if (input.driveMin !== null) {
    segments.push({ kind: "drive-back", start: hikeEnd, end: addMin(hikeEnd, drive) });
  }

  const marginMin = Math.round((sun.sunset.getTime() - hikeEnd.getTime()) / MIN);
  const verdict: Verdict =
    hikeEnd > twilight.sunset
      ? "after-dusk"
      : marginMin < 0
        ? "after-sunset"
        : marginMin < SAFE_MARGIN_MIN
          ? "tight"
          : "ok";

  return {
    segments,
    dawn: twilight.sunrise,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    dusk: twilight.sunset,
    hikeStart,
    hikeEnd,
    marginMin,
    verdict,
    startsInDark: hikeStart < sun.sunrise,
    latestStart: addMin(sun.sunset, -(SAFE_MARGIN_MIN + input.hikeMin + drive)),
  };
}
