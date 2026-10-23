import Link from "next/link";

/**
 * The way back: the same way, or down another route from the same start as a loop
 * (/trasa/<slug>/okruh, lib/loopRoute.ts). Peter picked a choice on the trip page over separate
 * loop routes (2026-10-23).
 */
export function LoopChoice({ slug, loop, back }: { slug: string; loop: boolean; back: string }) {
  const pill = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-full px-3 py-2 text-center text-[14px] font-semibold ${
      on ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"
    }`;
  return (
    <section aria-label="Cesta späť" className="flex flex-col gap-1.5">
      <h2 className="text-base font-bold">Späť</h2>
      <div className="flex rounded-full bg-[var(--segment-bg)] p-1">
        <Link href={`/trasa/${slug}`} scroll={false} aria-current={loop ? undefined : "page"} className={pill(!loop)}>
          Rovnakou cestou
        </Link>
        <Link href={`/trasa/${slug}/okruh`} scroll={false} aria-current={loop ? "page" : undefined} className={pill(loop)}>
          Inou cestou · okruh
        </Link>
      </div>
      <p className="text-xs text-[var(--muted)]">{loop ? `Dole po trase ${back}. Časy aj mapa rátajú okruh.` : `Okruh: dole po trase ${back}, štart a cieľ na tom istom mieste.`}</p>
    </section>
  );
}
