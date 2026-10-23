"use client";

import { formatDurationShort } from "@/lib/format";
import { LUNCH, useTripStops } from "@/lib/tripStops";

/** The stops the group added (Peter 2026-10-23), each with its time; a lunch break is one tap. */
export function StopsRow({
  slug,
  hasPlaces,
}: {
  slug: string;
  hasPlaces: boolean;
}) {
  const { stops, toggle, has, minutes } = useTripStops(slug);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {stops.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] py-1 pr-1 pl-3 text-[13px] font-semibold text-[var(--accent)]"
          >
            {s.name}{" "}
            <span className="font-data">+{formatDurationShort(s.min)}</span>
            <button
              type="button"
              onClick={() => toggle(s)}
              aria-label={`Odobrať zastávku ${s.name}`}
              className="grid h-6 w-6 place-items-center rounded-full text-base leading-none hover:bg-[var(--card-bg)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              ×
            </button>
          </span>
        ))}
        {!has(LUNCH.id) && (
          <button
            type="button"
            onClick={() => toggle(LUNCH)}
            className="rounded-full border border-[var(--border)] bg-[var(--segment-bg)] px-3 py-1 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            + Prestávka na obed
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--muted)]">
        {minutes > 0
          ? `Zastávky predĺžia deň o ${formatDurationShort(minutes)}, časy vyššie ich už rátajú.`
          : hasPlaces
            ? "Zastávku pridáte tlačidlom + pri mieste na trase alebo na mape."
            : "Pridajte prestávku, časy sa posunú."}
      </p>
    </div>
  );
}
