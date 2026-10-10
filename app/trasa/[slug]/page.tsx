import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { driveDestination, getTrailBySlug, primaryTrailhead, sunLocation } from "@/lib/data";
import { gpxUrlFor } from "@/lib/gpx";
import { DIFFICULTY_LABEL, formatDistance, formatDuration } from "@/lib/format";
import { ParkingBlock } from "@/components/ParkingBlock";
import { TransitBlock } from "@/components/TransitBlock";
import { ClosureBanner } from "@/components/ClosureBanner";
import { TripInputs } from "@/components/TripInputs";
import { DayPlanView } from "@/components/DayPlanView";
import { SaveTripButton } from "@/components/SaveTripButton";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { TripMap } from "@/components/TripMap";
import { JsonLd } from "@/components/JsonLd";
import { TrackEvent } from "@/components/TrackEvent";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import type { TrailDetail } from "@/lib/types";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getTrailBySlug(slug);
  if (!detail) return { title: "Trasa sa nenašla", robots: { index: false } };
  const { trail } = detail;
  const facts = `${formatDistance(trail.distance_m)}, +${trail.ascent_m} m, ${formatDuration(trail.duration_min)} chôdze`;
  return pageMetadata({
    title: `${trail.name} – túra, parkovanie a čas návratu`,
    description: `${trail.name}: ${facts}. Kde zaparkovať, kedy najneskôr vyraziť a stihnúť návrat za svetla.`,
    path: `/trasa/${trail.slug}`,
  });
}

/** schema.org data: the trail as a place to visit + breadcrumbs. */
function trailJsonLd(detail: TrailDetail) {
  const { trail } = detail;
  const url = absoluteUrl(`/trasa/${trail.slug}`);
  const start = primaryTrailhead(detail)?.location;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        "@id": `${url}#trail`,
        name: trail.name,
        url,
        ...(trail.description ? { description: trail.description } : {}),
        image: absoluteUrl("/og-image.png"),
        isAccessibleForFree: true,
        publicAccess: true,
        touristType: trail.family_friendly ? ["Rodiny s deťmi", "Turisti"] : ["Turisti"],
        ...(start ? { geo: { "@type": "GeoCoordinates", latitude: start.lat, longitude: start.lon } } : {}),
        containedInPlace: { "@type": "Country", name: "Slovensko" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Výlety", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: trail.name, item: url },
        ],
      },
    ],
  };
}

export default async function TripSheetPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getTrailBySlug(slug);
  if (!detail) notFound();

  const { trail, parkingLots, transitStops, closures } = detail;
  const gpxUrl = gpxUrlFor(trail.gpx_path);
  const primaryParking = parkingLots[0] ?? null;
  const sun = sunLocation(detail);
  const destination = driveDestination(detail);

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-row">
      <JsonLd data={trailJsonLd(detail)} />
      <TrackEvent name="trip_open" data={{ trail: trail.slug }} />
      {/* Visual side: a short map on top on phones; on desktop a sticky column of map + day plan. */}
      <div className="flex w-full flex-col border-b border-[var(--border)] lg:sticky lg:top-0 lg:order-2 lg:h-dvh lg:flex-1 lg:border-b-0 lg:border-l">
        <div className="h-[30vh] overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1">
          <TripMap detail={detail} gpxUrl={gpxUrl} destination={destination} />
        </div>
        <div className="hidden h-[42vh] shrink-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--card-bg)] p-4 lg:block">
          <DayPlanView sun={sun} destination={destination} hikeMin={trail.duration_min} />
        </div>
      </div>

      <div className="flex w-full flex-col gap-5 px-4 py-6 lg:order-1 lg:w-[440px] lg:shrink-0 lg:overflow-y-auto">
        <nav aria-label="Navigácia" className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="w-fit text-sm font-medium text-[var(--accent)] underline">
            Späť na zoznam trás
          </Link>
          <SavedTripsLink />
        </nav>

        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--accent)]">{trail.name}</h1>
          {trail.description && <p className="text-sm opacity-80">{trail.description}</p>}
        </header>

        <section className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-sm">
          <div>
            <p className="opacity-60">Dĺžka</p>
            <p className="text-lg font-semibold">{formatDistance(trail.distance_m)}</p>
          </div>
          <div>
            <p className="opacity-60">Prevýšenie</p>
            <p className="text-lg font-semibold">{trail.ascent_m} m</p>
          </div>
          <div>
            <p className="opacity-60">Náročnosť</p>
            <p className="text-lg font-semibold">{DIFFICULTY_LABEL[trail.difficulty]}</p>
          </div>
          <div>
            <p className="opacity-60">Čas chôdze</p>
            <p className="text-lg font-semibold">{formatDuration(trail.duration_min)}</p>
          </div>
        </section>

        <ClosureBanner closures={closures} />

        <TripInputs sun={sun} destination={destination} hikeMin={trail.duration_min} />

        <ParkingBlock parking={primaryParking} />

        <TransitBlock stops={transitStops} />

        <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-sm font-semibold opacity-70">Uložiť výlet</h2>
          <p className="text-sm opacity-80">
            Uloží výlet s dátumom a časom do Uložených výletov v tomto zariadení - aj s mapou a GPX
            trasou, aby fungoval bez signálu.
          </p>
          <SaveTripButton
            slug={trail.slug}
            name={trail.name}
            gpxUrl={gpxUrl}
            bbox={trail.bbox}
            sun={sun}
            destination={destination}
            hikeMin={trail.duration_min}
          />
        </section>
      </div>
    </main>
  );
}
