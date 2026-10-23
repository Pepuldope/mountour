import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { trailDetailFrom } from "@/lib/data";
import { loopPartner, loopTrip } from "@/lib/loopRoute";
import { getTrip } from "@/lib/tripFiles";
import { TripSheet } from "@/components/TripSheet";

interface Props {
  params: Promise<{ slug: string }>;
}

// A route walked as a loop: up this way, back by another route from the same start
// (lib/loopRoute.ts). Drawn on the first visit, then served from the page cache until the next
// deploy (lib/pageCache.ts), so the ~800 loops cost no files in the deploy.
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

const loadLoop = cache(async (slug: string) => {
  const own = await getTrip(slug);
  if (!own || own.route === "okruh") return null;
  const routes = own.routes ?? (own.variant_of ? ((await getTrip(own.variant_of))?.routes ?? []) : []);
  const back = loopPartner(slug, routes);
  const other = back ? await getTrip(back.slug) : null;
  if (!back || !other) return null;
  const trip = { ...loopTrip(own, other), routes };
  return { trip, detail: trailDetailFrom(trip), back };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loop = await loadLoop((await params).slug);
  return {
    title: loop ? `${loop.trip.name} – okruh` : "Trasa sa nenašla",
    // The trip page itself is the one to find in search.
    robots: { index: false },
  };
}

export default async function LoopTripPage({ params }: Props) {
  const { slug } = await params;
  const loop = await loadLoop(slug);
  if (!loop) {
    if (await getTrip(slug)) redirect(`/trasa/${slug}`);
    notFound();
  }
  return <TripSheet trip={loop.trip} detail={loop.detail} loopBack={loop.back} />;
}
