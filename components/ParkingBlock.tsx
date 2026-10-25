"use client";

import { formatDuration, formatWalk } from "@/lib/format";
import { useTripAccess } from "@/components/TripAccess";
import { approachMin } from "@/lib/dayPlan";
import { UiIcon } from "@/components/UiIcon";
import type { ParkingLot } from "@/lib/types";
import { useLang, useT } from "@/lib/i18n";
import { decimal, tr } from "@/lib/lang";
import type { Lang } from "@/lib/lang";

/** How many parking options to offer; the rest are far or duplicates. */
const MAX_OPTIONS = 4;

function feeLabel(p: ParkingLot, lang: Lang): string | null {
  return p.fee === true ? tr(lang, "spoplatnené") : p.fee === false ? tr(lang, "zadarmo") : null;
}

function walkLabel(p: ParkingLot, lang: Lang): string {
  if (p.join) {
    const min = approachMin(p.join.walk_m);
    const km = decimal(lang, p.join.skip_m / 1000);
    const walk = min > 0 ? tr(lang, "{m} pešo k trase (~{t})", { m: formatWalk(p.join.walk_m, lang), t: formatDuration(min) }) : tr(lang, "priamo pri trase");
    return p.join.skip_m > 0 ? tr(lang, "{walk}, túra kratšia o {km} km", { walk, km }) : walk;
  }
  const min = approachMin(p.walk_m);
  return min > 0 ? tr(lang, "{m} pešo k začiatku (~{t})", { m: formatWalk(p.walk_m, lang), t: formatDuration(min) }) : tr(lang, "pri začiatku trasy");
}

function summaryWalk(p: ParkingLot, lang: Lang): string {
  if (p.join) return p.join.walk_m < 150 ? tr(lang, "pri trase") : tr(lang, "{m} k trase", { m: formatWalk(p.join.walk_m, lang) });
  return p.walk_m < 150 ? tr(lang, "pri štarte") : formatWalk(p.walk_m, lang);
}

/**
 * Where to leave the car. With several parking spots near the start the
 * visitor picks one; the drive, the walk to the trail and the plan follow.
 */
export function ParkingBlock() {
  const { parkingLots, choice, choose, parking, transit, stops } = useTripAccess();
  const options = parkingLots.slice(0, MAX_OPTIONS);
  const t = useT();
  const lang = useLang();
  if (transit) return null;

  return (
    <details className="group rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-base font-bold [&::-webkit-details-marker]:hidden">
        <span className="mt-pin mt-pin-parking shrink-0 scale-90" aria-hidden>
          P
        </span>
        {t("Parkovanie")}
        <span className="ml-auto truncate text-sm font-medium text-[var(--muted)]">
          {parking ? [summaryWalk(parking, lang), feeLabel(parking, lang)].filter(Boolean).join(", ") : t("bez parkoviska")}
        </span>
        <span className="text-[var(--muted)] transition-transform group-open:rotate-90">
          <UiIcon name="chev" size={16} />
        </span>
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-3.5">
      {!parking && (
        <p className="text-sm">
          {t("Pri začiatku trasy nemáme parkovisko. Navigácia vás dovedie na najbližšiu cestu, odtiaľ pešo.")}
          {stops.length > 0 && ` ${t("Skúste aj vlak alebo autobus.")}`}
        </p>
      )}
      {options.length > 1 && <p className="text-sm text-[var(--muted)]">{t("Vyberte, kde zaparkujete. Cesta autom aj pešo sa prepočíta.")}</p>}
      {options.length > 0 && (
        <ul className="flex flex-col gap-1.5" role="radiogroup" aria-label={t("Parkovisko")}>
          {options.map((p, i) => {
            const selected = i === choice;
            const fee = feeLabel(p, lang);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(i)}
                  disabled={options.length === 1}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-default ${
                    selected ? "border-[var(--accent)] bg-[var(--background)]" : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  <span className="mt-pin mt-pin-parking shrink-0" aria-hidden>
                    P
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{t(p.name)}</span>
                    <span className="text-[var(--muted)]">
                      {walkLabel(p, lang)}
                      {fee ? `, ${fee}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {parking && (
        <p className="text-xs text-[var(--muted)]">
          {t("Súradnice:")}{" "}
          <span className="font-data select-all text-sm">
            {parking.location.lat.toFixed(5)}, {parking.location.lon.toFixed(5)}
          </span>{" "}
          · {t("Zdroj: OpenStreetMap")}
        </p>
      )}
      </div>
    </details>
  );
}
