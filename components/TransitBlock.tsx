"use client";

import type { DayPlan } from "@/lib/dayPlan";
import { approachMin } from "@/lib/dayPlan";
import { formatDuration, formatTime, TRANSIT_LABEL } from "@/lib/format";
import { cpSkBackUrl, cpSkUrl, startTown } from "@/lib/links";
import { useTripDay } from "@/lib/tripSettings";
import { useHomeStop } from "@/lib/useHomeStop";
import { useUserLocation } from "@/lib/userLocation";
import type { TransitStop } from "@/lib/types";
import { useTripAccess } from "@/components/TripAccess";
import { UiIcon } from "@/components/UiIcon";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const link = "w-fit text-sm font-semibold text-[var(--accent)] underline";

/** How many stops to offer; the rest are far or duplicates. */
const MAX_OPTIONS = 4;

function walkLabel(s: TransitStop): string {
  const m = s.join?.walk_m ?? s.distance_m;
  const min = approachMin(m);
  const walk = min > 0 ? `${m} m pešo k ${s.join ? "trase" : "začiatku"} (~${formatDuration(min)})` : s.join ? "priamo pri trase" : "pri začiatku trasy";
  return s.join && s.join.skip_m > 0 ? `${walk}, túra kratšia o ${(s.join.skip_m / 1000).toFixed(1).replace(".", ",")} km` : walk;
}

export function StopIcon({ mode, size = 16 }: { mode: TransitStop["mode"]; size?: number }) {
  return <UiIcon name={mode === "vlak" ? "train" : "bus"} size={size} />;
}

/**
 * By train or bus: which stop near the trail to get off at. The walk to the
 * trail, the plan and the cp.sk searches follow the pick.
 */
export function StopsBlock() {
  const { stops, stopChoice, chooseStop, stop, transit } = useTripAccess();
  if (!transit) return null;
  const options = stops.slice(0, MAX_OPTIONS);

  return (
    <details className="group rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-base font-bold [&::-webkit-details-marker]:hidden">
        <span className="mt-pin mt-pin-transit shrink-0 scale-90" aria-hidden>
          <StopIcon mode={stop?.mode ?? "autobus"} />
        </span>
        Zastávky pri trase
        <span className="ml-auto truncate text-sm font-medium text-[var(--muted)]">
          {stop ? `${stop.join?.walk_m ?? stop.distance_m} m ${stop.join ? "k trase" : "k štartu"}` : "bez zastávky"}
        </span>
        <span className="text-[var(--muted)] transition-transform group-open:rotate-90">
          <UiIcon name="chev" size={16} />
        </span>
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-3.5">
        {options.length === 0 && <p className="text-sm">Pri trase sme nenašli zastávku vlaku ani autobusu.</p>}
        {options.length > 1 && <p className="text-sm text-[var(--muted)]">Vyberte, kde vystúpite. Cesta pešo aj plán sa prepočítajú.</p>}
        {options.length > 0 && (
          <ul className="flex flex-col gap-1.5" role="radiogroup" aria-label="Zastávka">
            {options.map((s, i) => {
              const selected = i === stopChoice;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseStop(i)}
                    disabled={options.length === 1}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-default ${
                      selected ? "border-[var(--accent)] bg-[var(--background)]" : "border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <span className="mt-pin mt-pin-transit shrink-0" aria-hidden>
                      <StopIcon mode={s.mode} />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-[var(--muted)]">
                        {TRANSIT_LABEL[s.mode]}, {walkLabel(s)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

/**
 * The trip by train or bus: where to get on near the start, where to get
 * off, and the way home searched from the time you are back at the stop.
 * Real timetables are on cp.sk; we hand over both stops, the day and the
 * right time each way.
 */
export function TransitLegs({ plan }: { plan: DayPlan }) {
  const { stop } = useTripAccess();
  const { start, fix } = useUserLocation();
  const { date } = useTripDay();
  const homeStop = useHomeStop(start);
  const town = startTown(start, fix?.town);
  // cp.sk finds connections between stops; the start's own stop beats the town name, unless it is a
  // city-bus stop named without its town ("Hodžovo nám."), which cp.sk can't place: then the town.
  const home = homeStop && (homeStop.mode === "vlak" || homeStop.name.includes(",") || !town) ? homeStop.name : (town ?? homeStop?.name ?? null);

  if (!stop) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-sm">
        Pri začiatku trasy sme nenašli zastávku vlaku ani autobusu. Táto túra je lepšia autom.
      </p>
    );
  }

  const there = hhmm(plan.hikeStart);
  const back = hhmm(plan.hikeEnd);
  const walkM = stop.join?.walk_m ?? stop.distance_m;
  return (
    <section aria-label="Cesta vlakom a autobusom" className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-sm">
      <div className="flex flex-col gap-0.5">
        <p>
          <span className="font-semibold">Tam:</span>{" "}
          {homeStop ? (
            <>
              zo zastávky <strong>{homeStop.name}</strong> ({TRANSIT_LABEL[homeStop.mode].toLowerCase()},{" "}
              <span className="font-data">{homeStop.distance_m} m</span> od štartu)
            </>
          ) : home ? (
            <>
              z <strong>{home}</strong>
            </>
          ) : (
            "zo štartu"
          )}{" "}
          na zastávku <strong>{stop.name}</strong>, buďte tam do <span className="font-data text-base">{formatTime(plan.hikeStart)}</span>.
          Odtiaľ <span className="font-data">{walkM} m</span> pešo k {stop.join ? "trase" : "začiatku trasy"}.
        </p>
        <a href={cpSkUrl(stop.name, home, date, there, true)} data-umami-event="transit_open" data-umami-event-leg="there" target="_blank" rel="noopener noreferrer" className={link}>
          Spoje tam na cp.sk ↗
        </a>
      </div>
      <div className="flex flex-col gap-0.5">
        <p>
          <span className="font-semibold">Späť:</span> zo zastávky <strong>{stop.name}</strong>
          {home ? (
            <>
              {" "}
              do <strong>{home}</strong>
            </>
          ) : null}
          , na zastávke budete okolo <span className="font-data text-base">{formatTime(plan.hikeEnd)}</span>, hľadáme spoje odvtedy.
        </p>
        <a href={cpSkBackUrl(stop.name, home, date, back)} data-umami-event="transit_open" data-umami-event-leg="back" target="_blank" rel="noopener noreferrer" className={link}>
          Spoje späť na cp.sk ↗
        </a>
      </div>
      {!start && <p className="text-xs text-[var(--muted)]">Vyberte, odkiaľ cestujete, a nájdeme vám najbližšiu zastávku.</p>}
    </section>
  );
}
