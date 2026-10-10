import Link from "next/link";
import { notFound } from "next/navigation";
import { driveDestination, getTrailBySlug, sunLocation } from "@/lib/data";
import { gpxUrlFor } from "@/lib/gpx";
import { DIFFICULTY_LABEL, formatDuration } from "@/lib/format";
import { MARKING_COLOR, MARKING_LABEL } from "@/lib/mapLayers";
import { ParkingBlock } from "@/components/ParkingBlock";
import { TransitBlock } from "@/components/TransitBlock";
import { ClosureBanner } from "@/components/ClosureBanner";
import { TripPlanner } from "@/components/TripPlanner";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { SiteFooter } from "@/components/SiteFooter";
import { TripMap } from "@/components/TripMap";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TripSheetPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getTrailBySlug(slug);
  if (!detail) notFound();

  const { trail, parkingLots, transitStops, closures } = detail;
  const gpxUrl = gpxUrlFor(trail.gpx_path);
  const sun = sunLocation(detail);
  const destination = driveDestination(detail);
  const km = (trail.distance_m / 1000).toFixed(1).replace(".", ",");

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-row">
      <div className="flex w-full flex-col gap-5 px-4 pt-4 pb-6 lg:w-[460px] lg:shrink-0 lg:overflow-y-auto">
        <nav aria-label="Navigácia" className="flex items-center justify-between gap-2">
          <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
            ← Kam dnes
          </Link>
          <SavedTripsLink />
        </nav>

        <header className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-[1.65rem] leading-tight font-extrabold">
            {trail.marking && (
              <span
                className="trail-mark"
                style={{ ["--mark" as string]: MARKING_COLOR[trail.marking] }}
                title={MARKING_LABEL[trail.marking]}
              />
            )}
            {trail.name}
          </h1>
          <p className="font-data flex flex-wrap gap-x-3 text-[17px] text-[var(--muted)]">
            <span>{km} km</span>
            <span>+{trail.ascent_m} m</span>
            <span>{formatDuration(trail.duration_min)} chôdze</span>
            <span>{DIFFICULTY_LABEL[trail.difficulty].toLowerCase()}</span>
            {trail.family_friendly && <span className="text-[var(--ok)]">vhodné pre deti</span>}
          </p>
          {trail.description && <p className="text-sm">{trail.description}</p>}
        </header>

        <ClosureBanner closures={closures} />

        <TripPlanner
          slug={trail.slug}
          name={trail.name}
          difficulty={trail.difficulty}
          familyFriendly={trail.family_friendly}
          sun={sun}
          destination={destination}
          baseHikeMin={trail.duration_min}
          gpxUrl={gpxUrl}
          bbox={trail.bbox}
        />

        <ParkingBlock parking={parkingLots[0] ?? null} />

        <TransitBlock stops={transitStops} />

        <div className="h-[45vh] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] lg:hidden">
          <TripMap detail={detail} gpxUrl={gpxUrl} destination={destination} />
        </div>

        {gpxUrl && (
          <section className="flex flex-col gap-1 text-sm">
            <h2 className="text-base font-bold">Na túru</h2>
            <a href={gpxUrl} download className="w-fit font-semibold text-[var(--accent)] underline">
              Stiahnuť GPX trasu
            </a>
          </section>
        )}

        <SiteFooter />
      </div>

      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:flex-1 lg:border-l lg:border-[var(--border)]">
        <TripMap detail={detail} gpxUrl={gpxUrl} destination={destination} />
      </div>
    </main>
  );
}
