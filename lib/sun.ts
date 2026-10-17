/**
 * Pure, dependency-free sunrise/sunset calculation.
 *
 * Implements NOAA's solar calculator (based on Jean Meeus, "Astronomical
 * Algorithms"). Accurate to about a minute — no API key, no network call.
 *
 * Reference values used for testing (Bratislava, lat 48.1486, lon 17.1077):
 *   21 Dec sunset ~ 16:01 local (CET, UTC+1)
 *   21 Jun sunset ~ 21:00 local (CEST, UTC+2)
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface SunTimes {
  /** Sunrise, in UTC. */
  sunrise: Date;
  /** Sunset, in UTC. */
  sunset: Date;
}

/** The sun's declination (degrees) and the equation of time (minutes) at a Julian date. */
function solarPosition(jd: number): { decl: number; eqTimeMin: number } {
  const t = (jd - 2451545) / 36525; // Julian centuries since J2000
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360; // geometric mean longitude
  const m = (357.52911 + t * (35999.05029 - 0.0001537 * t)) * DEG2RAD; // mean anomaly
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t); // orbit eccentricity
  const c =
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m) * (0.019993 - 0.000101 * t) + Math.sin(3 * m) * 0.000289;
  const omega = (125.04 - 1934.136 * t) * DEG2RAD;
  const lambda = (l0 + c - 0.00569 - 0.00478 * Math.sin(omega)) * DEG2RAD; // apparent longitude
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * DEG2RAD; // corrected obliquity
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda)) * RAD2DEG;
  const y = Math.tan(eps / 2) ** 2;
  const l0r = l0 * DEG2RAD;
  const eqTimeMin =
    4 *
    RAD2DEG *
    (y * Math.sin(2 * l0r) -
      2 * e * Math.sin(m) +
      4 * e * y * Math.sin(m) * Math.cos(2 * l0r) -
      0.5 * y * y * Math.sin(4 * l0r) -
      1.25 * e * e * Math.sin(2 * m));
  return { decl, eqTimeMin };
}

/**
 * Computes sunrise and sunset (both returned as UTC Date objects) for a given
 * calendar date at the given latitude/longitude.
 *
 * NOAA's solar calculator (after Meeus, "Astronomical Algorithms"), with the
 * sun's position re-taken at the event itself: within about a minute. The short
 * sunrise equation used before ran up to ~2.5 min late in Slovakia.
 *
 * `date` only contributes its calendar day (in UTC) — pass a Date built from
 * the local calendar date you care about, e.g. `new Date(Date.UTC(y, m, d))`.
 *
 * Returns `null` for polar day/night (sun never rises or never sets) — not a
 * real concern in Slovakia, but handled rather than silently producing NaN.
 */
export function getSunTimes(
  date: Date,
  lat: number,
  lon: number,
  altitudeDeg = -0.833
): SunTimes | null {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const jd0 = midnight / 86400000 + 2440587.5; // Julian date at UTC midnight
  const latRad = lat * DEG2RAD;
  const h0 = altitudeDeg * DEG2RAD;

  /** Minutes after UTC midnight of sunrise (sign -1) or sunset (sign 1); null if the sun never gets there. */
  function event(sign: -1 | 1): number | null {
    let minutes = 720 - 4 * lon; // start from solar noon, then refine at the event
    for (let i = 0; i < 3; i++) {
      const { decl, eqTimeMin } = solarPosition(jd0 + minutes / 1440);
      const d = decl * DEG2RAD;
      const cosOmega = (Math.sin(h0) - Math.sin(latRad) * Math.sin(d)) / (Math.cos(latRad) * Math.cos(d));
      if (cosOmega > 1 || cosOmega < -1) return null; // sun never rises / never sets
      const omega = Math.acos(cosOmega) * RAD2DEG;
      minutes = 720 - 4 * lon - eqTimeMin + sign * 4 * omega;
    }
    return minutes;
  }

  const rise = event(-1);
  const set = event(1);
  if (rise === null || set === null) return null;
  return { sunrise: new Date(midnight + rise * 60000), sunset: new Date(midnight + set * 60000) };
}

/** Sun altitude at which civil twilight ends: below this it is too dark to hike without a light. */
export const CIVIL_TWILIGHT_DEG = -6;

/**
 * Height of the sun above the horizon at `time`, in degrees (negative = below).
 * NOAA general solar position (fractional-year series); within a few tenths
 * of a degree, which is plenty for drawing the sun's path over the day.
 */
export function sunAltitude(time: Date, lat: number, lon: number): number {
  const ms = time.getTime();
  const yearStart = Date.UTC(time.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((ms - yearStart) / 86400000);
  const utcHours = (ms - Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate())) / 3600000;
  const g = ((2 * Math.PI) / 365) * (dayOfYear + (utcHours - 12) / 24);

  const eqTimeMin =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);

  const solarMin = utcHours * 60 + eqTimeMin + 4 * lon;
  const hourAngle = (solarMin / 4 - 180) * DEG2RAD;
  const phi = lat * DEG2RAD;
  const sinAlt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD2DEG;
}
