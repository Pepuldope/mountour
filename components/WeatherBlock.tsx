"use client";

import { useState } from "react";
import type { DayPlan } from "@/lib/dayPlan";
import { useCachedJson } from "@/lib/useDriveRoute";
import { FORECAST_DAYS, summarize, weatherWarnings, weatherWords } from "@/lib/weather";
import type { WeatherForecast, WeatherSummary } from "@/lib/weather";
import type { LatLng } from "@/lib/types";

interface Props {
  plan: DayPlan;
  /** Where the walk starts. */
  start: LatLng;
  /** The goal with its height, for the temperature up there. */
  goal: (LatLng & { ele: number | null; name: string }) | null;
}

const DAY = 86400000;

function url(p: LatLng, alt?: number | null): string {
  return `/api/weather?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}${alt ? `&alt=${Math.round(alt)}` : ""}`;
}

function temps(s: WeatherSummary): string {
  return s.tempMin === s.tempMax ? `${s.tempMin} °C` : `${s.tempMin} až ${s.tempMax} °C`;
}

/**
 * The forecast for the hours of the walk (MET Norway), at the start and up at
 * the goal. Shown only when the day is within the forecast range.
 */
export function WeatherBlock({ plan, start, goal }: Props) {
  const [now] = useState(() => Date.now());
  const inRange = plan.hikeStart.getTime() - now < FORECAST_DAYS * DAY && plan.hikeEnd.getTime() > now;
  const below = useCachedJson<WeatherForecast>(inRange ? url(start) : null);
  const above = useCachedJson<WeatherForecast>(inRange && goal?.ele ? url(goal, goal.ele) : null);
  if (!inRange || below.status === "error") return null;
  if (below.status !== "ok" || !below.data) {
    return <p className="text-xs text-[var(--muted)]">Načítavam predpoveď počasia...</p>;
  }

  const atStart = summarize(below.data, plan.hikeStart, plan.hikeEnd);
  if (!atStart) return null;
  const atGoal = above.data ? summarize(above.data, plan.hikeStart, plan.hikeEnd) : null;
  const warnings = weatherWarnings(atGoal ?? atStart);

  return (
    <section aria-label="Počasie počas túry" className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-sm">
      <p>
        <span className="font-semibold">Počasie počas túry: </span>
        {weatherWords(atStart.symbol)}, {temps(atStart)}
        {atStart.rainMm >= 0.2 ? `, zrážky ${String(atStart.rainMm).replace(".", ",")} mm` : ""}
        {atGoal && goal && atGoal.tempMin < atStart.tempMin - 1 ? `; ${goal.name} ${temps(atGoal)}` : ""}.
      </p>
      {warnings.map((w) => (
        <p key={w} className="font-semibold text-[var(--warn)]">
          {w}
        </p>
      ))}
      <p className="text-xs text-[var(--muted)]">Predpoveď: MET Norway (CC BY 4.0)</p>
    </section>
  );
}
