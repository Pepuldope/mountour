"use client";

import { formatDurationShort } from "@/lib/format";
import { useTripSettings } from "@/lib/tripSettings";
import type { Travel } from "@/lib/tripSettings";
import type { UiIconName } from "@/lib/uiIcons";
import { UiIcon } from "@/components/UiIcon";

const OPTIONS: { value: Travel; label: string; icon: UiIconName }[] = [
  { value: "car", label: "Autom", icon: "car" },
  { value: "transit", label: "Busom, vlakom", icon: "bus" },
];

/**
 * Car or public transport, as two equal options: the plan, times and the way
 * back follow. Remembered across visits, so the home list follows it too.
 */
export function TravelSwitch({ driveMin = null }: { driveMin?: number | null }) {
  const { travel, update } = useTripSettings();
  return (
    <div role="radiogroup" aria-label="Ako sa dopravíte" className="grid grid-cols-2 gap-[3px] rounded-xl bg-[var(--segment-bg)] p-[3px]">
      {OPTIONS.map((o) => {
        const on = travel === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => update({ travel: o.value })}
            className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] px-2 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
              on ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className={on ? "text-[var(--accent)]" : ""}>
              <UiIcon name={o.icon} size={18} />
            </span>
            {o.label}
            {o.value === "car" && driveMin !== null && (
              <span className="font-data text-[13px] font-semibold text-[var(--muted)]">{formatDurationShort(driveMin)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
