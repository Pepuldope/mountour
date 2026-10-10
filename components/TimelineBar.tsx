import type { DayPlan, Segment } from "@/lib/dayPlan";
import { formatTime } from "@/lib/format";

const HOUR = 3600000;

const SEGMENT_LABEL: Record<Segment["kind"], string> = {
  "drive-there": "Cesta tam",
  hike: "Túra",
  "drive-back": "Cesta späť",
};

interface Props {
  plan: DayPlan;
  /** Hike drawn in the accent colour; otherwise in the warning colour. */
  good: boolean;
  hasDrive: boolean;
  /** Thin bar with no labels, for list items. Range = the daylight window, so bars line up. */
  compact?: boolean;
}

/** Horizontal day: sky band (night / twilight / day) with the trip segments laid on top. */
export function TimelineBar({ plan, good, hasDrive, compact = false }: Props) {
  const first = plan.segments[0].start.getTime();
  const last = plan.segments[plan.segments.length - 1].end.getTime();
  const pad = compact ? HOUR / 2 : HOUR;
  // Compact bars ignore the trip's own extent so every list item shares one scale.
  const lo = compact ? plan.dawn.getTime() - pad : Math.min(plan.dawn.getTime() - pad, first);
  const hi = compact ? plan.dusk.getTime() + pad : Math.max(plan.dusk.getTime() + pad, last);
  const rangeStart = Math.floor(lo / HOUR) * HOUR;
  const rangeEnd = Math.ceil(hi / HOUR) * HOUR;
  const span = rangeEnd - rangeStart;
  const pct = (t: Date | number) => Math.min(100, Math.max(0, ((+t - rangeStart) / span) * 100));
  const box = (a: Date | number, b: Date | number) => ({ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` });
  const hikeColor = good ? "bg-[var(--accent)]" : "bg-[var(--warn)]";

  const latestInRange = plan.latestStart.getTime() > rangeStart && plan.latestStart.getTime() < rangeEnd;

  const bar = (
    <div
      className={`relative overflow-hidden bg-[var(--sky-night)] ${compact ? "h-3 rounded-full" : "h-12 rounded-lg"}`}
    >
      <div className="absolute inset-y-0 bg-[var(--sky-twilight)]" style={box(plan.dawn, plan.dusk)} />
      <div className="absolute inset-y-0 bg-[var(--sky-day)]" style={box(plan.sunrise, plan.sunset)} />

      {plan.segments.map((s) => (
        <div
          key={s.kind}
          title={`${SEGMENT_LABEL[s.kind]} ${formatTime(s.start)}-${formatTime(s.end)}`}
          className={`absolute ${
            compact ? "inset-y-0.5 rounded-full" : "inset-y-3 rounded-md border-2 border-white/80"
          } ${s.kind === "hike" ? hikeColor : "bg-[var(--drive)]"}`}
          style={box(s.start, s.end)}
        />
      ))}

      {!compact && latestInRange && (
        <div
          className="absolute inset-y-0 border-l-2 border-dashed border-white"
          style={{ left: `${pct(plan.latestStart)}%` }}
        />
      )}
    </div>
  );

  if (compact) return <div aria-hidden="true">{bar}</div>;

  const hours: number[] = [];
  const stepH = span / HOUR > 14 ? 3 : 2;
  for (let t = rangeStart; t <= rangeEnd; t += HOUR) {
    if (new Date(t).getHours() % stepH === 0) hours.push(t);
  }

  return (
    <div className="flex flex-col gap-1 select-none" aria-hidden="true">
      <div className="relative h-4 text-[11px] leading-4 opacity-80">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(plan.sunrise)}%` }}>
          východ {formatTime(plan.sunrise)}
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(plan.sunset)}%` }}>
          západ {formatTime(plan.sunset)}
        </span>
      </div>

      {bar}

      <div className="relative h-4 text-[11px] leading-4 tabular-nums opacity-60">
        {hours.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
            {new Date(t).getHours()}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-80">
        {hasDrive && <Legend className="bg-[var(--drive)]" label="cesta autom" />}
        <Legend className={hikeColor} label="túra" />
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
