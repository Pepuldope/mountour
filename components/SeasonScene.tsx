import { useId } from "react";
import { sceneSvg, snowSvg } from "@/lib/season";
import type { Season } from "@/lib/season";

interface Props {
  season: Season;
  width: number;
  height: number;
  seed?: number;
  sunX?: number;
  sunY?: number;
  drop?: number;
  /** Darken the bottom so white text on it stays readable. */
  shade?: boolean;
  className?: string;
}

/** Illustrated seasonal landscape behind the home and trip headers. Decorative. */
export function SeasonScene({ season, width, height, seed, sunX, sunY, drop, shade, className }: Props) {
  const id = `sc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  let body = sceneSvg(season, width, height, { id, seed, sunX, sunY, drop });
  if (season === "zima") body += snowSvg(width, height * 0.8, (seed ?? 7) + 2);
  if (shade)
    body += `<defs><linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#${id}-shade)"/>`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={className}
      // Generated from constants in lib/season.ts, no user data.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
