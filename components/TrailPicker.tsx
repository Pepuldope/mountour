"use client";

import { useTripSettings } from "@/lib/tripSettings";
import { StartPicker } from "@/components/StartPicker";
import { DayInputs } from "@/components/DayInputs";

interface Props {
  /** Drive times are known, so the budget and the time input include the drive. */
  hasDrive: boolean;
}

/** The trip inputs. They write the shared settings, so the list, map and plan react instantly. */
export function TrailPicker({ hasDrive }: Props) {
  const { hours, withKids, update } = useTripSettings();

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <StartPicker />

      <DayInputs hasDrive={hasDrive} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        <span>
          Koľko času mám (hodiny)
          {hasDrive && <span className="font-normal opacity-60"> - vrátane cesty autom</span>}
        </span>
        <input
          type="number"
          min={1}
          max={16}
          step={0.5}
          value={hours}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) update({ hours: v });
          }}
          className="w-32 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-sm font-medium">
        Idem s deťmi
        <input
          type="checkbox"
          checked={withKids}
          onChange={(e) => update({ withKids: e.target.checked })}
          className="h-5 w-5 accent-[var(--accent)]"
        />
      </label>
    </form>
  );
}
