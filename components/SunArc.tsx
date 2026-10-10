"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DayPlan } from "@/lib/dayPlan";
import { formatDuration, formatTime } from "@/lib/format";
import { MARKING_COLOR } from "@/lib/mapLayers";
import { sunAltitude } from "@/lib/sun";
import { GOAL_WORDS } from "@/lib/tripProfile";
import type { TripProfile } from "@/lib/tripProfile";
import type { LatLng } from "@/lib/types";

const MIN = 60000;
const HOUR = 60 * MIN;
const W = 360;
const HOR = 146; // horizon line
const H = HOR + 50;
const RULER = HOR + 26;
const PAD = 8;

/** Sky colours by sun height (degrees): [height, top, horizon]. */
const SKY: [number, string, string][] = [
  [-12, "#141d36", "#1d2a52"],
  [-6, "#1d2b55", "#4b4677"],
  [-2, "#38497f", "#e9977a"],
  [2, "#8ea6d4", "#f8c48c"],
  [8, "#c3d7ec", "#fcdcab"],
  [20, "#d4e6f3", "#fbebd0"],
  [50, "#cfe4f5", "#fdf3e1"],
];

function mix(a: string, b: string, f: number): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = rgb(a);
  const B = rgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * f).toString(16).padStart(2, "0")).join("");
}

function skyAt(alt: number): [string, string] {
  if (alt <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const f = (alt - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
      return [mix(SKY[i - 1][1], SKY[i][1], f), mix(SKY[i - 1][2], SKY[i][2], f)];
    }
  }
  const top = SKY[SKY.length - 1];
  return [top[1], top[2]];
}

const STARS = [[30, 30], [80, 58], [140, 22], [205, 48], [262, 26], [318, 62], [110, 90], [345, 34], [22, 96]];

interface Props {
  plan: DayPlan;
  profile: TripProfile | null;
  sun: LatLng;
  hasDrive: boolean;
}

interface WalkPoint {
  t: number;
  x: number;
  y: number;
  colour: string;
}

/**
 * The day as a picture: the sun's real path for this date and place arcs over
 * a timeline of the whole trip, and the walk is drawn as the trail's own
 * height profile. Hover (or drag on touch) to move through the day.
 */
