"use client";

import { formatDurationShort } from "@/lib/format";
import { LUNCH, useTripStops, visits } from "@/lib/tripStops";
import type { StopWay } from "@/lib/tripStops";

const WAYS: [StopWay, string][] = [
  ["tam", "Tam"],
  ["spat", "Späť"],
  ["oboje", "Oboje"],
];

/**
 * The stops the group added (Peter 2026-10-23), each with its time; a lunch break is one tap.
 * On a there-and-back walk each place can be a stop on the way there, back, or both times.
 */
export function StopsRow({
  slug,
  hasPlaces,
  loop,
}: {
  slug: string;
  hasPlaces: boolean;
  loop: boolean;
}) {
  const { stops, toggle, setWay, has, minutes } = useTripStops(slug);
  return (
    <div className="flex flex-col gap-1.5">
      {stops.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Zastávky">
          {stops.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] py-1 pr-1 pl-3 text-[13px] font-semibold text-[var(--accent)]">
                <span className="truncate">{s.name}</span>
                <span className="font-data shrink-0">+{formatDurationShort(s.min * visits(s))}</span>
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  aria-label={`Odobrať zastávku ${s.name}`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-base leading-none hover:bg-[var(--card-bg)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  ×
                </button>
              </span>
              {!loop && s.id !== LUNCH.id && (
                <span role="group" aria-label={`Kedy sa zastavíte: ${s.name}`} className="inline-flex rounded-full bg-[var(--segment-bg)] p-0.5 text-[12px] font-semibold">
                  {WAYS.map(([way, label]) => {
                    const on = (s.way ?? "tam") === way;
                    return (
                      <button
                        key={way}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setWay(s.id, way)}
                        className={`rounded-full px-2.5 py-0.5 focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${on ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!has(LUNCH.id) && (
        <button
          type="button"
          onClick={() => toggle(LUNCH)}
          className="w-fit rounded-full border border-[var(--border)] bg-[var(--segment-bg)] px-3 py-1 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          + Prestávka na obed
        </button>
      )}
      <p className="text-xs text-[var(--muted)]">
        {minutes > 0
          ? `Zastávky predĺžia deň o ${formatDurationShort(minutes)}, časy aj obrázok dňa vyššie ich už rátajú.`
          : hasPlaces
            ? "Zastávku pridáte tlačidlom + pri mieste na trase alebo na mape."
            : "Pridajte prestávku, časy sa posunú."}
      </p>
    </div>
  );
}
