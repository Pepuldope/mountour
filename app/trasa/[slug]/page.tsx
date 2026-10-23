import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { routeWalk, trailDetailFrom } from "@/lib/data";
import { pickWalk } from "@/lib/walkFacts";
import { getTripLive } from "@/lib/tripDb";
import { getAllTripSlugs } from "@/lib/tripFiles";
import { formatDistance, formatDuration } from "@/lib/format";
import { TripSheet } from "@/components/TripSheet";
import { pageMetadata } from "@/lib/seo";

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

/** One database read per request, shared by the metadata and the page. */
const loadTrip = cache(async (slug: string) => {
  const { trip } = await getTripLive(slug);
  return trip ? { trip, detail: trailDetailFrom(trip) } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = (await loadTrip(slug))?.detail;
  if (!detail) return { title: "Trasa sa nenašla", robots: { index: false } };
  const { trail } = detail;
  // The same walk as the page's facts (from the default parking), so search results don't show another number.
  const w = pickWalk(routeWalk(detail), false, detail.parkingLots.length > 0);
  const facts = `${formatDistance(w?.m ?? trail.distance_m)}, +${w?.ascentM ?? trail.ascent_m} m, ${formatDuration(w?.min ?? trail.duration_min)} chôdze`;
  return pageMetadata({
    title: `${trail.name} – túra, parkovanie a čas návratu`,
    description: `${trail.name}: ${facts}. Kde zaparkovať, kedy najneskôr vyraziť a stihnúť návrat za svetla.`,
    path: `/trasa/${trail.slug}`,
  });
}

function plainSlug(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // Not encoded.
  }
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function TripSheetPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await loadTrip(slug);
  if (!loaded) {
    // A typed or pasted name ("Kriváň", "velky choc") still finds the trip.
    const plain = plainSlug(slug);
    if (plain !== slug && (await loadTrip(plain))) permanentRedirect(`/trasa/${plain}`);
    notFound();
  }
  const { trip, detail } = loaded;
  return <TripSheet trip={trip} detail={detail} />;
}
