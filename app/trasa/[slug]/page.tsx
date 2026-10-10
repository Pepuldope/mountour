import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrailBySlug, trailCenter } from "@/lib/data";
import { gpxUrlFor } from "@/lib/gpx";
import { DIFFICULTY_LABEL, formatDistance, formatDuration } from "@/lib/format";
import { ParkingBlock } from "@/components/ParkingBlock";
import { TransitBlock } from "@/components/TransitBlock";
import { ClosureBanner } from "@/components/ClosureBanner";
import { DayTimeline } from "@/components/DayTimeline";
import { OfflineSaveButton } from "@/components/OfflineSaveButton";
import { TripMap } from "@/components/TripMap";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TripSheetPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getTrailBySlug(slug);
  if (!detail) notFound();

  const { trail, trailheads, parkingLots, transitStops, closures } = detail;
  const gpxUrl = gpxUrlFor(trail.gpx_path);
  const primaryParking = parkingLots[0] ?? null;
  const primaryTrailhead = trailheads.find((t) => t.is_primary) ?? trailheads[0] ?? null;
  const center = primaryParking?.location ?? trailCenter(trail);
  // The drive ends at the parking lot; without one, at the trailhead itself.
  const destination = primaryParking?.location ?? primaryTrailhead?.location ?? center;

  return (
    <main className="flex flex-1 flex-col lg:h-dvh lg:flex-row">
      {/* Map: on top on phones, sticky full-height right column on desktop. */}
      <div className="h-[40vh] w-full overflow-hidden border-b border-[var(--border)] lg:sticky lg:top-0 lg:order-2 lg:h-dvh lg:flex-1 lg:border-b-0 lg:border-l">
        <TripMap detail={detail} gpxUrl={gpxUrl} destination={destination} />
      </div>

      <div className="flex w-full flex-col gap-5 px-4 py-6 lg:order-1 lg:w-[440px] lg:shrink-0 lg:overflow-y-auto">
        <Link href="/" className="w-fit text-sm font-medium text-[var(--accent)] underline">
          Späť na zoznam trás
        </Link>

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

        {center && destination && (
          <DayTimeline location={center} destination={destination} hikeMin={trail.duration_min} />
        )}

        <ParkingBlock parking={primaryParking} />

        <TransitBlock stops={transitStops} />

        <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <h2 className="text-sm font-semibold opacity-70">Offline</h2>
          <p className="text-sm opacity-80">
            Ulož si túto stránku, GPX trasu a mapové podklady, aby fungovali aj bez signálu.
          </p>
          <OfflineSaveButton slug={trail.slug} gpxUrl={gpxUrl} bbox={trail.bbox} />
        </section>
      </div>
    </main>
  );
}
