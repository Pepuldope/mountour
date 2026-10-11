import { describe, expect, it } from "vitest";
import { baseSymbol, summarize, weatherWarnings, weatherWords } from "@/lib/weather";
import type { WeatherForecast } from "@/lib/weather";

const hourly = (h: number, temp: number, rain: number, symbol: string) => ({
  t: `2026-10-17T${String(h).padStart(2, "0")}:00:00Z`,
  temp,
  wind: 4,
  rain,
  hours: 1,
  symbol,
});

const forecast: WeatherForecast = {
  updated: "2026-10-16T12:00:00Z",
  steps: [
    hourly(7, 3.6, 0, "clearsky_day"),
    hourly(8, 5.2, 0, "fair_day"),
    hourly(9, 7.9, 0.4, "lightrainshowers_day"),
    hourly(10, 9.4, 0, "partlycloudy_day"),
    hourly(11, 10.1, 0, "cloudy"),
    { t: "2026-10-17T12:00:00Z", temp: 11, wind: 6, rain: 1.2, hours: 6, symbol: "rain" },
  ],
};

describe("summarize", () => {
  it("covers the hours of the walk and picks the worst weather", () => {
    const s = summarize(forecast, new Date("2026-10-17T08:00:00Z"), new Date("2026-10-17T11:30:00Z"))!;
    expect(s).toMatchObject({ tempMin: 5, tempMax: 10, symbol: "lightrainshowers" });
    expect(s.rainMm).toBe(0.4);
  });
  it("takes a share of a 6-hour step's rain", () => {
    const s = summarize(forecast, new Date("2026-10-17T12:00:00Z"), new Date("2026-10-17T15:00:00Z"))!;
    expect(s.rainMm).toBe(0.6);
  });
  it("is null past the end of the forecast", () => {
    expect(summarize(forecast, new Date("2026-10-17T16:00:00Z"), new Date("2026-10-17T20:00:00Z"))).toBeNull();
  });
});

describe("words and warnings", () => {
  it("names the weather in Slovak", () => {
    expect(weatherWords(baseSymbol("lightrainshowers_day"))).toBe("slabý dážď (prehánky)");
    expect(weatherWords("clearsky")).toBe("jasno");
  });
  it("warns about storms, wind and frost", () => {
    expect(weatherWarnings({ tempMin: -2, tempMax: 3, windMax: 18, rainMm: 0, symbol: "heavyrainandthunder" })).toHaveLength(3);
    expect(weatherWarnings({ tempMin: 8, tempMax: 15, windMax: 5, rainMm: 0, symbol: "fair" })).toEqual([]);
  });
});
