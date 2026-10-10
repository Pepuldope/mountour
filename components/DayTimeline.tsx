"use client";

import { useEffect, useMemo, useState } from "react";
import { planDay } from "@/lib/dayPlan";
import type { DayPlan, Segment } from "@/lib/dayPlan";
import { formatDistance, formatDuration, formatTime } from "@/lib/format";
import { useDriveRoute } from "@/lib/useDriveRoute";
import { useUserLocation } from "@/lib/userLocation";
import type { LatLng } from "@/lib/types";
import { StartPicker } from "@/components/StartPicker";

interface Props {
  /** Where the sun is computed (trailhead / parking). */
  location: LatLng;
  /** Where the drive ends: the parking lot, else the trailhead. */
  destination: LatLng;
  hikeMin: number;
}

const HOUR = 3600000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Today and "now rounded up to the next quarter hour", in the visitor's timezone. */
function defaults(): { date: string; time: string } {
  const d = new Date(Math.ceil(Date.now() / (15 * 60000)) * 15 * 60000);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SEGMENT_STYLE: Record<Segment["kind"], string> = {
  "drive-there": "bg-[var(--drive)]",
  hike: "",
  "drive-back": "bg-[var(--drive)]",
};

const SEGMENT_LABEL: Record<Segment["kind"], string> = {
  "drive-there": "Cesta tam",
  hike: "Túra",
  "drive-back": "Cesta späť",
};

function verdictText(plan: DayPlan): string {
  const m = Math.abs(plan.marginMin);
  switch (plan.verdict) {
    case "ok":
      return `Z trasy budeš dole ${formatDuration(m)} pred západom slnka.`;
    case "tight":
      return `Tesné - z trasy budeš dole len ${formatDuration(m)} pred západom slnka.`;
    case "after-sunset":
      return `Pozor - koniec túry vychádza ${formatDuration(m)} po západe slnka, v šere.`;
    case "after-dusk":
      return "Pozor - posledná časť túry bude potme. Vyraz skôr alebo vyber kratšiu trasu.";
  }
}

export function DayTimeline({ location, destination, hikeMin }: Props) {
  const { start } = useUserLocation();
  const drive = useDriveRoute(start, destination);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  // "Now" differs between server and client, so pick defaults after hydration.
  useEffect(() => {
    const d = defaults();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(d.date);
    setTime(d.time);
  }, []);

  const driveMin = drive.route?.durationMin ?? null;
  const plan = useMemo(
    () => (date && time ? planDay({ date, start: time, driveMin, hikeMin, location }) : null),
    [date, time, driveMin, hikeMin, location]
  );

  const timeLabel = driveMin !== null ? "Odchod" : "Začiatok túry";
  // "tight" is still before sunset, but it is a caution, not a pass.
  const good = plan?.verdict === "ok";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <h2 className="text-sm font-semibold opacity-70">Plán dňa</h2>

      <StartPicker />

      {drive.status === "loading" && <p className="text-xs opacity-70">Počítam cestu autom...</p>}
      {drive.status === "error" && (
        <p className="text-xs text-[var(--warn)]">
          Cestu autom sa nepodarilo vypočítať. Plán ukazuje len samotnú túru.
        </p>
      )}
      {!start && (
        <p className="text-xs opacity-70">Zadaj, odkiaľ vyrážaš, a do plánu pridáme aj cestu autom.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Dátum
          <input
            type="date"
            value={date ?? ""}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {timeLabel}
          <input
            type="time"
            step={300}
            value={time ?? ""}
            onChange={(e) => setTime(e.target.value)}
            className="w-32 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-base"
          />
        </label>
      </div>

      {plan && <TimelineBar plan={plan} good={good} hasDrive={driveMin !== null} />}

      {plan && (
        <>
          <ol className="flex flex-col gap-1 text-sm">
            {driveMin !== null && drive.route && (
              <li>
                <strong className="tabular-nums">{formatTime(plan.segments[0].start)}</strong> odchod
                {start ? ` - ${start.label}` : ""}
              </li>
            )}
            <li>
              <strong className="tabular-nums">{formatTime(plan.hikeStart)}</strong> začiatok túry
              {drive.route && (
                <span className="opacity-70">
                  {" "}
                  (autom {formatDuration(drive.route.durationMin)}, {formatDistance(drive.route.distanceM)})
                </span>
              )}
            </li>
            <li>
              <strong className="tabular-nums">{formatTime(plan.hikeEnd)}</strong> koniec túry
              <span className="opacity-70"> ({formatDuration(hikeMin)} chôdze)</span>
            </li>
            {driveMin !== null && (
              <li>
                <strong className="tabular-nums">{formatTime(plan.segments[plan.segments.length - 1].end)}</strong>{" "}
                späť na štarte
              </li>
            )}
          </ol>

          <div
            role="status"
            className={`flex flex-col gap-2 rounded-lg p-3 text-sm ${good ? "bg-[var(--ok-bg)]" : "bg-[var(--warn-bg)]"}`}
          >
            <p className={`font-semibold ${good ? "text-[var(--accent)]" : "text-[var(--warn)]"}`}>
              {verdictText(plan)}
            </p>
            {plan.startsInDark && (
              <p className="text-[var(--warn)]">Túra začína pred východom slnka - vezmi si čelovku.</p>
            )}
            <p className="flex flex-wrap items-center gap-x-2">
              <span>
                Najneskorší {driveMin !== null ? "odchod" : "začiatok túry"} na návrat z trasy pred západom:{" "}
                <strong className="tabular-nums">{formatTime(plan.latestStart)}</strong>
              </span>
              {!good && (
                <button
                  type="button"
                  onClick={() => setTime(hhmm(plan.latestStart))}
                  className="text-[var(--accent)] underline"
                >
                  nastaviť
                </button>
              )}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/** Horizontal day: sky band (night / twilight / day) with the trip segments laid on top. */
function TimelineBar({ plan, good, hasDrive }: { plan: DayPlan; good: boolean; hasDrive: boolean }) {
  const first = plan.segments[0].start.getTime();
  const last = plan.segments[plan.segments.length - 1].end.getTime();
  const rangeStart = Math.floor(Math.min(plan.dawn.getTime() - HOUR, first) / HOUR) * HOUR;
  const rangeEnd = Math.ceil(Math.max(plan.dusk.getTime() + HOUR, last) / HOUR) * HOUR;
  const span = rangeEnd - rangeStart;
  const pct = (t: Date | number) => ((+t - rangeStart) / span) * 100;
  const box = (a: Date | number, b: Date | number) => ({ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` });

  const hours: number[] = [];
  const stepH = span / HOUR > 14 ? 3 : 2;
  for (let t = rangeStart; t <= rangeEnd; t += HOUR) {
    if (new Date(t).getHours() % stepH === 0) hours.push(t);
  }

  const latestInRange = plan.latestStart.getTime() > rangeStart && plan.latestStart.getTime() < rangeEnd;

  return (
    <div className="flex flex-col gap-1 select-none" aria-hidden="true">
      {/* Sun labels */}
      <div className="relative h-4 text-[11px] leading-4 opacity-80">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(plan.sunrise)}%` }}>
          východ {formatTime(plan.sunrise)}
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(plan.sunset)}%` }}>
          západ {formatTime(plan.sunset)}
        </span>
      </div>

      <div className="relative h-12 overflow-hidden rounded-lg bg-[var(--sky-night)]">
        {/* Sky */}
        <div className="absolute inset-y-0 bg-[var(--sky-twilight)]" style={box(plan.dawn, plan.dusk)} />
        <div className="absolute inset-y-0 bg-[var(--sky-day)]" style={box(plan.sunrise, plan.sunset)} />

        {/* Trip segments */}
        {plan.segments.map((s) => (
          <div
            key={s.kind}
            title={`${SEGMENT_LABEL[s.kind]} ${formatTime(s.start)}-${formatTime(s.end)}`}
            className={`absolute inset-y-3 rounded-md border-2 border-white/80 ${
              s.kind === "hike" ? (good ? "bg-[var(--accent)]" : "bg-[var(--warn)]") : SEGMENT_STYLE[s.kind]
            }`}
            style={box(s.start, s.end)}
          />
        ))}

        {/* Latest safe start */}
        {latestInRange && (
          <div
            className="absolute inset-y-0 border-l-2 border-dashed border-white"
            style={{ left: `${pct(plan.latestStart)}%` }}
          />
        )}
      </div>

      {/* Hour ticks */}
      <div className="relative h-4 text-[11px] leading-4 tabular-nums opacity-60">
        {hours.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
            {new Date(t).getHours()}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-80">
        {hasDrive && <Legend className="bg-[var(--drive)]" label="cesta autom" />}
        <Legend className={good ? "bg-[var(--accent)]" : "bg-[var(--warn)]"} label="túra" />
        <Legend className="bg-[var(--sky-twilight)]" label="šero" />
        {latestInRange && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 border-l-2 border-dashed border-[var(--foreground)]" />
            {hasDrive ? "najneskorší odchod" : "najneskorší začiatok"}
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2.5 w-4 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
