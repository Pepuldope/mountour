import { withEdgeCache } from "@/lib/edgeCache";
import { OTHER_SITE, TOO_MANY, fromOtherSite, overCallLimit } from "@/lib/routeGuard";
import type { WeatherForecast, WeatherStep } from "@/lib/weather";

/**
 * GET /api/weather?lat=..&lon=..[&alt=metres] -> WeatherForecast
 *
 * MET Norway Locationforecast 2.0 (CC BY 4.0). Their terms: identify the app
 * in User-Agent, at most 4 decimals, cache, never call it straight from the
 * browser. Trail starts and summits are public places, so nothing personal
 * is sent. `alt` corrects the temperature for a summit's height.
 *
 * MET's grid is 2.5 km, so places are snapped to ~1 km and heights to 10 m:
 * nearby trips share one cached forecast and MET is asked far less often.
 */

const UA = "MounTour/1.0 https://github.com/Pepuldope/mountour nemcok.peter123@gmail.com";
const AREA = { minLat: 47, maxLat: 50, minLon: 16, maxLon: 23 };
const CACHE_S = 1800;
/** MET answering slowly must not hold the page. */
const TIMEOUT_MS = 8000;
const snap = (n: number) => Math.round(n * 100) / 100;

interface MetStep {
  time: string;
  data: {
    instant: { details: { air_temperature?: number; wind_speed?: number } };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
  };
}

function trim(s: MetStep): WeatherStep {
  const one = s.data.next_1_hours;
  const six = s.data.next_6_hours;
  const next = one ?? six;
  return {
    t: s.time,
    temp: s.data.instant.details.air_temperature ?? 0,
    wind: s.data.instant.details.wind_speed ?? 0,
    rain: next?.details?.precipitation_amount ?? 0,
    hours: one ? 1 : 6,
    symbol: next?.summary?.symbol_code ?? null,
  };
}

export async function GET(req: Request) {
  // Each new answer is a call to MET in our name: only for our pages, and only so many a minute.
  if (fromOtherSite(req)) return OTHER_SITE();
  const q = new URL(req.url).searchParams;
  const lat = snap(Number(q.get("lat")));
  const lon = snap(Number(q.get("lon")));
  const alt = q.get("alt") ? Math.round(Number(q.get("alt")) / 10) * 10 : null;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < AREA.minLat ||
    lat > AREA.maxLat ||
    lon < AREA.minLon ||
    lon > AREA.maxLon ||
    (alt !== null && (!Number.isFinite(alt) || alt < 0 || alt > 3000))
  ) {
    return Response.json({ error: "lat/lon in Slovakia, alt 0..3000" }, { status: 400 });
  }

  const url =
    "https://api.met.no/weatherapi/locationforecast/2.0/compact" +
    `?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}${alt !== null ? `&altitude=${alt}` : ""}`;
  const cacheKey = { lat: lat.toFixed(2), lon: lon.toFixed(2), alt: alt === null ? "" : String(alt) };
  return withEdgeCache(req, CACHE_S, async () => ((await overCallLimit(req, "weather")) ? TOO_MANY() : forecast(url)), cacheKey);
}

async function forecast(url: string): Promise<Response> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`MET ${res.status}`);
    const data = await res.json();
    const body: WeatherForecast = {
      updated: data.properties?.meta?.updated_at ?? "",
      steps: ((data.properties?.timeseries ?? []) as MetStep[]).map(trim),
    };
    return Response.json(body, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_S}, stale-while-revalidate=${CACHE_S}` },
    });
  } catch (err) {
    console.error("weather failed", err);
    return Response.json({ error: "Predpoveď počasia sa nepodarilo načítať." }, { status: 502 });
  }
}
