"use client";

import { formatDistance, formatDuration, formatTime, verdictText } from "@/lib/format";
import { useTripSettings } from "@/lib/tripSettings";
import { useTripPlan } from "@/lib/useTripPlan";
import { useUserLocation } from "@/lib/userLocation";
import type { LatLng } from "@/lib/types";
import { TimelineBar } from "@/components/TimelineBar";

interface Props {
  sun: LatLng | null;
  destination: LatLng | null;
  hikeMin: number;
  /** Shown above the bar (home page: which trail this is). */
  title?: string;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The day for one trail: timeline, step list, verdict. Output only; inputs live elsewhere. */
export function DayPlanView({ sun, destination, hikeMin, title }: Props) {
  const { start } = useUserLocation();
  const { update } = useTripSettings();
  const { plan, driveStatus, route } = useTripPlan(sun, destination, hikeMin);

  if (!plan) return null;
  const hasDrive = route !== null;
  const good = plan.verdict === "ok";
  const last = plan.segments[plan.segments.length - 1];

  return (
    <div className="flex flex-col gap-3">
      {title && <h2 className="text-base font-semibold">{title}</h2>}

      {driveStatus === "loading" && <p className="text-xs opacity-70">Počítam cestu autom...</p>}
      {driveStatus === "error" && (
        <p className="text-xs text-[var(--warn)]">
          Cestu autom sa nepodarilo vypočítať. Plán ukazuje len samotnú túru.
        </p>
      )}

      <TimelineBar plan={plan} good={good} hasDrive={hasDrive} />

      <ol className="flex flex-col gap-1 text-sm">
        {hasDrive && (
          <li>
            <strong className="tabular-nums">{formatTime(plan.segments[0].start)}</strong> odchod
            {start ? ` - ${start.label}` : ""}
          </li>
        )}
        <li>
          <strong className="tabular-nums">{formatTime(plan.hikeStart)}</strong> začiatok túry
          {route && (
            <span className="opacity-70">
              {" "}
              (autom {formatDuration(route.durationMin)}, {formatDistance(route.distanceM)})
            </span>
          )}
        </li>
        <li>
          <strong className="tabular-nums">{formatTime(plan.hikeEnd)}</strong> koniec túry
          <span className="opacity-70"> ({formatDuration(hikeMin)} chôdze)</span>
        </li>
        {hasDrive && (
          <li>
            <strong className="tabular-nums">{formatTime(last.end)}</strong> späť na štarte
          </li>
        )}
      </ol>

      <div
        role="status"
        className={`flex flex-col gap-2 rounded-lg p-3 text-sm ${good ? "bg-[var(--ok-bg)]" : "bg-[var(--warn-bg)]"}`}
      >
        <p className={`font-semibold ${good ? "text-[var(--accent)]" : "text-[var(--warn)]"}`}>{verdictText(plan)}</p>
        {plan.startsInDark && (
          <p className="text-[var(--warn)]">Túra začína pred východom slnka - vezmi si čelovku.</p>
        )}
        <p className="flex flex-wrap items-center gap-x-2">
          <span>
            Najneskorší {hasDrive ? "odchod" : "začiatok túry"} na návrat z trasy pred západom:{" "}
            <strong className="tabular-nums">{formatTime(plan.latestStart)}</strong>
          </span>
          {!good && (
            <button
              type="button"
              onClick={() => update({ time: hhmm(plan.latestStart) })}
              className="text-[var(--accent)] underline"
            >
              nastaviť
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
