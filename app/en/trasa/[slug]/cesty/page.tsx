import type { Metadata } from "next";
import { RoutesCompareView, compareMetadata } from "@/components/RoutesCompareView";

interface Props {
  params: Promise<{ slug: string }>;
}

// The routes of a place come with each trip's own file (the database row doesn't carry them).
// Drawn on the first visit, then served from the page cache until the next deploy
// (lib/pageCache.ts): drawing a trip page on every visit ran the free Worker out of CPU.
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return compareMetadata((await params).slug, "en");
}

/** Every route to one place on one map, side by side, to pick from. */
export default async function RoutesComparePage({ params }: Props) {
  return <RoutesCompareView slug={(await params).slug} lang="en" />;
}
