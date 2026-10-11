"use client";

import type { DayPlan } from "@/lib/dayPlan";
import { formatTime } from "@/lib/format";
import { TRANSIT_LABEL } from "@/lib/format";
import { cpSkBackUrl, cpSkUrl, startTown } from "@/lib/links";
import { useTripDay, useTripSettings } from "@/lib/tripSettings";
import { useUserLocation } from "@/lib/userLocation";
import { useTripAccess } from "@/components/TripAccess";
import { UiIcon } from "@/components/UiIcon";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const link = "w-fit text-sm font-semibold text-[var(--accent)] underline";

/**
 * By car, a short note that the trip also works by train or bus, with one tap
 * to switch. By train/bus the page plans around the stop instead (TransitLegs).
 */
export function TransitBlock() {
  const { stop, transit } = useTripAccess();
  const { update } = useTripSettings();
  if (transit) return null;

  return (
    <details className="group rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-base font-bold [&::-webkit-details-marker]:hidden">
        <span className="text-[var(--muted)]">
          <UiIcon name="bus" size={18} />
        </span>
        Bez auta
        <span className="ml-auto truncate text-sm font-medium text-[var(--muted)]">{stop ? `zastávka ${stop.distance_m} m` : "bez zastávky"}</span>
        <span className="text-[var(--muted)] transition-transform group-open:rotate-90">
          <UiIcon name="chev" size={16} />
        </span>
      </summary>
      <div className="flex flex-col gap-1 px-4 pb-3.5">
      {stop ? (
        <p className="text-sm">
          {TRANSIT_LABEL[stop.mode]}: zastávka <strong>{stop.name}</strong>,{" "}
          <span className="font-data">{stop.distance_m} m</span> od začiatku trasy.
        </p>
      ) : (
        <p className="text-sm">Pri začiatku trasy sme nenašli zastávku.</p>
      )}
      {stop && (
        <button type="button" onClick={() => update({ travel: "transit" })} className={link}>
          Naplánovať autobusom alebo vlakom
        </button>
      )}
      </div>
    </details>
  );
}

/**
 * The trip by train or bus: be at the stop when the walk starts, and the way
 * home searched from the time you are back at the stop. Real timetables are
 * on cp.sk; we hand over the stop, the day and the right time both ways.
 */
export function TransitLegs({ plan }: { plan: DayPlan }) {
  const { stop } = useTripAccess();
  const { start, fix } = useUserLocation();
  const { date } = useTripDay();
  const home = startTown(start, fix?.town);

  if (!stop) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-sm">
        Pri začiatku trasy sme nenašli zastávku vlaku ani autobusu. Táto túra je lepšia autom.
      </p>
    );
  }

  const there = hhmm(plan.hikeStart);
  const back = hhmm(plan.hikeEnd);
  return (
    <section aria-label="Cesta vlakom a autobusom" className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-sm">
      <p>
        {TRANSIT_LABEL[stop.mode]}: zastávka <strong>{stop.name}</strong>, <span className="font-data">{stop.distance_m} m</span> pešo k
        začiatku trasy.
      </p>
      <div className="flex flex-col gap-0.5">
        <p>
          <span className="font-semibold">Tam:</span> buďte na zastávke do <span className="font-data text-base">{formatTime(plan.hikeStart)}</span>.
        </p>
        <a href={cpSkUrl(stop.name, home, date, there, true)} data-umami-event="transit_open" data-umami-event-leg="there" target="_blank" rel="noopener noreferrer" className={link}>
          Spoje tam na cp.sk ↗
        </a>
      </div>
      <div className="flex flex-col gap-0.5">
        <p>
          <span className="font-semibold">Späť:</span> na zastávke budete okolo{" "}
          <span className="font-data text-base">{formatTime(plan.hikeEnd)}</span>, hľadáme spoje odvtedy.
        </p>
        <a href={cpSkBackUrl(stop.name, home, date, back)} data-umami-event="transit_open" data-umami-event-leg="back" target="_blank" rel="noopener noreferrer" className={link}>
          Spoje späť na cp.sk ↗
        </a>
      </div>
      {!home && <p className="text-xs text-[var(--muted)]">Vyberte, odkiaľ cestujete, a doplníme ho do vyhľadávania spojov.</p>}
    </section>
  );
}
