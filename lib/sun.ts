/**
 * Pure, dependency-free sunrise/sunset calculation.
 *
 * Implements the standard NOAA solar-position algorithm (based on Jean Meeus,
 * "Astronomical Algorithms"). Accurate to within a few minutes, which is more
 * than enough for a hike planning app — no API key, no network call.
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

/** Days since 2000-01-01 12:00 UTC (the J2000 epoch), as a fractional Julian day offset. */
function toJulianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Computes sunrise and sunset (both returned as UTC Date objects) for a given
 * calendar date at the given latitude/longitude.
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
  // The standard sunrise-equation formulas are defined in terms of WEST
  // longitude; our public API takes EAST-positive longitude, so flip it here.
  const lw = -lon;

  const jd = Math.floor(toJulianDay(date)) + 0.5; // Julian day at UTC midnight
  const nRaw = jd - 2451545.0009 - lw / 360;
  const n = Math.round(nRaw); // nth solar noon since J2000, at this longitude

  // Mean solar noon
  const jStar = 2451545.0009 + lw / 360 + n;

  // Solar mean anomaly (degrees)
  const M = (357.5291 + 0.98560028 * (jStar - 2451545.0)) % 360;
  const Mrad = M * DEG2RAD;

  // Equation of the center
  const C =
    1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);

  // Ecliptic longitude (degrees)
  const lambda = (M + 102.9372 + C + 180) % 360;
  const lambdaRad = lambda * DEG2RAD;

  // Solar transit (Julian date)
  const Jtransit = jStar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);

  // Declination of the sun
  const sinDelta = Math.sin(lambdaRad) * Math.sin(23.4397 * DEG2RAD);
  const delta = Math.asin(sinDelta);

  const latRad = lat * DEG2RAD;

  // Hour angle at the requested solar altitude. The default -0.833deg is
  // sunrise/sunset (refraction + solar disc radius); -6deg is civil twilight.
  const h0 = altitudeDeg * DEG2RAD;
  const cosOmega =
    (Math.sin(h0) - Math.sin(latRad) * Math.sin(delta)) /
    (Math.cos(latRad) * Math.cos(delta));

  if (cosOmega > 1) return null; // sun never rises
  if (cosOmega < -1) return null; // sun never sets

  const omega = Math.acos(cosOmega) * RAD2DEG;

  const Jrise = Jtransit - omega / 360;
  const Jset = Jtransit + omega / 360;

  return {
    sunrise: julianToDate(Jrise),
    sunset: julianToDate(Jset),
  };
}

/** Sun altitude at which civil twilight ends: below this it is too dark to hike without a light. */
export const CIVIL_TWILIGHT_DEG = -6;

function julianToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

/**
 * Convenience: is `time` after sunset at the given location on `time`'s
 * (UTC) calendar day?
 */
export function isAfterSunset(time: Date, lat: number, lon: number): boolean {
  const dayStart = new Date(Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate()));
  const sun = getSunTimes(dayStart, lat, lon);
  if (!sun) return false;
  return time.getTime() > sun.sunset.getTime();
}
