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
  // "heavyrainandthunder" is a storm first.
  const hit = WORDS.find(([k]) => (k === "thunder" ? symbol.includes(k) : symbol.startsWith(k)));
  return (hit ? hit[1] : "premenlivo") + showers;
}

/** The weather of one forecast step, as the sun dial draws it. */
export type SkyKind =
  | "clear"
  | "fair"
  | "partly"
  | "cloudy"
  | "fog"
  | "lightrain"
  | "rain"
  | "heavyrain"
  | "sleet"
  | "lightsnow"
  | "snow"
  | "heavysnow"
  | "thunder";

/** MET symbol code -> what to draw; checked in this order ("lightrainshowers" is light rain). */
const KINDS: [string, SkyKind][] = [
  ["thunder", "thunder"],
  ["heavysnow", "heavysnow"],
  ["lightsnow", "lightsnow"],
  ["snow", "snow"],
  ["sleet", "sleet"],
  ["heavyrain", "heavyrain"],
  ["lightrain", "lightrain"],
  ["rain", "rain"],
  ["fog", "fog"],
  ["partlycloudy", "partly"],
  ["cloudy", "cloudy"],
  ["fair", "fair"],
  ["clearsky", "clear"],
];

export function skyKind(symbol: string | null): SkyKind | null {
  if (!symbol) return null;
  const hit = KINDS.find(([k]) => symbol.includes(k));
  return hit ? hit[1] : "cloudy";
}

/** The forecast step that covers `t` (ms), or null outside the forecast. */
export function weatherAt(forecast: WeatherForecast, t: number): WeatherStep | null {
  return (
    forecast.steps.find((s) => {
      const a = new Date(s.t).getTime();
      return a <= t && t < a + s.hours * HOUR;
    }) ?? null
  );
}

/** Air cools about this much per metre of climb (standard lapse rate). */
export const LAPSE_PER_M = 0.0065;

export interface WeatherNote {
  text: string;
  /** Storms, heavy rain, heavy snow: dangerous on a mountain. Wind and frost are light notes. */
  strong: boolean;
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Short warnings for the hours of the walk, worst first, the way the sunset
 * notes work: one line each, never a blocker. `top` is the forecast for the
 * goal's height, when there is one (wind and frost are worse up there).
 */
export function weatherNotes(below: WeatherForecast, top: WeatherForecast | null, from: Date, to: Date): WeatherNote[] {
  const a = from.getTime();
  const b = to.getTime();
  const during = (f: WeatherForecast) =>
    f.steps.filter((s) => {
      const t = new Date(s.t).getTime();
      return t < b && t + s.hours * HOUR > a && s.symbol !== null;
    });
  const steps = during(below);
  // "14:00–16:00": when it happens, clipped to the walk.
  const when = (hit: (s: WeatherStep) => boolean): string | null => {
    const h = steps.filter(hit);
    if (h.length === 0) return null;
    const last = h[h.length - 1];
    return `${hhmm(Math.max(a, new Date(h[0].t).getTime()))}–${hhmm(Math.min(b, new Date(last.t).getTime() + last.hours * HOUR))}`;
  };
  const kind = (s: WeatherStep) => skyKind(s.symbol);

  const out: WeatherNote[] = [];
  const thunder = when((s) => kind(s) === "thunder");
  if (thunder) out.push({ text: `Búrky ${thunder}. Na hrebeni a vrchole nebezpečné, buďte dole skôr.`, strong: true });
  const heavy = when((s) => kind(s) === "heavyrain" || s.rain / s.hours >= 4);
  if (heavy && !thunder) out.push({ text: `Silný dážď ${heavy}. Chodník bude šmykľavý.`, strong: true });
  const snow = when((s) => kind(s) === "heavysnow");
  if (snow) out.push({ text: `Husté sneženie ${snow}, značky aj chodník môžu zmiznúť pod snehom.`, strong: true });

  const up = top ? during(top) : [];
  const all = up.length ? up : steps;
  const wind = Math.round(Math.max(0, ...all.map((s) => s.wind)));
  if (wind >= 15) out.push({ text: `Silný vietor (do ${wind} m/s), na hrebeni ešte silnejší.`, strong: false });
  const cold = Math.min(...all.map((s) => s.temp));
  if (cold <= 0 && !snow) out.push({ text: "Mráz: chodník môže byť zľadovatený.", strong: false });
  return out;
}
