"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DayPlan } from "@/lib/dayPlan";
import { formatDuration, formatDurationShort, formatTime } from "@/lib/format";
import { LAND, seasonDetails, seasonOf, seeded, snowSvg } from "@/lib/season";
import { UI_ICON, iconEdge } from "@/lib/uiIcons";
import { MARKING_COLOR } from "@/lib/mapLayers";
import { sunAltitude } from "@/lib/sun";
import { GOAL_WORDS } from "@/lib/tripProfile";
import { LAPSE_PER_M, baseSymbol, skyKind, weatherAt, weatherWords } from "@/lib/weather";
import type { WeatherForecast } from "@/lib/weather";
import { SKY_GREY, SUN_SHOWS, weatherIconSvg, weatherSkySvg } from "@/lib/weatherSky";
import type { TripProfile } from "@/lib/tripProfile";
import type { LatLng } from "@/lib/types";

const MIN = 60000;
const HOUR = 60 * MIN;
const W = 360;
const HOR = 146; // horizon line
const H = HOR + 50;
const RULER = HOR + 26;
const PAD = 8;
// The picture is a sky, so it keeps its own day colours in dark mode too.
const INK = "#14233b";
const WALKER = "#1769d1";
// Even outlines under the markers (the same weight on the head, body and stick).
const EDGE = { walker: iconEdge(UI_ICON.walker), car: iconEdge(UI_ICON.car), bus: iconEdge(UI_ICON.bus), dot: iconEdge(UI_ICON.dot) };
// The white night car keeps its headlights: amber instead of the icon's white.
const CAR_AT_NIGHT = UI_ICON.car.replaceAll('fill="#fff"', 'fill="#f4a51c"');

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
  /** The ride there and back is by bus or train: a bus rides along instead of the car. */
  byBus?: boolean;
  /** Forecast at the trail start, asked for at the start's height; drawn into the sky when given. */
  weather?: WeatherForecast | null;
}

interface WalkPoint {
  t: number;
  x: number;
  y: number;
  ele: number;
  colour: string;
}

/**
 * The day as a picture: the sun's real path for this date and place arcs over
 * a timeline of the whole trip, and the walk is drawn as the trail's own
 * height profile. Hover (or drag on touch) to move through the day.
 */
