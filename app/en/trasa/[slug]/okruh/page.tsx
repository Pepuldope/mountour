import type { Metadata } from "next";
import { LoopTrip, loopMetadata } from "@/components/LoopTrip";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return loopMetadata((await params).slug, "en");
}

export default async function LoopTripPage({ params }: Props) {
  return <LoopTrip slug={(await params).slug} lang="en" />;
}
