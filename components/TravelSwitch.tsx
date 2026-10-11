"use client";

import { useTripSettings } from "@/lib/tripSettings";
import type { Travel } from "@/lib/tripSettings";

const OPTIONS: { value: Travel; label: string }[] = [
  { value: "car", label: "Autom" },
  { value: "transit", label: "Vlakom, busom" },
];

/** Car or public transport, as two equal options: the plan, times and the way back follow. */
export function TravelSwitch() {
  const { travel, update } = useTripSettings();
  return (
    <div role="radiogroup" aria-label="Ako sa dopravíte" className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-1">
      {OPTIONS.map((o) => {
        const on = travel === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => update({ travel: o.value })}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${on ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "hover:bg-[var(--background)]"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
