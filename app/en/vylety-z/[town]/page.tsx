import type { Metadata } from "next";
import { TownView, townMetadata } from "@/components/TownView";
import { getTowns } from "@/lib/trips";

interface Props {
  params: Promise<{ town: string }>;
}

// The English town pages, built ahead like the Slovak ones (app/vylety-z/[town]).
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ town: string }[]> {
  return getTowns().map((t) => ({ town: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return townMetadata((await params).town, "en");
}

/** A browse page: rows of photo tiles, the place first and the facts second (components/TownView.tsx). */
export default async function TownPage({ params }: Props) {
  return <TownView id={(await params).town} lang="en" />;
}
