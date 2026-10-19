import Link from "next/link";
import { formatDurationShort } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { GOAL_COLOUR } from "@/lib/palette";
import type { TownTile as Tile } from "@/lib/townTrips";

/** A town page tile: the place's photo (or its kind's colour and a hill), name, drive and walk. */
export function TownTile({ tile }: { tile: Tile }) {
  const colour = GOAL_COLOUR[tile.kind] ?? GOAL_COLOUR.ine;
  return (
    <Link href={`/trasa/${tile.slug}`} className="flex w-[150px] flex-none snap-start flex-col gap-1.5 text-inherit no-underline">
      <span
        className="relative block aspect-square overflow-hidden rounded-2xl"
        style={{ background: `linear-gradient(170deg, ${colour}, ${colour}dd)` }}
      >
        {tile.photo ? (
          // Plain img: Commons already serves a thumbnail of the right size.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.photo.url}
            alt=""
            loading="lazy"
            decoding="async"
            width={tile.photo.w}
            height={tile.photo.h}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <svg viewBox="0 0 150 150" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <path d="M0 150 L0 92 L28 74 L52 86 L80 58 L104 78 L128 66 L150 80 L150 150Z" fill="#fff" opacity=".16" />
            <path d="M0 150 L0 112 L34 96 L62 108 L92 84 L120 102 L150 94 L150 150Z" fill="#fff" opacity=".34" />
          </svg>
        )}
        <span
          className="absolute top-2 left-2 grid h-[30px] w-[30px] place-items-center rounded-[9px] text-white"
          style={{ background: tile.photo ? colour : "rgba(255,255,255,.22)" }}
          dangerouslySetInnerHTML={{ __html: kindSvg(tile.kind, 20) }}
        />
        {tile.kids && (
          <span className="absolute top-2.5 right-2 rounded-full bg-white/90 px-2 text-xs font-bold text-[#17663a]">pre deti</span>
        )}
      </span>
      <span className="text-[15px] leading-tight font-bold">{tile.name}</span>
      <span className="flex flex-wrap gap-x-2 text-[13px] text-[var(--muted)]">
        <span>{formatDurationShort(tile.carMin)} autom</span>
        <span>{formatDurationShort(tile.walkMin)} pešo</span>
      </span>
    </Link>
  );
}
