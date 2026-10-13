// Seasonal looks for the illustrated headers and the sun arc (Feel Lab,
// strategy/12-feel/): fresh green and flowers in spring, a bigger sun in
// summer, autumn trees, snow in winter.

export type Season = "jar" | "leto" | "jesen" | "zima";

/** Meteorological seasons: winter = December to February. */
export function seasonOf(d: Date): Season {
  const m = d.getMonth() + 1;
  if (m === 12 || m <= 2) return "zima";
  if (m <= 5) return "jar";
  if (m <= 8) return "leto";
  return "jesen";
}

interface Land {
  sky1: string;
  sky2: string;
  far: string;
  back: string;
  front: string;
  /** The walk's hill in the sun arc. */
  hill: string;
  /** Sun radius factor (summer sun is bigger). */
  sunScale: number;
  sun: string;
}

export const LAND: Record<Season, Land> = {
  jar: { sky1: "#bfe1f7", sky2: "#f2f8ea", far: "#a9c6dd", back: "#7fbf8e", front: "#a6d784", hill: "#93c38e", sunScale: 1.05, sun: "#ffbe2e" },
  leto: { sky1: "#9fd2f5", sky2: "#fff6dc", far: "#9ebcd8", back: "#5f9f62", front: "#c3cf63", hill: "#7aa56b", sunScale: 1.3, sun: "#ffb000" },
  jesen: { sky1: "#c6dcef", sky2: "#fde9cf", far: "#a9b7cc", back: "#a97a55", front: "#e59d4c", hill: "#b88a62", sunScale: 1, sun: "#ffbe2e" },
  zima: { sky1: "#d3e1ef", sky2: "#f6f1ea", far: "#b6c5d8", back: "#c8d4e3", front: "#f4f7fb", hill: "#d5dde8", sunScale: 0.82, sun: "#ffd27a" },
};

