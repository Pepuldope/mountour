// Weather symbols for the day strip (24x24). A grey cloud with what falls from
// it in colour; `mono` draws everything in currentColor for the picked (blue) day.
import type { BadSky } from "@/lib/weather";

const CLOUD = "M6.5 14.5h11a4 4 0 0 0 .4-8A5.6 5.6 0 0 0 7.1 8 3.3 3.3 0 0 0 6.5 14.5z";

export const BAD_SKY_LABEL: Record<BadSky, string> = {
  rain: "dážď",
  sleet: "dážď so snehom",
  snow: "sneženie",
  fog: "hmla",
  thunder: "búrky",
};

export function badSkySvg(kind: BadSky, mono: boolean): string {
  const cloud = mono ? "currentColor" : "#8a9ab1";
  const drop = mono ? "currentColor" : "#1769d1";
  const snow = mono ? "currentColor" : "#5b8fd6";
  const bolt = mono ? "currentColor" : "#f0a500";
  const drops = (xs: number[]) => xs.map((x) => `M${x} 17.2l-1 2.8`).join("");
  const flakes = (xs: number[]) => xs.map((x) => `<circle cx="${x}" cy="19" r="1.3" fill="${snow}"/>`).join("");
  switch (kind) {
    case "rain":
      return `<path d="${CLOUD}" fill="${cloud}"/><path d="${drops([8.5, 12.5, 16.5])}" stroke="${drop}" stroke-width="2" stroke-linecap="round"/>`;
    case "sleet":
      return `<path d="${CLOUD}" fill="${cloud}"/><path d="${drops([8.5, 16.5])}" stroke="${drop}" stroke-width="2" stroke-linecap="round"/>${flakes([12.5])}`;
    case "snow":
      return `<path d="${CLOUD}" fill="${cloud}"/>${flakes([8, 12.5, 17])}`;
    case "fog":
      return `<path d="M4 8.5h16M3 12.5h18M5 16.5h14" stroke="${cloud}" stroke-width="2.2" stroke-linecap="round"/>`;
    case "thunder":
      return `<path d="${CLOUD}" fill="${cloud}"/><path d="M12.8 13.2 10 18h3l-1.4 4.2 4.2-5.6h-3l1.3-3.4z" fill="${bolt}"/>`;
  }
}
