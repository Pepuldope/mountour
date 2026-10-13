import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getTrip } from "@/lib/tripFiles";
import { UiIcon } from "@/components/UiIcon";
import { RouteCompare } from "@/components/RouteCompare";

interface Props {
  params: Promise<{ slug: string }>;
}

// The routes of a place come with each trip's own file (the database row doesn't carry them).
const loadTrip = cache((slug: string) => getTrip(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const trip = await loadTrip((await params).slug);
  return {
    title: trip ? `Cesty na ${trip.destination.name}` : "Trasa sa nenašla",
    // The same routes as the trip pages: those are the ones to find in search.
    robots: { index: false },
  };
}

/** Every route to one place on one map, side by side, to pick from. */
export default async function RoutesComparePage({ params }: Props) {
  const { slug } = await params;
  const trip = await loadTrip(slug);
  if (!trip) notFound();
  const routes = trip.routes ?? [];
  if (routes.length < 2) redirect(`/trasa/${slug}`);

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-none lg:flex-row lg:overflow-hidden">
      <RouteCompare slug={slug} destination={trip.destination.name} goal={trip.destination.location} routes={routes}>
        <nav aria-label="Navigácia" className="flex items-center gap-3">
          <Link
            href={`/trasa/${slug}`}
            className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-semibold"
          >
            <UiIcon name="back" size={15} />
            Späť
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight">Cesty na {trip.destination.name}</h1>
        </nav>
      </RouteCompare>
    </main>
  );
}
