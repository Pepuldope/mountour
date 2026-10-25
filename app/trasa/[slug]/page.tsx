import type { Metadata } from "next";
import { getAllTripSlugs } from "@/lib/tripFiles";
import { TripRoute, tripMetadata } from "@/components/TripRoute";

interface Props {
  params: Promise<{ slug: string }>;
}

// Every trip page is drawn at build time and ships as a stored file (lib/pageCache.ts), so
// even its first visit is quick: drawn on the first visit instead, a page took a second or
// two after each deploy, and drawing it on every visit ran the free Worker out of CPU.
// A trip newer than the build (or a typed name, redirected below) is drawn once and kept.
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return (await getAllTripSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return tripMetadata((await params).slug, "sk");
}

export default async function TripSheetPage({ params }: Props) {
  return <TripRoute slug={(await params).slug} lang="sk" />;
}
