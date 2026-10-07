"use client";

import { useUserLocation } from "@/lib/userLocation";

interface Props {
  hours: number;
  onHoursChange: (hours: number) => void;
  withKids: boolean;
  onWithKidsChange: (withKids: boolean) => void;
  startFrom: string;
  onStartFromChange: (text: string) => void;
}

/** The trip inputs. Every change is lifted up so the list and map react instantly. */
export function TrailPicker({
  hours,
  onHoursChange,
  withKids,
  onWithKidsChange,
  startFrom,
  onStartFromChange,
}: Props) {
  const { status, message, locate } = useUserLocation();

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

      <div className="flex flex-col gap-1 text-sm font-medium">
        <label htmlFor="start-from">Odkiaľ vyrážam</label>
        <div className="flex gap-2">
          <input
            id="start-from"
            type="text"
            placeholder="napr. Bratislava"
            value={startFrom}
            onChange={(e) => onStartFromChange(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
          />
          <button
            type="button"
            onClick={locate}
            disabled={status === "locating"}
            className="whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
          >
            {status === "locating" ? "Hľadám..." : status === "ok" ? "Aktualizovať polohu" : "Moja poloha"}
          </button>
        </div>
        {message && status !== "locating" && (
          <p role="status" className="text-xs font-normal text-[var(--warn)]">
            {message}
          </p>
        )}
        {status === "ok" && (
          <p className="text-xs font-normal opacity-70">
            Poloha zistená - trasy sú zoradené podľa vzdialenosti od teba.
          </p>
        )}
      </div>

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
