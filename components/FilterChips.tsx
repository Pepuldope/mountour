"use client";

import { useMemo, useRef, useState } from "react";
import { dayStrip, isoDate, shortDay } from "@/lib/days";
import { useTripSettings } from "@/lib/tripSettings";
import { UiIcon } from "@/components/UiIcon";

const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];

interface Props {
  /** Trip pages always plan a day, so the choice there can't be cleared. */
  variant?: "home" | "trip";
  /** Trip page: the day being planned even when none was picked. */
  activeDate?: string | null;
}

const segment = "grid grid-cols-3 gap-[3px] rounded-xl bg-[var(--segment-bg)] p-[3px]";
const segBtn = (on: boolean) =>
  `inline-flex items-center justify-center gap-1.5 rounded-[10px] px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
    on ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
  }`;

/** The day: Dnes, Zajtra, or Iný deň (two weeks to tap, and the full calendar). */
export function FilterChips({ variant = "home", activeDate }: Props) {
  const { date, today, update } = useTripSettings();
  const dateInput = useRef<HTMLInputElement>(null);
  const [stripOpen, setStripOpen] = useState(false);
  const current = variant === "trip" ? (activeDate ?? date) : date;
  const days = useMemo(() => {
    if (!today) return null;
    const now = new Date();
    return {
      today: isoDate(now),
      tomorrow: isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)),
      strip: dayStrip(now),
    };
  }, [today]);
  const other = current !== null && days !== null && current !== days.today && current !== days.tomorrow;
  const showStrip = days !== null && stripOpen;

  function pick(iso: string) {
    // On home a second tap un-picks the day: back to every trip.
    setStripOpen(false);
    update({ date: variant === "home" && iso === date ? null : iso });
  }

  // "Iný deň" is picked at once (the day after tomorrow), then the strip lets you move it.
  function openOther() {
    if (!days) return;
    if (!other) {
      const next = days.strip.find((d) => d.iso !== days.today && d.iso !== days.tomorrow);
      if (next) update({ date: next.iso });
      setStripOpen(true);
      return;
    }
    setStripOpen((v) => !v);
  }

  function openCalendar() {
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

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Deň výletu" className={segment}>
        <button type="button" aria-pressed={!!days && current === days.today} onClick={() => days && pick(days.today)} className={segBtn(!!days && current === days.today)}>
          Dnes
        </button>
        <button type="button" aria-pressed={!!days && current === days.tomorrow} onClick={() => days && pick(days.tomorrow)} className={segBtn(!!days && current === days.tomorrow)}>
          Zajtra
        </button>
        <button
          type="button"
          aria-pressed={other}
          aria-expanded={showStrip}
          onClick={openOther}
          className={segBtn(other)}
        >
          <UiIcon name="cal" size={15} />
          {other && current ? shortDay(current) : "Iný deň"}
        </button>
      </div>

      {showStrip && days && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12.5px] font-bold text-[var(--muted)]">
            <span className="capitalize">{MONTHS[new Date(`${days.strip[0].iso}T12:00`).getMonth()]}</span>
            <span className="relative">
              <button type="button" onClick={openCalendar} className="inline-flex items-center gap-0.5 font-bold text-[var(--accent)]">
                Celý kalendár <UiIcon name="chev" size={13} />
              </button>
              <input
                ref={dateInput}
                type="date"
                min={days.today}
                value={current ?? ""}
                onChange={(e) => e.target.value && update({ date: e.target.value })}
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              />
            </span>
          </div>
          <div role="listbox" aria-label="Vyberte deň" className="flex gap-[5px] overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {days.strip.map((d) => {
              const on = current === d.iso;
              return (
                <button
                  key={d.iso}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => update({ date: d.iso })}
                  className={`flex w-[42px] shrink-0 flex-col items-center gap-px rounded-[11px] border py-1.5 ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                      : d.weekend
                        ? "border-transparent bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-[var(--card-bg)]"
                  }`}
                >
                  <span className={`text-[11px] font-semibold ${on ? "" : "text-[var(--muted)]"}`}>{d.weekday}</span>
                  <span className="font-data text-[17px] leading-tight font-bold">{d.day}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Idete s deťmi?": slower pace and only trips suitable for kids. */
export function KidsSwitch() {
  const { withKids, update } = useTripSettings();
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex text-[var(--accent)]">
        <UiIcon name="kid" size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14.5px] font-bold">Idete s deťmi?</span>
        <span className="text-[12.5px] text-[var(--muted)]">
          {withKids ? "Rátame pomalšie tempo a ukážeme len trasy vhodné pre deti." : "Prispôsobíme tempo aj výber trás."}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={withKids}
        aria-label="Idete s deťmi"
        onClick={() => update({ withKids: !withKids })}
        className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
          withKids ? "bg-[var(--accent)]" : "bg-[#cfd5de]"
        }`}
      >
        <span
          className={`absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform ${withKids ? "translate-x-[18px]" : ""}`}
        />
      </button>
    </div>
  );
}
