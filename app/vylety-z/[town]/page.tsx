import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { TownTile } from "@/components/TownTile";
import { getTown, getTownTrips } from "@/lib/townTrips";
import { townGenitive } from "@/lib/townNames";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ town: string }>;
}

// Drawn on the first visit and kept (lib/pageCache.ts): prebuilding ~140 more pages
// would push the deploy past Cloudflare's 20,000-file limit.
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ town: string }[]> {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const town = getTown((await params).town);
  if (!town) return { title: "Mesto sa nenašlo", robots: { index: false } };
  return pageMetadata({
    title: `Výlety na jeden deň: ${town.name} a okolie`,
    description: `Jednodňové výlety do hôr a prírody do hodiny a pol autom z mesta ${town.name}: hrady, vrcholy, jaskyne, výlety s deťmi. Koľko trvá cesta a túra a kedy vyraziť.`,
    path: `/vylety-z/${town.id}`,
  });
}

/** A browse page: rows of photo tiles, the place first and the facts second. */
export default async function TownPage({ params }: Props) {
  const data = await getTownTrips((await params).town);
  if (!data) notFound();
  const { town, total, rows } = data;
  const credits = rows.flatMap((r) => r.tiles).filter((t, i, all) => t.photo && all.findIndex((x) => x.slug === t.slug) === i);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <Link href="/" className="w-fit text-sm font-semibold text-[var(--accent)]">
        ← Všetky výlety
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-[2.3rem] leading-none font-extrabold tracking-tight">Okolo {townGenitive(town.id, town.name)}</h1>
        <p className="font-medium text-[var(--muted)]">{total} výletov do hodiny a pol autom</p>
      </header>
      {rows.map((row) => (
        <section key={row.title} className="flex flex-col gap-2.5">
          <h2 className="flex items-baseline justify-between gap-2 text-[1.35rem] leading-tight font-extrabold tracking-tight">
            {row.title}
            <span className="text-sm font-medium text-[var(--muted)]">{row.count}</span>
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none]">
            {row.tiles.map((tile) => (
              <TownTile key={tile.slug} tile={tile} />
            ))}
          </div>
        </section>
      ))}
      <Link
        href="/"
        className="flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] font-bold text-[var(--accent-contrast)]"
      >
        Všetky výlety na mape
      </Link>
      {credits.length > 0 && (
        <details className="text-[13px] text-[var(--muted)]">
          <summary className="cursor-pointer font-semibold">Autori fotiek</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {credits.map((t) => (
              <li key={t.slug}>
                {t.name}:{" "}
                <a href={t.photo!.page} className="underline" rel="noopener">
                  {t.photo!.author}
                </a>
                , {t.photo!.license}, Wikimedia Commons
              </li>
            ))}
          </ul>
        </details>
      )}
      <SiteFooter />
    </main>
  );
}
