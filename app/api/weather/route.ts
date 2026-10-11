import type { WeatherForecast, WeatherStep } from "@/lib/weather";

/**
 * GET /api/weather?lat=..&lon=..[&alt=metres] -> WeatherForecast
 *
 * MET Norway Locationforecast 2.0 (CC BY 4.0). Their terms: identify the app
 * in User-Agent, at most 4 decimals, cache, never call it straight from the
 * browser. Trail starts and summits are public places, so nothing personal
 * is sent. `alt` corrects the temperature for a summit's height.
 */

const UA = "MounTour/1.0 https://github.com/Pepuldope/mountour nemcok.peter123@gmail.com";
const AREA = { minLat: 47, maxLat: 50, minLon: 16, maxLon: 23 };
const CACHE_S = 1800;

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
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const alt = q.get("alt") ? Math.round(Number(q.get("alt"))) : null;
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
    `?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}${alt !== null ? `&altitude=${alt}` : ""}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: CACHE_S } });
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
