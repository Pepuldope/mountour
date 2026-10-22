/**
 * The forecast drawn into the sun dial's sky: clouds, rain, snow, fog and
 * lightning at the hours the forecast gives them. Plain SVG markup, like the
 * season details in lib/season.ts, so the picture is the same on every render.
 */
import { seeded } from "@/lib/season";
import { skyKind } from "@/lib/weather";
import type { SkyKind, WeatherForecast } from "@/lib/weather";

const HOUR = 3600000;

/** How much sky each kind covers: 0 none, 1 a few clouds, 2 half, 3 overcast. */
const COVER: Record<SkyKind, number> = {
  clear: 0,
  fair: 1,
  partly: 2,
  fog: 0,
  cloudy: 3,
  lightrain: 3,
  rain: 3,
  heavyrain: 3,
  sleet: 3,
  lightsnow: 3,
  snow: 3,
  heavysnow: 3,
  thunder: 3,
};

/** How far the sky turns grey when the moment is under this weather (0..1). */
export const SKY_GREY: Partial<Record<SkyKind, number>> = {
  cloudy: 0.45,
  fog: 0.35,
  lightrain: 0.5,
  rain: 0.58,
  heavyrain: 0.66,
  sleet: 0.58,
  lightsnow: 0.45,
  snow: 0.52,
  heavysnow: 0.6,
  thunder: 0.72,
};

/** How bright the sun stays behind this weather (0..1). */
export const SUN_SHOWS: Partial<Record<SkyKind, number>> = {
  partly: 0.9,
  fog: 0.55,
  cloudy: 0.45,
  lightrain: 0.32,
  rain: 0.32,
  heavyrain: 0.32,
  sleet: 0.32,
  lightsnow: 0.32,
  snow: 0.32,
  heavysnow: 0.32,
  thunder: 0.25,
};

const r1 = (n: number) => n.toFixed(1);

/**
 * A darker underside for each cloud colour, drawn a little below it: without it a
 * white or grey cloud melts into a pale or greyed sky (Peter, 2026-10-22).
 */
const UNDERSIDE: Record<string, string> = {
  "#ffffff": "#93a5bd",
  "#d3dae6": "#7f8ea7",
  "#c4ccd8": "#76849c",
  "#a3afc0": "#5f6c82",
  "#6f7a8f": "#434c5f",
  "#56627f": "#2a3247",
  "#3b4664": "#20273a",
};

function cloud(cx: number, cy: number, s: number, fill: string, opacity: number): string {
  const shape = (dy: number) =>
    `<circle cx="${r1(cx - 9 * s)}" cy="${r1(cy + dy)}" r="${r1(6.5 * s)}"/>` +
    `<circle cx="${r1(cx)}" cy="${r1(cy - 4.5 * s + dy)}" r="${r1(9 * s)}"/>` +
    `<circle cx="${r1(cx + 9.5 * s)}" cy="${r1(cy - 0.5 * s + dy)}" r="${r1(6.5 * s)}"/>` +
    `<rect x="${r1(cx - 15 * s)}" y="${r1(cy + dy)}" width="${r1(30 * s)}" height="${r1(6.5 * s)}" rx="${r1(3.2 * s)}"/>`;
  const under = UNDERSIDE[fill];
  // Two faint layers, the lower one fainter: a soft shade under the cloud rather than a hard copy.
  return (
    (under ? `<g fill="${under}" opacity="${(opacity * 0.22).toFixed(2)}">${shape(2.6 * s)}</g><g fill="${under}" opacity="${(opacity * 0.4).toFixed(2)}">${shape(1.3 * s)}</g>` : "") +
    `<g fill="${fill}" opacity="${opacity}">${shape(0)}</g>`
  );
}

export interface SkyLayers {
  /** Behind the hill: rain, snow and fog that the hill hides. */
  back: string;
  /** In front of the sun: clouds, lightning, fog over the hill. */
  front: string;
}

/**
 * Weather layers for the time span [lo, hi] mapped by `x`; `horizon` is the
 * ground line and `night(t)` says whether the sky is dark at t (darker clouds).
 */
