"use client";

import { KindIcon } from "@/components/KindIcon";
import { POI_LABEL } from "@/lib/format";
import { focusOnMap } from "@/lib/mapFocus";
import { POI_COLOUR } from "@/lib/palette";
import type { Poi } from "@/lib/types";
import { UiIcon } from "@/components/UiIcon";
import { stopFor, useTripStops } from "@/lib/tripStops";

function km(m: number): string {
  return m < 150
    ? "pri štarte"
    : `${(m / 1000).toLocaleString("sk-SK", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
}

/** "Na trase": huts, springs, viewpoints... in the order the walk reaches them, then "Kúsok bokom":
 *  side trips up to ~30 min there and back. A tap shows the place on the map. */
export function PoiList({ pois, slug }: { pois: Poi[]; slug: string }) {
  const stops = useTripStops(slug);
  if (pois.length === 0) return null;
  const on = pois.filter((p) => p.detour_min === null);
  const off = pois.filter((p) => p.detour_min !== null);
  const word =
    pois.length === 1 ? "miesto" : pois.length < 5 ? "miesta" : "miest";
  return (
    <details
      open
      className="group rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-bold [&::-webkit-details-marker]:hidden">
        {on.length === 0
          ? "Kúsok bokom"
          : off.length > 0
            ? "Na trase a okolo"
            : "Na trase"}
        <span className="ml-auto text-sm font-medium text-[var(--muted)]">
          {pois.length} {word}
        </span>
        <span className="text-[var(--muted)] transition-transform group-open:rotate-90">
          <UiIcon name="chev" size={16} />
        </span>
      </summary>
      <ul className="flex flex-col gap-0.5 px-4 pb-3">
        {on.map((p) => (
          <PoiRow
            key={p.id}
            p={p}
            added={stops.has(p.id)}
            onToggle={() => stops.toggle(stopFor(p))}
          />
        ))}
        {on.length > 0 && off.length > 0 && (
          <li className="pt-2 pb-0.5 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
            Kúsok bokom
          </li>
        )}
        {off.map((p) => (
          <PoiRow
            key={p.id}
            p={p}
            added={stops.has(p.id)}
            onToggle={() => stops.toggle(stopFor(p))}
          />
        ))}
      </ul>
    </details>
  );
}

function PoiRow({
  p,
  added,
  onToggle,
}: {
  p: Poi;
  added: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => focusOnMap({ id: `poi-${p.id}`, location: p.location })}
        className="-ml-2 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1 text-left hover:bg-[var(--segment-bg)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        <KindIcon kind={p.kind} colour={POI_COLOUR[p.kind]} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{p.name}</span>
          <span className="text-xs text-[var(--muted)]">
            <span
              className="kind-ink font-bold"
              style={{ "--kind": POI_COLOUR[p.kind] } as React.CSSProperties}
            >
              {POI_LABEL[p.kind]}
            </span>
            {p.detour_min !== null
              ? ` · odbočka +${p.detour_min} min tam aj späť`
              : p.along_m !== null
                ? ` · ${km(p.along_m)}`
                : ""}
          </span>
        </span>
        <span className="shrink-0 text-[var(--muted)]" aria-hidden="true">
          <UiIcon name="pin" size={16} />
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={added}
        aria-label={
          added ? `Odobrať zastávku ${p.name}` : `Pridať zastávku ${p.name}`
        }
        title={added ? "Odobrať zo zastávok" : "Pridať ako zastávku"}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg leading-none font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
          added
            ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
            : "bg-[var(--accent-soft)] text-[var(--accent)]"
        }`}
      >
        {added ? "✓" : "+"}
      </button>
    </li>
  );
}
