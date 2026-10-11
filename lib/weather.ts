/**
 * Weather for the hours of the walk, from MET Norway's Locationforecast
 * (api.met.no, CC BY 4.0; fetched and cached by /api/weather). Pure, so the
 * summary is unit tested.
 */

/** One forecast step, trimmed to what we show. */
export interface WeatherStep {
  /** ISO time of the step. */
  t: string;
  /** Air temperature, °C. */
  temp: number;
  /** Wind speed, m/s. */
  wind: number;
  /** Precipitation in the following period, mm. */
  rain: number;
  /** Length of that period in hours (1 for the first ~2 days, then 6). */
  hours: number;
  /** MET symbol code, e.g. "partlycloudy_day", or null at the end of the range. */
  symbol: string | null;
}

export interface WeatherForecast {
  updated: string;
  steps: WeatherStep[];
}

export interface WeatherSummary {
  tempMin: number;
  tempMax: number;
  windMax: number;
  rainMm: number;
  /** The most significant weather in the window, as a symbol code without _day/_night. */
  symbol: string;
}

/** How far ahead MET forecasts (about 9 days). */
export const FORECAST_DAYS = 9;

const HOUR = 3600000;

/** Worse weather first: the summary shows the worst thing the walk will meet. */
const SEVERITY = [
  "thunder",
  "heavysnow",
  "snow",
  "heavysleet",
  "sleet",
  "heavyrain",
  "rain",
  "lightsnow",
  "lightsleet",
  "lightrain",
  "fog",
  "cloudy",
  "partlycloudy",
  "fair",
  "clearsky",
];

function severity(code: string): number {
  const i = SEVERITY.findIndex((s) => code.includes(s));
  return i < 0 ? SEVERITY.length : i;
}

/** "lightrainshowers_day" -> "lightrainshowers". */
export function baseSymbol(code: string): string {
  return code.replace(/_(day|night|polartwilight)$/, "");
}

/** Summary of the steps that overlap [from, to]; null when the forecast doesn't reach that far. */
export function summarize(forecast: WeatherForecast, from: Date, to: Date): WeatherSummary | null {
  const a = from.getTime();
  const b = to.getTime();
  const steps = forecast.steps.filter((s) => {
    const t = new Date(s.t).getTime();
    return t <= b && t + s.hours * HOUR > a;
  });
  if (steps.length === 0) return null;
  const last = steps[steps.length - 1];
  if (new Date(last.t).getTime() + last.hours * HOUR < b) return null;

  let rain = 0;
  for (const s of steps) {
    const t = new Date(s.t).getTime();
    const overlap = Math.min(b, t + s.hours * HOUR) - Math.max(a, t);
    rain += s.rain * Math.max(0, overlap) / (s.hours * HOUR);
  }
  const symbols = steps.map((s) => s.symbol).filter((c): c is string => c !== null);
  const worst = symbols.sort((x, y) => severity(x) - severity(y))[0] ?? "cloudy";
  return {
    tempMin: Math.round(Math.min(...steps.map((s) => s.temp))),
    tempMax: Math.round(Math.max(...steps.map((s) => s.temp))),
    windMax: Math.round(Math.max(...steps.map((s) => s.wind))),
    rainMm: Math.round(rain * 10) / 10,
    symbol: baseSymbol(worst),
  };
}

/** Slovak words for the MET symbols (base code, no _day/_night). */
const WORDS: [string, string][] = [
  ["thunder", "búrky"],
  ["heavysnow", "husté sneženie"],
  ["lightsnow", "slabé sneženie"],
  ["snow", "sneženie"],
  ["heavysleet", "silný dážď so snehom"],
  ["lightsleet", "slabý dážď so snehom"],
  ["sleet", "dážď so snehom"],
  ["heavyrain", "silný dážď"],
  ["lightrain", "slabý dážď"],
  ["rain", "dážď"],
  ["fog", "hmla"],
  ["partlycloudy", "polojasno"],
  ["cloudy", "zamračené"],
  ["fair", "prevažne jasno"],
  ["clearsky", "jasno"],
];

export function weatherWords(symbol: string): string {
  const showers = symbol.includes("showers") ? " (prehánky)" : "";
  const hit = WORDS.find(([k]) => symbol.startsWith(k));
  return (hit ? hit[1] : "premenlivo") + showers;
}

/** Things worth a warning on a mountain walk. */
export function weatherWarnings(s: WeatherSummary): string[] {
  const out: string[] = [];
  if (s.symbol.includes("thunder")) out.push("Hrozia búrky: na hrebeňoch a vrcholoch nebezpečné.");
  if (s.windMax >= 15) out.push(`Silný vietor (do ${s.windMax} m/s), na hrebeni ešte silnejší.`);
  if (s.tempMin <= 0) out.push("Mráz: chodník môže byť zľadovatený.");
  return out;
}
