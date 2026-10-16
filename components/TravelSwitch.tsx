"use client";

import { transitMinutes } from "@/lib/drive";
import { formatDurationShort } from "@/lib/format";
import { useTripSettings } from "@/lib/tripSettings";
import type { Travel } from "@/lib/tripSettings";
import type { UiIconName } from "@/lib/uiIcons";
import { UiIcon } from "@/components/UiIcon";
import { NoParkingChip } from "@/components/routeBits";

const OPTIONS: { value: Travel; label: string; icon: UiIconName }[] = [
  { value: "car", label: "Autom", icon: "car" },
  { value: "transit", label: "Busom, vlakom", icon: "bus" },
];

/**
 * Car or public transport, as two equal options: the plan, times and the way
 * back follow. Remembered across visits, so the home list follows it too.
 * With no car park at the start (`noCar`) the car is greyed out with the warning
 * and the bus is the only choice, without changing what is remembered.
 */
export function TravelSwitch({
  roadMin = null,
  trainMin = null,
  noCar = false,
}: {
  roadMin?: number | null;
  trainMin?: number | null;
  noCar?: boolean;
}) {
  const settings = useTripSettings();
  const { update } = settings;
  const travel: Travel = noCar ? "transit" : settings.travel;
  return (
    <div role="radiogroup" aria-label="Ako sa dopravíte" className="grid grid-cols-2 gap-[3px] rounded-xl bg-[var(--segment-bg)] p-[3px]">
      {OPTIONS.map((o) => {
        const on = travel === o.value;
        if (noCar && o.value === "car")
          return (
            <span
              key={o.value}
              role="radio"
              aria-checked={false}
              aria-disabled
              title="Pri štarte tejto cesty nie je parkovisko"
              className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-[10px] bg-[var(--off-bg)] px-2 py-2 text-sm font-semibold text-[var(--off-fg)]"
            >
              <UiIcon name={o.icon} size={18} />
              <span className="line-through">{o.label}</span>
              <NoParkingChip />
            </span>
          );
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
            {roadMin !== null && (
              <span className="font-data text-[13px] font-semibold text-[var(--muted)]">
                {o.value === "car" ? formatDurationShort(roadMin) : trainMin !== null ? formatDurationShort(trainMin) : `~${formatDurationShort(transitMinutes(roadMin))}`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
