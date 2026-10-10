"use client";

import { useMemo, useRef } from "react";
import { dayChips, shortDate } from "@/lib/days";
import { useTripSettings } from "@/lib/tripSettings";

const base =
  "rounded-[var(--radius-chip)] border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]";
const off = "border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--accent)]";
const on = "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]";

interface Props {
  /** Trip pages always plan a day, so the chips there can't be cleared, and kids/half-day live on the list. */
  variant?: "home" | "trip";
  /** Trip page: the day being planned even when none was picked. */
  activeDate?: string | null;
}

/** Day chips (Dnes, Zajtra, So, Ne, iný deň) and, on home, "s deťmi" / "pol dňa". */
export function FilterChips({ variant = "home", activeDate }: Props) {
  const { date, today, withKids, halfDay, update } = useTripSettings();
  const dateInput = useRef<HTMLInputElement>(null);
  const chips = useMemo(() => (today ? dayChips(new Date()) : []), [today]);
  const current = variant === "trip" ? (activeDate ?? date) : date;
  const otherDay = current !== null && !chips.some((c) => c.iso === current);

  function openPicker() {
    const el = dateInput.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      // Older browsers: focusing the (invisible) input opens the native picker.
      el.focus();
      el.click();
    }
  }

  function pick(iso: string) {
    // On home a second tap un-picks the day: back to every trip.
    update({ date: variant === "home" && iso === date ? null : iso });
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Deň výletu" className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.iso}
            type="button"
            aria-pressed={current === c.iso}
            onClick={() => pick(c.iso)}
            className={`${base} ${current === c.iso ? on : off}`}
          >
            {c.label}
          </button>
        ))}
        <span className="relative">
          <button
            type="button"
            aria-pressed={otherDay}
            onClick={openPicker}
            className={`${base} ${otherDay ? on : off}`}
          >
            {otherDay && current ? shortDate(current) : "iný deň"}
          </button>
          <input
            ref={dateInput}
            type="date"
            min={today ?? undefined}
            value={current ?? ""}
            onChange={(e) => e.target.value && update({ date: e.target.value })}
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        </span>
      </div>

      {variant === "home" && (
        <div role="group" aria-label="Filtre" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={withKids}
            onClick={() => update({ withKids: !withKids })}
            className={`${base} ${withKids ? on : off}`}
          >
            s deťmi
          </button>
          <button
            type="button"
            aria-pressed={halfDay}
            onClick={() => update({ halfDay: !halfDay })}
            className={`${base} ${halfDay ? on : off}`}
          >
            pol dňa
          </button>
        </div>
      )}
    </div>
  );
}
