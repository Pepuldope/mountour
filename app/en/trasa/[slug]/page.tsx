import type { Metadata } from "next";
import { getAllTrails } from "@/lib/tripFiles";
import { TripRoute, tripMetadata } from "@/components/TripRoute";
import { EN_TRIPS_AHEAD } from "@/lib/site";

interface Props {
  params: Promise<{ slug: string }>;
}

// English trip pages: only the best known are built ahead (EN_TRIPS_AHEAD); the rest are drawn on
// their first visit and kept in the page cache until the next deploy (lib/pageCache.ts).
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return (await getAllTrails()).slice(0, EN_TRIPS_AHEAD).map(({ trail }) => ({ slug: trail.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return tripMetadata((await params).slug, "en");
}

export default async function EnglishTripPage({ params }: Props) {
  return <TripRoute slug={(await params).slug} lang="en" />;
}
