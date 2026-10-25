import type { Metadata } from "next";
import { TownView, townMetadata } from "@/components/TownView";
import { getTowns } from "@/lib/trips";

interface Props {
  params: Promise<{ town: string }>;
}

// Built ahead like the trip pages: drawing one reads the whole 2.4 MB trip index,
// too much for a first visit on the free plan's CPU time. ~140 towns add a few
// hundred files, well under the 20,000-file limit (scripts/check-page-cache.mjs).
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ town: string }[]> {
  return getTowns().map((t) => ({ town: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return townMetadata((await params).town, "sk");
}

/** A browse page: rows of photo tiles, the place first and the facts second (components/TownView.tsx). */
export default async function TownPage({ params }: Props) {
  return <TownView id={(await params).town} lang="sk" />;
}
