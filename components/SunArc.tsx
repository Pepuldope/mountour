"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DayPlan } from "@/lib/dayPlan";
import { formatDuration, formatDurationShort, formatTime } from "@/lib/format";
import { LAND, seasonDetails, seasonOf, seeded, snowSvg } from "@/lib/season";
import { UI_ICON, iconEdge } from "@/lib/uiIcons";
import { MARKING_COLOR } from "@/lib/mapLayers";
import { KIND_ICON } from "@/lib/kindIcons";
import { POI_COLOUR } from "@/lib/palette";
import { sunAltitude } from "@/lib/sun";
import { GOAL_WORDS } from "@/lib/tripProfile";
import { LAPSE_PER_M, baseSymbol, skyKind, weatherAt, weatherWords } from "@/lib/weather";
import type { WeatherForecast } from "@/lib/weather";
import { SKY_GREY, SUN_SHOWS, weatherIconSvg, weatherSkySvg } from "@/lib/weatherSky";
import type { TripProfile } from "@/lib/tripProfile";
import type { LatLng } from "@/lib/types";
import { hourOf } from "@/lib/zoned";

const MIN = 60000;
const HOUR = 60 * MIN;
const W = 360;
const HOR = 146; // horizon line
const H = HOR + 50;
const RULER = HOR + 26;
const PAD = 8;
/** Knob size of the phone slider, px (.time-slider in globals.css). */
const SLIDER_KNOB = 36;
/** Zoomed in on a short trip, the dial still shows at least this many hours. */
const ZOOM_MIN_H = 6;
/** A trip window wider than this share of the whole day shows the whole day. */
const ZOOM_UNDER = 0.7;
/** How long "Play" takes to run through the whole day, ms. */
const PLAY_MS = 10000;
// The picture is a sky, so it keeps its own day colours in dark mode too.
const INK = "#14233b";
const WALKER = "#1769d1";
// Even outlines under the markers (the same weight on the head, body and stick).
const EDGE = {
  walker: iconEdge(UI_ICON.walker),
  car: iconEdge(UI_ICON.car),
  bus: iconEdge(UI_ICON.bus),
  train: iconEdge(UI_ICON.train),
  dot: iconEdge(UI_ICON.dot),
};
// The white night car keeps its headlights: amber instead of the icon's white.
const CAR_AT_NIGHT = UI_ICON.car.replaceAll('fill="#fff"', 'fill="#f4a51c"');