export function SunArc({ plan, profile, sun, hasDrive, byBus = false, weather = null }: Props) {
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
    // Capped so the walker on a summit stays below the sun at its highest, not inside its glow.
    const rise = Math.max(26, Math.min(84, ((mx - mn) / 1300) * 104));
    const walk: WalkPoint[] = points.map((p) => {
      const t = hs + p.at * (he - hs);
      return {
        t,
        x: x(t),
        y: HOR - ((p.ele - mn) / (mx - mn || 1)) * rise,
        ele: p.ele,
        colour: p.colour ? MARKING_COLOR[p.colour] : "#55627a",
      };
    });

    // The arc always clears the hill; summer days still arc higher than winter ones.
    const altAt = (at: number) => sunAltitude(new Date(at), sun.lat, sun.lon);
    // Sunrise and sunset are when the sun's top edge meets the horizon (a little below 0°), so that
    // height is the ground line: the arc leaves and lands exactly on the sunrise and sunset dots.
    const h0 = (altAt(sunrise) + altAt(sunset)) / 2;
    const peak = altAt((sunrise + sunset) / 2);
    const arcH = Math.min(HOR - 10, Math.max(80, rise + 48) + 18 * Math.min(1, peak / 66));
    const y = (alt: number) => HOR - ((Math.max(alt, -3) - h0) / (peak - h0)) * arcH;
    const arcPts: [number, number][] = [[x(sunrise), HOR]];
    for (let t = sunrise + 5 * MIN; t < sunset - 2 * MIN; t += 5 * MIN) arcPts.push([x(t), y(altAt(t))]);
    arcPts.push([x(sunset), HOR]);
    const arc = arcPts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    // Dashes sized so the line starts and ends with a dash on the dots, not a gap.
    let arcLen = 0;
    for (let i = 1; i < arcPts.length; i++) arcLen += Math.hypot(arcPts[i][0] - arcPts[i - 1][0], arcPts[i][1] - arcPts[i - 1][1]);
    const dash = arcLen / (2 * Math.max(1, Math.round(arcLen / 8)) + 1);

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

    // Season: hill colour, snow on the top, trees or flowers on the ground away from the hill.
    const season = seasonOf(new Date(hs));
    const r = seeded(5);
    const hillL = walk[0].x - 14;
    const hillR = walk[walk.length - 1].x + 14;
    const spots: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const sx0 = PAD + r() * (W - 2 * PAD);
      if (sx0 > hillL && sx0 < hillR) continue;
      spots.push([sx0, HOR + 1 + r() * 2]);
    }
    const deco = seasonDetails(season, r, (i) => spots[i], spots.length);
    const snow = season === "zima" ? snowSvg(W, HOR, 9, 20) : "";
    const topY = Math.min(...walk.map((p) => p.y));
    const capY = topY + (HOR - topY) * 0.28;

    const sky = weather ? weatherSkySvg(weather, lo, hi, x, HOR, (at) => sunAltitude(new Date(at), sun.lat, sun.lon) < -3) : null;

    return { lo, hi, x, y, walk, sky, goal: walk[goalIndex], goalT: walk[goalIndex].t, arc, dash, ridge, hill, hours, season, deco, snow, capY };
  }, [first, home, hs, he, sunrise, sunset, dusk, plan.dawn, profile, sun.lat, sun.lon, weather]);
  const land = LAND[scene.season];
  const sunR = 8.5 * land.sunScale;

  const ok = plan.verdict === "ok" || plan.verdict === "close";
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
  // The weather at this moment greys the sky and dims the sun.
  const now = weather ? weatherAt(weather, t) : null;
  const kind = skyKind(now?.symbol ?? null);
  let [skyTop, skyBottom] = skyAt(alt);
  const grey = kind ? SKY_GREY[kind] ?? 0 : 0;
  if (grey && alt > -4) {
    skyTop = mix(skyTop, kind === "thunder" ? "#7c8698" : "#b8c2cf", grey);
    skyBottom = mix(skyBottom, "#d5dbe3", grey);
  }
  const sunShows = kind ? SUN_SHOWS[kind] ?? 1 : 1;
  const sx = scene.x(t);
  const sy = scene.y(alt);

  const onTrail = t >= hs && t <= he;
  // In the dark sky the car turns light.
  const night = alt < -2;
  const inCar = hasDrive && ((t >= first && t < hs) || (t > he && t < home));
  let walker: [number, number] = [sx, HOR];
  let climbed = 0;
  if (onTrail) {
    const w = scene.walk;
    const i = Math.max(1, w.findIndex((p) => p.t >= t));
    const f = (t - w[i - 1].t) / (w[i].t - w[i - 1].t || 1);
    walker = [w[i - 1].x + (w[i].x - w[i - 1].x) * f, w[i - 1].y + (w[i].y - w[i - 1].y) * f];
    if (profile) climbed = w[i - 1].ele + (w[i].ele - w[i - 1].ele) * f - w[0].ele;
  }
  // On the trail it is colder the higher you are.
  // With the walker right in front of the sun, its glow and white ring would sit round the head like a halo.
  const behindWalker = onTrail && Math.hypot(sx - walker[0], sy - (walker[1] - 18)) < sunR + 18;
  const temp = now ? Math.round(now.temp - climbed * LAPSE_PER_M) : null;

  const marker = onTrail ? "walker" : inCar ? (byBus ? "bus" : "car") : "dot";
  const goalWords = profile ? GOAL_WORDS[profile.goalKind] : null;
  const what =
    t < first || t >= home
      ? "Doma"
      : t < hs
        ? byBus
          ? "Cesta autobusom"
          : "Cesta autom"
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
  const timeAtRef = useRef(timeAt);
  timeAtRef.current = timeAt;

  // Phones: a sideways finger moves through the day, an upward one scrolls the page. Pointer events
  // alone lose the drag when the browser reads a slightly slanted swipe as scrolling, so touches
  // decide the direction themselves and keep the page still once the drag is sideways.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let sideways: boolean | null = null;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return (sideways = false);
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      sideways = null;
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 1 || sideways === false) return;
      const { clientX, clientY } = e.touches[0];
      if (sideways === null) {
        const dx = Math.abs(clientX - x0);
        const dy = Math.abs(clientY - y0);
        if (dx < 5 && dy < 5) return;
        sideways = dx >= dy * 0.7;
        if (!sideways) return;
      }
      if (e.cancelable) e.preventDefault();
      setScrub(timeAtRef.current(clientX));
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
    };
  }, []);

  const label = (x: number) => Math.max(34, Math.min(W - 34, x));
  const ground = "Figtree, system-ui, sans-serif";

  return (
    <div
      className="touch-pan-y select-none [-webkit-touch-callout:none]"
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
        {/* Constant markup from lib/season.ts. */}
        <g dangerouslySetInnerHTML={{ __html: scene.snow }} />
        {scene.sky && <g dangerouslySetInnerHTML={{ __html: scene.sky.back }} />}
        <path d={scene.ridge} fill="#6d7fa6" opacity={0.18} />
        <clipPath id="sunarc-cap">
          <rect x={0} y={0} width={W} height={scene.capY} />
        </clipPath>
        <path d={scene.hill} fill={land.hill} />
        {(scene.season === "zima" || scene.season === "jar") && <path d={scene.hill} fill="#fff" clipPath="url(#sunarc-cap)" />}
        <rect x={0} y={HOR} width={W} height={H - HOR} fill="var(--card-bg)" />
        <rect x={0} y={HOR} width={W} height={9} fill={land.front} />
        <g dangerouslySetInnerHTML={{ __html: scene.deco }} />

        {hasDrive &&
          [
            [first, hs],
            [he, home],
          ].map(([a, b]) => {
            const x1 = scene.x(a);
            const x2 = scene.x(b);
            const mid = (x1 + x2) / 2;
            return (
              <g key={a}>
                <rect x={x1} y={HOR - 1} width={Math.max(0, x2 - x1)} height={8} rx={4} fill={INK} stroke="#fff" strokeWidth={1} />
                <line x1={x1 + 4} x2={x2 - 4} y1={HOR + 3} y2={HOR + 3} stroke="#fff" strokeWidth={1.2} strokeDasharray="4 3.5" opacity={0.9} />
                {x2 - x1 > 30 && (
                  <g transform={`translate(${mid} ${HOR + 19})`} fill="var(--foreground)" style={{ color: "var(--foreground)" }}>
                    <g transform="translate(-27 -9) scale(.62)" dangerouslySetInnerHTML={{ __html: UI_ICON.car }} />
                    <text x={-11} y={2.5} fontSize={13.5} fontWeight={700} className="font-data">
                      {formatDurationShort(Math.round((b - a) / MIN))}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

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

        <path d={scene.arc} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.75} />
        <path d={scene.arc} fill="none" stroke="#e08a00" strokeWidth={1.7} strokeDasharray={`${scene.dash.toFixed(2)} ${scene.dash.toFixed(2)}`} strokeLinecap="round" />
        <g transform={`translate(${sx} ${sy})`} opacity={alt > -1 ? sunShows : 0}>
          {!behindWalker && <circle r={sunR + 8} fill="#ffd36b" opacity={0.45} />}
          {!behindWalker && <circle r={sunR + 2} fill="#fff" opacity={0.9} />}
          <circle r={sunR} fill={land.sun} />
          {scene.season === "leto" &&
            Array.from({ length: 10 }, (_, i) => {
              const a = (i * Math.PI) / 5;
              return (
                <line key={i} x1={Math.cos(a) * (sunR + 3)} y1={Math.sin(a) * (sunR + 3)} x2={Math.cos(a) * (sunR + 8)} y2={Math.sin(a) * (sunR + 8)} stroke="#ffaa00" strokeWidth={2} strokeLinecap="round" />
              );
            })}
        </g>
        {scene.sky && <g dangerouslySetInnerHTML={{ __html: scene.sky.front }} />}

        {profile && (
          <g>
            <line x1={scene.goal.x} x2={scene.goal.x} y1={scene.goal.y} y2={scene.goal.y - 13} stroke="#17213a" strokeWidth={1.2} />
            <path d={`M${scene.goal.x},${scene.goal.y - 13}l8,3l-8,3z`} fill="#f4a51c" />
            <text
              x={label(scene.goal.x)}
              y={scene.goal.y - 18 - (onTrail && Math.abs(walker[0] - scene.goal.x) < 40 ? 18 : 0)}
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

        {/* Who is where: the car on the road, the walker on the trail, a dot at home. */}
        <g transform={`translate(${onTrail ? walker[0] : sx} ${onTrail ? walker[1] - 12 : inCar ? HOR - 11 : HOR + 3}) translate(-12.5 -12.5) scale(1.04)`}>
          {/* A thin even edge keeps the marker apart from what is behind it: white around the blue walker
              (a dark one made him hard to read on phones) and the dark car by day, dark around the white car at night. */}
          <g style={{ color: !onTrail && night ? INK : "#fff" }} dangerouslySetInnerHTML={{ __html: EDGE[marker] }} />
          <g
            style={{ color: onTrail ? WALKER : night ? "#fff" : INK }}
            dangerouslySetInnerHTML={{ __html: night && marker === "car" ? CAR_AT_NIGHT : UI_ICON[marker] }}
          />
        </g>

        <g transform={`translate(${W - 8} 8)`}>
          <rect x={-50} y={0} width={50} height={22} rx={11} fill="#fff" opacity={0.92} />
          <text x={-25} y={16} textAnchor="middle" fontSize={16} fontWeight={700} fill="#14233b" className="font-data">
            {formatTime(new Date(t))}
          </text>
        </g>
      </svg>

      <div className="flex justify-between gap-3 border-t border-[var(--border)] px-4 pt-2.5 pb-3.5 text-sm" aria-live="polite">
        <div>
          <div className="font-data text-[22px] leading-none">{formatTime(new Date(t))}</div>
          <div className="font-semibold">{what}</div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right text-[13px] text-[var(--muted)]">
          {kind && now && (
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--foreground)]">
              <svg viewBox="0 0 22 22" className="h-[18px] w-[22px]" aria-hidden="true" dangerouslySetInnerHTML={{ __html: weatherIconSvg(kind) }} />
              {weatherWords(baseSymbol(now.symbol!)).split(" (")[0]}, {temp} °C
            </span>
          )}
          <div>{sunNote}</div>
        </div>
      </div>
    </div>
  );
}
