"use client";

import { useMemo, useRef, useState } from "react";
import { BAD_SKY_LABEL, badSkySvg } from "@/lib/weatherIcons";
import type { BadSky } from "@/lib/weather";
import { dayStrip, isoDate, shortDay } from "@/lib/days";
import { useTripSettings } from "@/lib/tripSettings";
import { UiIcon } from "@/components/UiIcon";

const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];

interface Props {
  /** Trip pages always plan a day, so the choice there can't be cleared. */
  variant?: "home" | "trip";
  /** Trip page: the day being planned even when none was picked. */
  activeDate?: string | null;
  /** Trip page: days whose walk gets rain, snow, fog or a storm, drawn under the day in the strip. */
  dayWeather?: Record<string, BadSky>;
}

const segment = "grid grid-cols-3 gap-[3px] rounded-xl bg-[var(--segment-bg)] p-[3px]";
const segBtn = (on: boolean) =>
  `inline-flex items-center justify-center gap-1.5 rounded-[10px] px-2 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
    on ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
  }`;

/** The day: Dnes, Zajtra, or Iný deň (two weeks to tap, and the full calendar). */
export function FilterChips({ variant = "home", activeDate, dayWeather }: Props) {
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
          {/* On a narrow phone the picked date ("St 14. 10.") needs the icon's room to stay on one line. */}
          <span className={other ? "hidden min-[380px]:inline-flex" : "inline-flex"}>
            <UiIcon name="cal" size={15} />
          </span>
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
                  {dayWeather?.[d.iso] && (
                    <svg
                      viewBox="0 0 24 24"
                      width={20}
                      height={20}
                      role="img"
                      aria-label={BAD_SKY_LABEL[dayWeather[d.iso]]}
                      // Constant markup from lib/weatherIcons.ts, no user data.
                      dangerouslySetInnerHTML={{ __html: badSkySvg(dayWeather[d.iso], on) }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Two questions (Peter, 2026-10-19): kids along (slower pace) and easier trips only (the list). */
export function KidsSwitch() {
  const { withKids, easier, update } = useTripSettings();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex text-[var(--accent)]">
          <UiIcon name="kid" size={22} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14.5px] font-bold">Idete s deťmi?</span>
          <span className="text-[12.5px] text-[var(--muted)]">{withKids ? "Rátame pomalšie tempo." : "Prispôsobíme tempo chôdze."}</span>
        </span>
        {/* Kids along usually means easier trips too: one tap turns both on, the second can be undone below. */}
        <Switch on={withKids} label="Idete s deťmi" onChange={(on) => update({ withKids: on, easier: on })} />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex w-[22px] justify-center text-[var(--accent)]">
          <UiIcon name="walker" size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14.5px] font-bold">Ukázať ľahšie trasy?</span>
          <span className="text-[12.5px] text-[var(--muted)]">{easier ? "Len trasy vhodné pre deti a začiatočníkov." : "Ukážeme všetky trasy."}</span>
        </span>
        <Switch on={easier} label="Ukázať ľahšie trasy" onChange={(on) => update({ easier: on })} />
      </div>
    </div>
  );
}

/** A plain on/off switch, as on phones. */
export function Switch({ on, label, onChange, small = false }: { on: boolean; label: string; onChange: (on: boolean) => void; small?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        small ? "h-[22px] w-9" : "h-7 w-[46px]"
      } ${on ? "bg-[var(--accent)]" : "bg-[#cfd5de]"}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] rounded-full bg-white shadow transition-transform ${small ? "h-4 w-4" : "h-[22px] w-[22px]"} ${
          on ? (small ? "translate-x-[14px]" : "translate-x-[18px]") : ""
        }`}
      />
    </button>
  );
}
