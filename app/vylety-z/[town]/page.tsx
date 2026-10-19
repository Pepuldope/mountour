import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { TownTripList } from "@/components/TownTripList";
import { getTown, getTownTrips } from "@/lib/townTrips";
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

export default async function TownPage({ params }: Props) {
  const data = await getTownTrips((await params).town);
  if (!data) notFound();
  const { town, bands, total, kids } = data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/" className="w-fit text-sm font-semibold text-[var(--accent)]">
        ← Všetky výlety
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.65rem] leading-tight font-extrabold">Výlety na jeden deň: {town.name}</h1>
        <p className="text-sm text-[var(--muted)]">
          {total} výletov do hodiny a pol autom, {kids} z nich pre deti. Najznámejšie navrchu.
        </p>
      </header>
      {bands.map(
        (band) =>
          band.trips.length > 0 && (
            <section key={band.label} className="flex flex-col gap-2">
              <h2 className="flex items-baseline justify-between gap-2 text-base font-semibold">
                {band.label}
                <span className="text-xs font-normal text-[var(--muted)]">{band.count} výletov</span>
              </h2>
              <TownTripList trips={band.trips} />
            </section>
          ),
      )}
      <Link
        href="/"
        className="flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] font-bold text-[var(--accent-contrast)]"
      >
        Všetky výlety na mape
      </Link>
      <SiteFooter />
    </main>
  );
}