export function SunArc({ plan, profile, sun, hasDrive }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [intro, setIntro] = useState<number | null>(null);
  const dragging = useRef(false);

  const first = plan.segments[0].start.getTime();
  const home = plan.segments[plan.segments.length - 1].end.getTime();
  const hs = plan.hikeStart.getTime();
  const he = plan.hikeEnd.getTime();
  const sunrise = plan.sunrise.getTime();
  const sunset = plan.sunset.getTime();
  const dusk = plan.dusk.getTime();

  const scene = useMemo(() => {
    const lo = Math.floor((Math.min(first, plan.dawn.getTime()) - 30 * MIN) / HOUR) * HOUR;
    const hi = Math.ceil((Math.max(home, dusk) + 30 * MIN) / HOUR) * HOUR;
    const x = (t: number) => PAD + ((t - lo) / (hi - lo)) * (W - 2 * PAD);

    const points = profile?.points ?? [
      { ele: 0, at: 0, colour: null },
      { ele: 1, at: 0.5, colour: null },
      { ele: 0, at: 1, colour: null },
    ];
    const goalIndex = profile?.goalIndex ?? 1;
    const eles = points.map((p) => p.ele);
    const mn = Math.min(...eles);
    const mx = Math.max(...eles);
    const rise = Math.max(26, Math.min(104, ((mx - mn) / 1300) * 104));
    const walk: WalkPoint[] = points.map((p) => {
      const t = hs + p.at * (he - hs);
      return {
        t,
        x: x(t),
        y: HOR - ((p.ele - mn) / (mx - mn || 1)) * rise,
        colour: p.colour ? MARKING_COLOR[p.colour] : "var(--drive)",
      };
    });

    // The arc always clears the hill; summer days still arc higher than winter ones.
    const peak = sunAltitude(new Date((sunrise + sunset) / 2), sun.lat, sun.lon);
    const arcH = Math.min(HOR - 10, Math.max(80, rise + 24) + 18 * Math.min(1, peak / 66));
    const y = (alt: number) => HOR - (Math.max(alt, -3) / peak) * arcH;
    let arc = "";
    for (let t = sunrise; t <= sunset; t += 5 * MIN) {
      arc += `${arc ? "L" : "M"}${x(t).toFixed(1)},${y(sunAltitude(new Date(t), sun.lat, sun.lon)).toFixed(1)}`;
    }
    arc += `L${x(sunset).toFixed(1)},${HOR}`;

    let ridge = `M0,${HOR}`;
    for (let px = 0; px <= W; px += 6) {
      const ry = HOR - 7 - 5 * Math.sin(px / 23) - 3 * Math.sin(px / 9 + 1) - 4 * Math.sin(px / 61 + 2);
      ridge += `L${px},${ry.toFixed(1)}`;
    }
    ridge += `L${W},${HOR}Z`;

    const hill =
      `M${walk[0].x.toFixed(1)},${HOR}` +
      walk.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("") +
      `L${walk[walk.length - 1].x.toFixed(1)},${HOR}Z`;

    const hours: number[] = [];
    for (let t = lo; t <= hi; t += HOUR) hours.push(t);

    return { lo, hi, x, y, walk, goal: walk[goalIndex], goalT: walk[goalIndex].t, arc, ridge, hill, hours };
  }, [first, home, hs, he, sunrise, sunset, dusk, plan.dawn, profile, sun.lat, sun.lon]);

  const ok = plan.verdict === "ok";
  const restT = ok ? scene.goalT : Math.max(hs, he - 10 * MIN);

  // One sweep from departure to the resting point when the picture first appears.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const from = first;
    const to = restT;
    const t0 = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const f = Math.min(1, (now - t0) / 2400);
      const eased = 1 - Math.pow(1 - f, 3);
      setIntro(f < 1 ? from + (to - from) * eased : null);
      if (f < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
    // Only on first appearance, not on every change of departure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = Math.max(scene.lo, Math.min(scene.hi, scrub ?? intro ?? restT));
  const alt = sunAltitude(new Date(t), sun.lat, sun.lon);
  const [skyTop, skyBottom] = skyAt(alt);
  const sx = scene.x(t);
  const sy = scene.y(alt);

  const onTrail = t >= hs && t <= he;
  const inCar = hasDrive && ((t >= first && t < hs) || (t > he && t < home));
  let walker: [number, number] = [sx, HOR];
  if (onTrail) {
    const w = scene.walk;
    const i = Math.max(1, w.findIndex((p) => p.t >= t));
    const f = (t - w[i - 1].t) / (w[i].t - w[i - 1].t || 1);
    walker = [w[i - 1].x + (w[i].x - w[i - 1].x) * f, w[i - 1].y + (w[i].y - w[i - 1].y) * f];
  }

  const goalWords = profile ? GOAL_WORDS[profile.goalKind] : null;
  const what =
    t < first || t >= home
      ? "Doma"
      : t < hs
        ? "Cesta autom"
        : t > he
          ? "Cesta domov"
          : Math.abs(t - scene.goalT) < 6 * MIN && goalWords
            ? `${goalWords.at}: ${profile!.goalName}`
            : t < scene.goalT
              ? "Cesta tam"
              : profile?.loop
                ? "Okruh späť"
                : "Cesta späť";

  const sunNote =
    t < sunrise ? (
      <>slnko vyjde o {formatTime(plan.sunrise)}</>
    ) : t < sunset ? (
      <>
        do západu slnka
        <br />
        <strong>{formatDuration(Math.round((sunset - t) / MIN))}</strong>
      </>
    ) : t < dusk ? (
      <>
        po západe, šero
        <br />
        tma o {formatTime(plan.dusk)}
      </>
    ) : (
      <>tma</>
    );

  const timeAt = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    return scene.lo + ((vx - PAD) / (W - 2 * PAD)) * (scene.hi - scene.lo);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" || dragging.current) setScrub(timeAt(e.clientX));
  };

  const label = (x: number) => Math.max(34, Math.min(W - 34, x));
  const departX = Math.max(30, scene.x(first));
  const backX = Math.min(W - 30, scene.x(he));
  const ground = "Figtree, system-ui, sans-serif";

  return (
    <div
      className="select-none"
      onPointerMove={onMove}
      onPointerLeave={(e) => e.pointerType === "mouse" && setScrub(null)}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full cursor-ew-resize touch-pan-y"
        role="img"
        aria-label={`Slnko vychádza o ${formatTime(plan.sunrise)} a zapadá o ${formatTime(plan.sunset)}. Túra od ${formatTime(plan.hikeStart)} do ${formatTime(plan.hikeEnd)}.`}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setScrub(timeAt(e.clientX));
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setScrub(t + (e.key === "ArrowRight" ? 10 : -10) * MIN);
        }}
      >
        <defs>
          <linearGradient id="sunarc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={skyBottom} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={HOR + 1} fill="url(#sunarc-sky)" />
        <g opacity={alt < -4 ? Math.min(1, (-4 - alt) / 4) : 0}>
          {STARS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill="#fff" />
          ))}
        </g>
        <path d={scene.arc} fill="none" stroke="#fff" strokeWidth={1.6} strokeDasharray="1.5 5" strokeLinecap="round" opacity={0.9} />
        <path d={scene.ridge} fill="#6d7fa6" opacity={0.22} />
        <path d={scene.hill} fill="var(--ground-edge)" />
        <rect x={0} y={HOR} width={W} height={H - HOR} fill="var(--ground)" />
        <line x1={0} x2={W} y1={HOR} y2={HOR} stroke="var(--ground-edge)" />

        {hasDrive && (
          <>
            <line x1={scene.x(first)} x2={scene.x(hs)} y1={HOR} y2={HOR} stroke="var(--drive)" strokeWidth={3.2} strokeLinecap="round" strokeDasharray="5 3" />
            <line x1={scene.x(he)} x2={scene.x(home)} y1={HOR} y2={HOR} stroke="var(--drive)" strokeWidth={3.2} strokeLinecap="round" strokeDasharray="5 3" />
          </>
        )}

        <path
          d={"M" + scene.walk.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}
          fill="none"
          stroke="#fff"
          strokeWidth={4.6}
          strokeLinejoin="round"
        />
        {scene.walk.slice(1).map((p, i) => {
          const prev = scene.walk[i];
          const late = p.t > sunset;
          return (
            <line
              key={i}
              x1={prev.x}
              y1={prev.y}
              x2={p.x}
              y2={p.y}
              stroke={late ? "#9a4a06" : p.colour}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeDasharray={late ? "3 2" : undefined}
            />
          );
        })}

        <circle cx={sx} cy={sy} r={16} fill="#f4a51c" opacity={alt > -1 ? 0.25 : 0} />
        <circle cx={sx} cy={sy} r={8.5} fill="#f4a51c" stroke="#fff" strokeWidth={1.5} opacity={alt > -1 ? 1 : 0} />

        {profile && (
          <g>
            <line x1={scene.goal.x} x2={scene.goal.x} y1={scene.goal.y} y2={scene.goal.y - 13} stroke="#17213a" strokeWidth={1.2} />
            <path d={`M${scene.goal.x},${scene.goal.y - 13}l8,3l-8,3z`} fill="#f4a51c" />
            <text
              x={label(scene.goal.x)}
              y={scene.goal.y - 18}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#fff"
              stroke="#17213a"
              strokeWidth={3}
              paintOrder="stroke"
              fontFamily={ground}
            >
              {profile.goalName} ~{formatTime(new Date(scene.goalT))}
            </text>
          </g>
        )}

        {[
          [sunrise, "východ"],
          [sunset, "západ"],
        ].map(([at, word]) => (
          <g key={word}>
            <circle cx={scene.x(+at)} cy={HOR} r={2.6} fill="#f4a51c" stroke="#fff" />
            <text
              x={label(scene.x(+at))}
              y={HOR - 7}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#9a4a06"
              stroke="#fff"
              strokeWidth={3}
              strokeOpacity={0.85}
              paintOrder="stroke"
              fontFamily={ground}
            >
              {word} {formatTime(new Date(+at))}
            </text>
          </g>
        ))}

        <text x={departX} y={HOR + 17} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)" fontFamily={ground}>
          {hasDrive ? "odchod" : "začiatok"} {formatTime(plan.segments[0].start)}
        </text>
        {Math.abs(backX - departX) > 70 && (
          <text x={backX} y={HOR + 17} textAnchor="middle" fontSize={11} fontWeight={700} fill={ok ? "var(--ok)" : "var(--time)"} fontFamily={ground}>
            späť {formatTime(plan.hikeEnd)}
          </text>
        )}

        <line x1={PAD} x2={W - PAD} y1={RULER} y2={RULER} stroke="var(--muted)" strokeWidth={0.8} opacity={0.6} />
        {scene.hours.map((h) => {
          const x = scene.x(h);
          const hour = new Date(h).getHours();
          const major = hour % 3 === 0;
          return (
            <g key={h}>
              <line x1={x} x2={x} y1={RULER} y2={RULER + (major ? 5 : 3)} stroke="var(--muted)" />
              {major && (
                <text
                  x={x}
                  y={RULER + 17}
                  textAnchor={x > W - 22 ? "end" : x < 22 ? "start" : "middle"}
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--muted)"
                  className="font-data"
                >
                  {hour}:00
                </text>
              )}
            </g>
          );
        })}

        <line x1={sx} x2={sx} y1={HOR - 2} y2={RULER} stroke="var(--foreground)" opacity={0.35} strokeDasharray="2 2" />
        {inCar ? (
          <rect x={sx - 6} y={HOR - 8} width={12} height={7} rx={2.5} fill="#17213a" stroke="#fff" strokeWidth={1.2} />
        ) : (
          <circle cx={walker[0]} cy={walker[1]} r={5.5} fill="#17213a" stroke="#fff" strokeWidth={2} />
        )}
      </svg>

      <div className="flex justify-between gap-3 border-t border-[var(--border)] px-4 pt-2.5 pb-3.5 text-sm" aria-live="polite">
        <div>
          <div className="font-data text-[22px] leading-none">{formatTime(new Date(t))}</div>
          <div className="font-semibold">{what}</div>
        </div>
        <div className="text-right text-[13px] text-[var(--muted)]">{sunNote}</div>
      </div>
    </div>
  );
}
