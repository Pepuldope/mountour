"use client";

import { useState } from "react";
import type { DayPlan } from "@/lib/dayPlan";
import { useCachedJson } from "@/lib/useDriveRoute";
import { FORECAST_DAYS, summarize, weatherNotes, weatherWords } from "@/lib/weather";
import type { WeatherForecast, WeatherSummary } from "@/lib/weather";
import type { LatLng } from "@/lib/types";

type Goal = (LatLng & { ele: number | null; name: string }) | null;

const DAY = 86400000;

function url(p: LatLng, alt?: number | null): string {
  return `/api/weather?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}${alt ? `&alt=${Math.round(alt)}` : ""}`;
}

function temps(s: WeatherSummary): string {
  return s.tempMin === s.tempMax ? `${s.tempMin} °C` : `${s.tempMin} až ${s.tempMax} °C`;
}

export interface TripWeather {
  /** At the trail start (asked for at its height when known); null until loaded or out of range. */
  below: WeatherForecast | null;
  /** Up at the goal, for its height. */
  above: WeatherForecast | null;
  loading: boolean;
}

/** The forecast for the day of the walk, at the start and up at the goal; nothing beyond the forecast range. */
export function useTripWeather(plan: DayPlan | null, start: LatLng | null, goal: Goal, startEle: number | null): TripWeather {
  const [now] = useState(() => Date.now());
  const inRange = !!plan && !!start && plan.hikeStart.getTime() - now < FORECAST_DAYS * DAY && plan.hikeEnd.getTime() > now;
  const below = useCachedJson<WeatherForecast>(inRange ? url(start!, startEle) : null);
  const above = useCachedJson<WeatherForecast>(inRange && goal?.ele ? url(goal, goal.ele) : null);
  return { below: below.data, above: above.data, loading: below.status === "loading" };
}

/**
 * One line on the weather during the walk and short warnings under the sun
 * dial (which draws the weather itself). Severe weather gets a red line,
 * wind and frost an amber one, like the sunset notes.
 */
export function WeatherNotes({ plan, weather, goal }: { plan: DayPlan; weather: TripWeather; goal: Goal }) {
  if (weather.loading) return <p className="text-xs text-[var(--muted)]">Načítavam predpoveď počasia...</p>;
  if (!weather.below) return null;
  const atStart = summarize(weather.below, plan.hikeStart, plan.hikeEnd);
  if (!atStart) return null;
  const atGoal = weather.above ? summarize(weather.above, plan.hikeStart, plan.hikeEnd) : null;
  const notes = weatherNotes(weather.below, weather.above, plan.hikeStart, plan.hikeEnd);

  return (
    <section aria-label="Počasie počas túry" className="flex flex-col gap-1.5 text-sm">
      <p className="text-[var(--muted)]">
        Počas túry {weatherWords(atStart.symbol)}, {temps(atStart)}
        {atGoal && goal && atGoal.tempMin < atStart.tempMin - 1 ? `, ${goal.name} ${temps(atGoal)}` : ""}
        {atStart.rainMm >= 0.2 ? `, zrážky ${String(atStart.rainMm).replace(".", ",")} mm` : ""}.
      </p>
      {notes.map((n) =>
        n.strong ? (
          <p key={n.text} className="rounded-xl bg-[var(--danger-bg)] px-3 py-2 font-semibold text-[var(--danger)]">
            {n.text}
          </p>
        ) : (
          <p key={n.text} className="font-semibold text-[var(--warn)]">
            {n.text}
          </p>
        )
      )}
    </section>
  );
}
