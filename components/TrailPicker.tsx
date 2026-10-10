"use client";

import { StartPicker } from "@/components/StartPicker";

interface Props {
  hours: number;
  onHoursChange: (hours: number) => void;
  withKids: boolean;
  onWithKidsChange: (withKids: boolean) => void;
}

/** The trip inputs. Every change is lifted up so the list and map react instantly. */
export function TrailPicker({
  hours,
  onHoursChange,
  withKids,
  onWithKidsChange,
}: Props) {
  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Koľko času mám (hodiny)
        <input
          type="number"
          min={1}
          max={12}
          step={0.5}
          value={hours}
          onChange={(e) => onHoursChange(Number(e.target.value))}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
        />
      </label>

      <StartPicker />

      <label className="flex items-center justify-between gap-2 text-sm font-medium">
        Idem s deťmi
        <input
          type="checkbox"
          checked={withKids}
          onChange={(e) => onWithKidsChange(e.target.checked)}
          className="h-5 w-5 accent-[var(--accent)]"
        />
      </label>
    </form>
  );
}
