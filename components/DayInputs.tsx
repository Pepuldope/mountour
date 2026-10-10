"use client";

import { useTripSettings } from "@/lib/tripSettings";

interface Props {
  /** The time is a departure when a drive is known, else the hike start. */
  hasDrive: boolean;
}

/** Date + departure. Writes the shared trip settings; everything else reacts. */
export function DayInputs({ hasDrive }: Props) {
  const { date, time, update } = useTripSettings();

  return (
    <div className="flex flex-wrap gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Dátum
        <input
          type="date"
          value={date ?? ""}
          onChange={(e) => e.target.value && update({ date: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {hasDrive ? "Odchod" : "Začiatok túry"}
        <input
          type="time"
          step={300}
          value={time ?? ""}
          onChange={(e) => e.target.value && update({ time: e.target.value })}
          className="w-32 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
        />
      </label>
    </div>
  );
}