export function weatherSkySvg(
  forecast: WeatherForecast,
  lo: number,
  hi: number,
  x: (t: number) => number,
  horizon: number,
  night: (t: number) => boolean
): SkyLayers {
  const r = seeded(11);
  let back = "";
  let front = "";
  for (const s of forecast.steps) {
    const kind = skyKind(s.symbol);
    const a = Math.max(lo, new Date(s.t).getTime());
    const b = Math.min(hi, new Date(s.t).getTime() + s.hours * HOUR);
    if (!kind || b <= a) continue;
    const x0 = x(a);
    const w = x(b) - x0;
    const wet = /rain|sleet|snow|thunder/.test(kind);
    const dark = night((a + b) / 2);
    const cover = COVER[kind];
    const fill = dark
      ? wet
        ? "#3b4664"
        : "#56627f"
      : cover < 3
        ? "#ffffff"
        : kind === "thunder"
          ? "#6f7a8f"
          : /heavy|rain|sleet/.test(kind)
            ? "#a3afc0"
            : /snow/.test(kind)
              ? "#c4ccd8"
              : "#d3dae6";
    const op = dark ? 0.75 : cover === 3 ? 0.96 : 0.9;
    const jy = () => (r() - 0.5) * 10;

    // Clouds, spread over the step: a few for fair, more for half cloudy, a bank when overcast.
    if (cover === 1) {
      for (let cx = x0 + w * 0.5; cx < x0 + w; cx += 44) if (r() < 0.55) front += cloud(cx, 40 + jy(), 0.55, fill, op);
    } else if (cover === 2) {
      for (let i = 0, n = Math.max(1, Math.round(w / 22)); i < n; i++) {
        const cx = x0 + ((i + 0.5) * w) / n;
        front += i % 2 ? cloud(cx, 58 + jy(), 0.55, fill, op) : cloud(cx, 34 + jy(), 0.8, fill, op);
      }
    } else if (cover === 3) {
      for (let i = 0, n = Math.max(1, Math.round(w / 11)); i < n; i++) {
        const cx = x0 + ((i + 0.5) * w) / n;
        front += cloud(cx, 31 + jy() * 0.5, 1 + r() * 0.08, fill, op);
      }
    }

    // What falls, from the cloud base down to the ground.
    const n = Math.max(1, Math.round((w / 20) * (/heavy|thunder/.test(kind) ? 7 : /light/.test(kind) ? 3 : 5)));
    if (/rain|sleet|thunder/.test(kind)) {
      for (let j = 0; j < n; j++) {
        const sx = x0 + ((j + 0.5) * w) / n + (r() - 0.5) * 3;
        const sy = 46 + r() * 12;
        back += `<line x1="${r1(sx)}" y1="${r1(sy)}" x2="${r1(sx - 4)}" y2="${r1(sy + 13)}" stroke="#4f86c9" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>`;
        const sy2 = sy + 34 + r() * 20;
        if (sy2 < horizon - 6) {
          back += `<line x1="${r1(sx - 9)}" y1="${r1(sy2)}" x2="${r1(sx - 13)}" y2="${r1(sy2 + 13)}" stroke="#4f86c9" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>`;
        }
      }
    }
    if (/snow|sleet/.test(kind)) {
      for (let j = 0; j < n * 2; j++) {
        back += `<circle cx="${r1(x0 + r() * w)}" cy="${r1(48 + r() * (horizon - 56))}" r="${r1(1.2 + r())}" fill="#fff" stroke="#8ea3bf" stroke-width=".5"/>`;
      }
    }
    if (kind === "thunder") {
      for (let cx = x0 + w * 0.5; cx < x0 + w; cx += 40) {
        front += `<path d="M${r1(cx + 3)},44 l-7,13 h6 l-5,12 l12,-16 h-6 l5,-9 z" fill="#ffd23f" stroke="#7a4b00" stroke-width=".8" stroke-linejoin="round"/>`;
      }
    }
    if (kind === "fog") {
      [horizon - 34, horizon - 22, horizon - 11].forEach((fy, j) => {
        back += `<rect x="${r1(x0 - 4)}" y="${fy + (j % 2) * 3}" width="${r1(w + 8)}" height="6" rx="3" fill="#fff" opacity=".7"/>`;
      });
      [horizon - 28, horizon - 16].forEach((fy) => {
        front += `<rect x="${r1(x0 - 4)}" y="${fy}" width="${r1(w + 8)}" height="5" rx="2.5" fill="#fff" opacity=".55"/>`;
      });
    }
  }
  return { back, front };
}

/** A small picture of the weather (22x22) for the line under the dial. */
export function weatherIconSvg(kind: SkyKind): string {
  const sun = '<circle cx="8" cy="7" r="4.6" fill="#ffb81c"/>';
  const c = (f: string) =>
    `<path d="M5 15.5h13a3.4 3.4 0 0 0 0-6.8 4.8 4.8 0 0 0-9.2-1.4A3.6 3.6 0 0 0 5 15.5z" fill="${f}" stroke="#8796ad" stroke-width=".6"/>`;
  if (kind === "clear") return '<circle cx="11" cy="9" r="5.5" fill="#ffb81c"/>';
  if (kind === "fair" || kind === "partly") return sun + c("#fff");
  if (kind === "fog") return '<path d="M3 6h16M5 10h14M3 14h16" stroke="#8796ad" stroke-width="2" stroke-linecap="round"/>';
  if (kind === "cloudy") return c("#dfe5ee");
  if (kind === "thunder") {
    return c("#a3afc0") + '<path d="M12 15l-2 4h2.4l-1.4 3 4-5h-2.4l1.4-2z" fill="#ffd23f" stroke="#7a4b00" stroke-width=".5"/>';
  }
  if (/snow/.test(kind)) {
    return c("#dfe5ee") + '<circle cx="8" cy="17.5" r="1.2" fill="#8ea3bf"/><circle cx="12.5" cy="18" r="1.2" fill="#8ea3bf"/><circle cx="16.5" cy="17.3" r="1.2" fill="#8ea3bf"/>';
  }
  return c("#c7d0dc") + '<path d="M8 16.5l-1 2.5M12 16.5l-1 2.5M16 16.5l-1 2.5" stroke="#4f86c9" stroke-width="1.5" stroke-linecap="round"/>';
}