/** Sky colours by sun height (degrees): [height, top, horizon]. */
const SKY: [number, string, string][] = [
  [-12, "#141d36", "#1d2a52"],
  [-6, "#1d2b55", "#4b4677"],
  [-2, "#38497f", "#e9977a"],
  [2, "#8ea6d4", "#f8c48c"],
  [8, "#b0cdee", "#fcdcab"],
  [20, "#a9cbef", "#f3eedf"],
  [50, "#a2c7f0", "#e9f0f2"],
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
  /** By bus or train, the ride is a train (planned from the rail timetable). */
  byTrain?: boolean;
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
export function SunArc({ plan, profile, sun, hasDrive, byBus = false, byTrain = false, weather = null }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [intro, setIntro] = useState<number | null>(null);
  const dragging = useRef(false);
  // "Play": the day runs by on its own, so the weather, the light and the climb can be watched change.
  const [playing, setPlaying] = useState(false);
  // Phone slider width, so its knob can sit exactly under the dial's time line.
  const sliderRef = useRef<HTMLInputElement>(null);
  const [sliderW, setSliderW] = useState(0);
  useEffect(() => {
    const el = sliderRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSliderW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const first = plan.segments[0].start.getTime();
  const home = plan.segments[plan.segments.length - 1].end.getTime();
  const hs = plan.hikeStart.getTime();
  const he = plan.hikeEnd.getTime();
  const sunrise = plan.sunrise.getTime();
  const sunset = plan.sunset.getTime();
  const dusk = plan.dusk.getTime();

  const scene = useMemo(() => {
    const dayLo = Math.floor((Math.min(first, plan.dawn.getTime()) - 30 * MIN) / HOUR) * HOUR;
    const dayHi = Math.ceil((Math.max(home, dusk) + 30 * MIN) / HOUR) * HOUR;
    // A short trip was a sliver of the whole day: the dial then zooms in on the trip's hours
    // (Peter, 2026-10-24), at least ZOOM_MIN_H wide and never past dawn or dark.
    let lo = Math.floor((first - 45 * MIN) / HOUR) * HOUR;
    let hi = Math.ceil((home + 45 * MIN) / HOUR) * HOUR;
    while (hi - lo < ZOOM_MIN_H * HOUR && (lo > dayLo || hi < dayHi)) {
      if (lo > dayLo) lo -= HOUR;
      if (hi - lo < ZOOM_MIN_H * HOUR && hi < dayHi) hi += HOUR;
    }
    if (hi - lo > ZOOM_UNDER * (dayHi - dayLo)) [lo, hi] = [dayLo, dayHi];
    lo = Math.max(lo, dayLo);
    hi = Math.min(hi, dayHi);
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
    // The snow line: tongues of snow reaching down the gullies and rock showing between them,
    // softly rounded (Peter, 2026-10-22: a straight cut looked unlike a mountain).
    const cr = seeded(9);
    const pts: [number, number][] = [];
    for (let cx = W; cx > 0; ) {
      pts.push([cx, capY + (cr() < 0.5 ? 1 : -1) * (2 + cr() * 6) + (cr() < 0.25 ? 5 : 0)]);
      cx -= 9 + cr() * 9;
    }
    pts.push([0, capY]);
    // A smooth curve through the points (Catmull-Rom), so the edge has no sharp corners.
    let capEdge = `M0,0 H${W} V${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b, c, d] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
      const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
      const c2 = [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6];
      capEdge += ` C${c1.map((v) => v.toFixed(1)).join(",")} ${c2.map((v) => v.toFixed(1)).join(",")} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
    }
    capEdge += " Z";

    const sky = weather ? weatherSkySvg(weather, lo, hi, x, HOR, (at) => sunAltitude(new Date(at), sun.lat, sun.lon) < -3) : null;

    // The added stops: where on the hill the walk stands still, and when.
    const pauses = (profile?.pauses ?? []).map((pa) => {
      const t0 = hs + pa.from * (he - hs);
      const t1 = hs + pa.to * (he - hs);
      const i = Math.max(0, walk.findIndex((p) => p.t >= t0));
      return { t0, t1, name: pa.name, kind: pa.kind, icon: pa.icon, x: x((t0 + t1) / 2), y: walk[i].y };
    });

    return { lo, hi, x, y, walk, pauses, sky, goal: walk[goalIndex], goalT: walk[goalIndex].t, arc, dash, ridge, hill, hours, season, deco, snow, capY, capEdge };
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

  useEffect(() => {
    if (!playing) return;
    // The whole day in about ten seconds; from where the dial stands, or from the start once it reached the end.
    const span = scene.hi - scene.lo;
    const at = scrubRef.current ?? restT;
    let from = at >= scene.hi - span / 50 ? scene.lo : at;
    let last = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      from = Math.min(scene.hi, from + ((now - last) / PLAY_MS) * span);
      last = now;
      setScrub(from);
      if (from < scene.hi) raf = requestAnimationFrame(step);
      else setPlaying(false);
    });
    return () => cancelAnimationFrame(raf);
    // Started and stopped by the button; the scene stays put while it plays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  const scrubRef = useRef(scrub);
  scrubRef.current = scrub;
  // Any touch on the dial takes over from the playing day.
  const take = (at: number | null) => {
    setPlaying(false);
    setScrub(at);
  };

  const t = Math.max(scene.lo, Math.min(scene.hi, scrub ?? intro ?? restT));
  const alt = sunAltitude(new Date(t), sun.lat, sun.lon);
  // The weather at this moment greys the sky and dims the sun.
  const now = weather ? weatherAt(weather, t) : null;
  const kind = skyKind(now?.symbol ?? null);
  let [skyTop, skyBottom] = skyAt(alt);
  // Only a light tint: the sky keeps its blue so the neutral grey clouds stand out against it.
  const grey = (kind ? SKY_GREY[kind] ?? 0 : 0) * 0.3;
  if (grey && alt > -4) {
    skyTop = mix(skyTop, kind === "thunder" ? "#7c8698" : "#b8c2cf", grey);
    skyBottom = mix(skyBottom, "#d5dbe3", grey);
  }
  const sunShows = kind ? SUN_SHOWS[kind] ?? 1 : 1;
  const sx = scene.x(t);
  // The slider spans the dial's full width, but its knob centre can only travel
  // from half a knob in on each side. Give it the times found at those two
  // points of the picture so the knob and the time line always line up.
  const knob = SLIDER_KNOB / 2;
  const span = (scene.hi - scene.lo) / (1 - (2 * PAD) / W);
  const edgeT = sliderW > 2 * knob ? (knob / sliderW) * span - (PAD / W) * span : 0;
  const slideLo = scene.lo + Math.max(0, edgeT);
  const slideHi = scene.hi - Math.max(0, edgeT);
  const sy = scene.y(alt);

  const onTrail = t >= hs && t <= he;
  // In the dark sky the car turns light.
  const night = alt < -2;
  const inCar = hasDrive && ((t >= first && t < hs) || (t > he && t < home));
  let walker: [number, number] = [sx, HOR];
  let climbed = 0;
  let height: number | null = null;
  if (onTrail) {
    const w = scene.walk;
    const i = Math.max(1, w.findIndex((p) => p.t >= t));
    const f = (t - w[i - 1].t) / (w[i].t - w[i - 1].t || 1);
    walker = [w[i - 1].x + (w[i].x - w[i - 1].x) * f, w[i - 1].y + (w[i].y - w[i - 1].y) * f];
    if (profile) {
      const ele = w[i - 1].ele + (w[i].ele - w[i - 1].ele) * f;
      climbed = ele - w[0].ele;
      height = ele > 0 ? Math.round(ele) : null;
    }
  }
  // On the trail it is colder the higher you are.
  // With the walker right in front of the sun, its glow and white ring would sit round the head like a halo.
  const behindWalker = onTrail && Math.hypot(sx - walker[0], sy - (walker[1] - 18)) < sunR + 18;
  const temp = now ? Math.round(now.temp - climbed * LAPSE_PER_M) : null;
  const tempW = temp === null ? 0 : 20 + `${temp}`.length * 7;
  // Height on the trail at that moment (Peter: see how it changes along the route); "1 234 m n. m.".
  const heightText = height === null ? null : `${height.toLocaleString("sk-SK")} m n. m.`;
  const heightW = heightText ? 16 + heightText.length * 6.4 : 0;
  const heightY = temp !== null ? 45 : 25;

  const marker = onTrail ? "walker" : inCar ? (byBus ? (byTrain ? "train" : "bus") : "car") : "dot";
  const goalWords = profile ? GOAL_WORDS[profile.goalKind] : null;
  const what =
    t < first || t >= home
      ? "Doma"
      : t < hs
        ? byBus
          ? byTrain
            ? "Cesta vlakom"
            : "Cesta autobusom"
          : "Cesta autom"
        : t > he
          ? "Cesta domov"
          : scene.pauses.some((pa) => t >= pa.t0 && t <= pa.t1)
            ? `Zastávka: ${scene.pauses.find((pa) => t >= pa.t0 && t <= pa.t1)!.name}`
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
    if (dragging.current) take(timeAt(e.clientX));
    // A mouse just passing over does not stop a playing day (it is on its way to the button).
    else if (e.pointerType === "mouse" && !playing) setScrub(timeAt(e.clientX));
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
      setPlaying(false);
      setScrub(timeAtRef.current(clientX));
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
    };
  }, []);

  // Ids unique per dial: on /ulozene every card would otherwise paint the first card's sky.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const skyId = `sunarc-sky-${uid}`;
  const capId = `sunarc-cap-${uid}`;
  const label = (x: number) => Math.max(34, Math.min(W - 34, x));
  const ground = "Figtree, system-ui, sans-serif";

  return (
    <div
      className="touch-pan-y select-none [-webkit-touch-callout:none]"
      onPointerMove={onMove}
      onPointerLeave={(e) => e.pointerType === "mouse" && !playing && setScrub(null)}
    >
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full cursor-ew-resize touch-pan-y"
        // A slider for keyboards and screen readers: arrows move through the day, the time and what happens are read out.
        role="slider"
        aria-label={`Priebeh dňa. Slnko vychádza o ${formatTime(plan.sunrise)} a zapadá o ${formatTime(plan.sunset)}. Túra od ${formatTime(plan.hikeStart)} do ${formatTime(plan.hikeEnd)}.`}
        aria-valuemin={slideLo}
        aria-valuemax={slideHi}
        aria-valuenow={Math.max(slideLo, Math.min(slideHi, t))}
        aria-valuetext={`${formatTime(new Date(t))}, ${what}`}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          take(timeAt(e.clientX));
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          take(t + (e.key === "ArrowRight" ? 10 : -10) * MIN);
        }}
      >
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={skyBottom} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={HOR + 1} fill={`url(#${skyId})`} />
        <g opacity={alt < -4 ? Math.min(1, (-4 - alt) / 4) : 0}>
          {STARS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill="#fff" />
          ))}
        </g>
        {/* Constant markup from lib/season.ts. */}
        <g dangerouslySetInnerHTML={{ __html: scene.snow }} />
        {scene.sky && <g dangerouslySetInnerHTML={{ __html: scene.sky.back }} />}
        <path d={scene.ridge} fill="#6d7fa6" opacity={0.18} />
        <clipPath id={capId}>
          <path d={scene.capEdge} />
        </clipPath>
        <path d={scene.hill} fill={land.hill} />
        {(scene.season === "zima" || scene.season === "jar") && <path d={scene.hill} fill="#fff" clipPath={`url(#${capId})`} />}
        <rect x={0} y={HOR} width={W} height={H - HOR} fill="var(--card-bg)" />
        <rect x={0} y={HOR} width={W} height={9} fill={land.front} />
        <g dangerouslySetInnerHTML={{ __html: scene.deco }} />

        {hasDrive &&
          [
            [first, hs],
            [he, home],
          ]
            // No way back known (no train back that day): no return pill.
            .filter(([a, b]) => b > a)
            .map(([a, b]) => {
            const x1 = scene.x(a);
            const x2 = scene.x(b);
            const mid = (x1 + x2) / 2;
            return (
              <g key={a}>
                <rect x={x1} y={HOR - 1} width={Math.max(0, x2 - x1)} height={8} rx={4} fill={INK} stroke="#fff" strokeWidth={1} />
                <line x1={x1 + 4} x2={x2 - 4} y1={HOR + 3} y2={HOR + 3} stroke="#fff" strokeWidth={1.2} strokeDasharray="4 3.5" opacity={0.9} />
                {x2 - x1 > 30 && (
                  <g transform={`translate(${mid} ${HOR + 19})`} fill="var(--foreground)" style={{ color: "var(--foreground)" }}>
                    <g transform="translate(-27 -9) scale(.62)" dangerouslySetInnerHTML={{ __html: byTrain ? UI_ICON.train : byBus ? UI_ICON.bus : UI_ICON.car }} />
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

        {/* Added stops: a ring where the walk stands still and the place's map pin above it, in its colour (Peter, 2026-10-24). */}
        {scene.pauses.map((pa) => {
          const c = pa.kind ? POI_COLOUR[pa.kind] : WALKER;
          return (
            <g key={pa.t0}>
              {pa.kind && (
                <g transform={`translate(${pa.x} ${pa.y - 17})`}>
                  <line y1={7} y2={12} stroke={c} strokeWidth={2.2} />
                  {/* A faint dark rim keeps the white edge visible on a pale sky or snow. */}
                  <circle r={9.6} fill={INK} opacity={0.3} />
                  <circle r={8.4} fill={c} stroke="#fff" strokeWidth={1.6} />
                  {/* Constant markup from lib/kindIcons.ts, no user data. */}
                  <g transform="translate(-5.5 -5.5) scale(0.46)" color="#fff" dangerouslySetInnerHTML={{ __html: KIND_ICON[pa.icon ?? pa.kind] }} />
                </g>
              )}
              {/* A solid dot in the place's colour with a white edge: strong on the hill and in the dark. */}
              <circle cx={pa.x} cy={pa.y} r={5.4} fill={INK} opacity={0.3} />
              <circle cx={pa.x} cy={pa.y} r={4.6} fill={c} stroke="#fff" strokeWidth={1.6} />
            </g>
          );
        })}

        {/* The moment shown: a slim line from the sky down to the hour ruler. */}
        <line x1={sx} x2={sx} y1={4} y2={RULER} stroke={INK} strokeWidth={1} opacity={0.45} />
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
        ]
          // Zoomed in on a short trip, sunrise or sunset can lie outside the picture.
          .filter(([at]) => +at >= scene.lo && +at <= scene.hi)
          .map(([at, word]) => (
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
          const hour = hourOf(h);
          // Every hour is labelled when the dial is zoomed in on a short trip.
          const major = hour % (scene.hi - scene.lo <= 9 * HOUR ? 1 : 3) === 0;
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
          {/* The temperature at that moment, right under the time (higher up the trail it is colder). */}
          {temp !== null && (
            <>
              {/* As narrow as its number: "8 °C" needs less room than "-12 °C". */}
              <rect x={-tempW} y={25} width={tempW} height={16} rx={8} fill="#fff" opacity={0.92} />
              <text x={-tempW / 2} y={37} textAnchor="middle" fontSize={12} fontWeight={700} fill="#14233b" className="font-data">
                {temp} °C
              </text>
            </>
          )}
          {heightText && (
            <>
              <rect x={-heightW} y={heightY} width={heightW} height={16} rx={8} fill="#fff" opacity={0.92} />
              <text x={-heightW / 2} y={heightY + 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#14233b" className="font-data">
                {heightText}
              </text>
            </>
          )}
        </g>
      </svg>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-pressed={playing}
        aria-label={playing ? "Zastaviť" : "Prehrať celý deň"}
        title={playing ? "Zastaviť" : "Prehrať celý deň"}
        className="absolute top-[2.2%] left-[2.2%] inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#14233b] shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        {/* Just the sign, so it hides as little of the sky and weather as it can. */}
        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
          {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /> : <path d="M5 2.5v11l9-5.5z" fill="currentColor" />}
        </svg>
      </button>
      </div>

      {/* Phones: a plain slider right under the picture, easier to hit with a thumb. Computers point with the mouse. */}
      <div className="-mt-1 pb-1 sm:hidden">
        <input
          ref={sliderRef}
          type="range"
          min={slideLo}
          max={slideHi}
          step={5 * MIN}
          value={Math.max(slideLo, Math.min(slideHi, t))}
          onChange={(e) => take(Number(e.target.value))}
          className="time-slider"
          aria-label="Čas počas dňa"
          aria-valuetext={formatTime(new Date(t))}
        />
      </div>

      <div className="flex justify-between gap-3 border-t border-[var(--border)] px-4 pt-2.5 pb-3.5 text-sm">
        <div>
          <div className="font-data text-[22px] leading-none">{formatTime(new Date(t))}</div>
          <div className="font-semibold">{what}</div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right text-[13px] text-[var(--muted)]">
          {kind && now && (
            // One line always (the temperature sits under the time in the picture).
            <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-[var(--foreground)]">
              <svg viewBox="0 0 22 22" className="h-[18px] w-[22px]" aria-hidden="true" dangerouslySetInnerHTML={{ __html: weatherIconSvg(kind) }} />
              {weatherWords(baseSymbol(now.symbol!)).split(" (")[0]}
            </span>
          )}
          <div>{sunNote}</div>
        </div>
      </div>
    </div>
  );
}
