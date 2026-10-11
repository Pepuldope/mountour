import { kindSvg } from "@/lib/kindIcons";
import type { DestinationKind, PoiKind } from "@/lib/tripSchema";

/** A goal or place pictogram in its own colour (from lib/palette.ts) on a soft tile. */
export function KindIcon({ kind, colour, size = 30 }: { kind: DestinationKind | PoiKind; colour: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[9px]"
      style={{ width: size, height: size, background: `${colour}1f`, color: colour }}
      // Constant markup from lib/kindIcons.ts, no user data.
      dangerouslySetInnerHTML={{ __html: kindSvg(kind, Math.round(size * 0.57)) }}
    />
  );
}
