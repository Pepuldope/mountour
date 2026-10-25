"use client";

import { formatDurationShort } from "@/lib/format";
import { LUNCH, useTripStops, visits } from "@/lib/tripStops";
import type { StopWay } from "@/lib/tripStops";
import { useT } from "@/lib/i18n";

const WAYS: [StopWay, string][] = [
  ["tam", "Tam"],
  ["spat", "Späť"],
  ["oboje", "Tam aj späť"],
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
  const t = useT();
  return (
    <div id="zastavky" className="flex flex-col gap-1.5 scroll-mt-24">
      {stops.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label={t("Zastávky")}>
          {stops.map((s) => (
            <li key={s.id} className="flex min-w-0">
              {/* One chip per stop, the way picker inside it: a separate switch wrapped onto its own line (Peter, 2026-10-24). */}
              <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] py-1 pr-1 pl-3 text-[13px] font-semibold text-[var(--accent)]">
                <span className="truncate">{t(s.name)}</span>
                <span className="font-data shrink-0">+{formatDurationShort(s.min * visits(s))}</span>
                {!loop && s.id !== LUNCH.id && <WaySwitch name={s.name} way={s.way} onPick={(way) => setWay(s.id, way)} />}
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  aria-label={t("Odobrať zastávku {name}", { name: t(s.name) })}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-base leading-none hover:bg-[var(--card-bg)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  ×
                </button>
              </span>
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
          + {t("Prestávka na obed")}
        </button>
      )}
      <p className="text-xs text-[var(--muted)]">
        {minutes > 0
          ? t("Zastávky predĺžia deň o {t}, časy aj obrázok dňa vyššie ich už rátajú.", { t: formatDurationShort(minutes) })
          : hasPlaces
            ? t("Zastávku pridáte tlačidlom + pri mieste na trase alebo na mape.")
            : t("Pridajte prestávku, časy sa posunú.")}
      </p>
    </div>
  );
}

/**
 * Stop on the way there, back, or both times (a there-and-back walk passes each place twice): a small
 * dropdown, the phone's own picker, so it fits beside the stop instead of a three-button switch.
 */
export function WaySwitch({ name, way, onPick }: { name: string; way: StopWay | undefined; onPick: (way: StopWay) => void }) {
  const t = useT();
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <select
        value={way ?? "tam"}
        onChange={(e) => onPick(e.target.value as StopWay)}
        aria-label={t("Kedy sa zastavíte: {name}", { name: t(name) })}
        className="h-7 cursor-pointer appearance-none rounded-full border border-[var(--border)] bg-[var(--card-bg)] py-0 pr-6 pl-2.5 text-[13px] font-semibold text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        {WAYS.map(([w, label]) => (
          <option key={w} value={w}>
            {t(label)}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2 text-[10px] text-[var(--muted)]">
        ▼
      </span>
    </span>
  );
}