/** Small seeded random numbers, so a scene looks the same on the server and in the browser. */
export function seeded(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

interface SceneOptions {
  seed?: number;
  /** Sun position as a share of width / height. */
  sunX?: number;
  sunY?: number;
  /** Push the mountains down (0..0.3) to leave room for a headline. */
  drop?: number;
  /** Prefix for gradient ids, unique per scene on the page. */
  id: string;
  /** Leave the sun out when it is drawn separately (the home header's pull-to-refresh sun). */
  noSun?: boolean;
}

const r1 = (n: number) => n.toFixed(1);

/** The SVG body of a seasonal landscape (sky, sun, ranges, hills, details), w x h. */
export function sceneSvg(season: Season, w: number, h: number, o: SceneOptions): string {
  const L = LAND[season];
  const r = seeded(o.seed ?? 7);
  const D = o.drop ?? 0;
  const sunR = 11 * L.sunScale * 1.5;
  const sx = w * (o.sunX ?? 0.78);
  const sy = h * (o.sunY ?? 0.3);
  const peak = (x0: number, x1: number, top: number, base: number, jag: number) => {
    let d = `M${x0} ${base}`;
    for (let i = 0; i <= 9; i++) {
      const x = x0 + ((x1 - x0) * i) / 9;
      const k = Math.sin((Math.PI * i) / 9);
      d += ` L${r1(x)} ${r1(base - (base - top) * k - (i % 2 ? jag : 0) * k)}`;
    }
    return `${d} L${x1} ${h} L${x0} ${h}Z`;
  };
  const cap = (x0: number, x1: number, top: number, base: number) => {
    const cx = (x0 + x1) / 2;
    const sp = (x1 - x0) * 0.13;
    const at = (f: number) => r1(top + (base - top) * f);
    return `<path d="M${r1(cx - sp)} ${at(0.24)} L${r1(cx)} ${r1(top - 2)} L${r1(cx + sp)} ${at(0.24)} L${r1(cx + sp * 0.4)} ${at(0.18)} L${r1(cx - sp * 0.2)} ${at(0.27)}Z" fill="#fff" opacity="${season === "zima" ? 1 : 0.8}"/>`;
  };

  let out = `<defs><linearGradient id="${o.id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.sky1}"/><stop offset="1" stop-color="${L.sky2}"/></linearGradient></defs>`;
  out += `<rect width="${w}" height="${h}" fill="url(#${o.id}-sky)"/>`;
  if (season === "leto" && !o.noSun) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      out += `<line x1="${r1(sx + Math.cos(a) * (sunR + 3))}" y1="${r1(sy + Math.sin(a) * (sunR + 3))}" x2="${r1(sx + Math.cos(a) * (sunR + 10))}" y2="${r1(sy + Math.sin(a) * (sunR + 10))}" stroke="#ffb000" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`;
    }
  }
  if (!o.noSun) out += `<circle cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(sunR + 6)}" fill="#ffd36b" opacity=".35"/><circle cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(sunR)}" fill="${L.sun}"/>`;

  const f1: [number, number, number, number] = [-20, w * 0.62, h * (0.38 + D), h * (0.66 + D * 0.6)];
  const f2: [number, number, number, number] = [w * 0.38, w + 30, h * (0.44 + D), h * (0.68 + D * 0.6)];
  out += `<path d="${peak(...f1, 6)}" fill="${L.far}"/><path d="${peak(...f2, 7)}" fill="${L.far}"/>`;
  if (season === "zima" || season === "jar") out += cap(...f1) + cap(...f2);

  let back = `M0 ${r1(h * (0.74 + D * 0.5))}`;
  for (let x = 0; x <= w; x += w / 8) back += ` Q${r1(x + w / 16)} ${r1(h * (0.62 + D * 0.6 + r() * 0.08))} ${r1(x + w / 8)} ${r1(h * (0.72 + D * 0.5 + r() * 0.05))}`;
  out += `<path d="${back} L${w} ${h} L0 ${h}Z" fill="${L.back}"/>`;
  let front = `M0 ${r1(h * 0.86)}`;
  for (let x = 0; x <= w; x += w / 5) front += ` Q${r1(x + w / 10)} ${r1(h * (0.78 + r() * 0.06))} ${r1(x + w / 5)} ${r1(h * (0.84 + r() * 0.04))}`;
  out += `<path d="${front} L${w} ${h} L0 ${h}Z" fill="${L.front}"/>`;
  out += seasonDetails(season, r, () => [r() * w, h * (0.8 + r() * 0.17)], 18);
  return out;
}

/** Trees, flowers or snowy firs scattered on the ground. */
export function seasonDetails(season: Season, r: () => number, at: (i: number) => [number, number], n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    const [x, y] = at(i);
    if (season === "jesen")
      out += `<circle cx="${r1(x)}" cy="${r1(y - 6)}" r="${r1(4 + r() * 3)}" fill="${["#d9532c", "#f0a030", "#b8452a", "#e8c040"][i % 4]}"/><rect x="${r1(x - 0.8)}" y="${r1(y - 3)}" width="1.6" height="6" fill="#6b4a33"/>`;
    else if (season === "jar") out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.9" fill="${["#fff", "#ffd84d", "#f59bc0"][i % 3]}"/>`;
    else if (season === "leto" && i % 2 === 0) out += `<path d="M${r1(x)} ${r1(y)} l3 -9 l3 9z" fill="#3f7d42"/>`;
    else if (season === "zima" && i % 2 === 0)
      out += `<path d="M${r1(x)} ${r1(y)} l3.5 -11 l3.5 11z" fill="#3f6b57"/><path d="M${r1(x + 1.6)} ${r1(y - 6)} l1.9 -5 l1.9 5z" fill="#fff"/>`;
  }
  return out;
}

/** Falling snow (winter only); hidden for people who prefer less motion. */
export function snowSvg(w: number, h: number, seed: number, n = 24): string {
  const r = seeded(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    out += `<circle class="mt-flake" cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.9 + r() * 1.3)}" fill="#fff" opacity=".9"><animate attributeName="cy" from="${r1(y - h * 0.25)}" to="${r1(y + h * 0.25)}" dur="${r1(5 + r() * 5)}s" repeatCount="indefinite"/></circle>`;
  }
  return out;
}
