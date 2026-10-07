import { notFound } from "next/navigation";
import { getTrailBySlug, trailCenter } from "@/lib/data";
import { DIFFICULTY_LABEL, formatDistance, formatDuration } from "@/lib/format";
import { ParkingBlock } from "@/components/ParkingBlock";
import { ClosureBanner } from "@/components/ClosureBanner";
import { SunsetCard } from "@/components/SunsetCard";
import { OfflineSaveButton } from "@/components/OfflineSaveButton";
import { TripMap } from "@/components/TripMapClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TripSheetPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getTrailBySlug(slug);
  if (!detail) notFound();

  const { trail, parkingLots, closures, pois } = detail;
  const gpxUrl = trail.gpx_path ? `/gpx/${trail.gpx_path.split("/").pop()}` : null;
  const primaryParking = parkingLots[0] ?? null;
  const center = primaryParking?.location ?? trailCenter(trail);

  return (
    <main className="flex-1 flex flex-col mx-auto w-full max-w-lg gap-5 px-4 py-6">
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
          <p className="opacity-60">Čas chodze</p>
          <p className="text-lg font-semibold">{formatDuration(trail.duration_min)}</p>
        </div>
      </section>

      <TripMap gpxUrl={gpxUrl} bbox={trail.bbox} parkingLots={parkingLots} pois={pois} />

      {primaryParking ? (
        <ParkingBlock parking={primaryParking} />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
          <p className="font-semibold">Parkovanie neevidujeme</p>
        </div>
      )}

      {center && <SunsetCard location={center} durationMin={trail.duration_min} />}

      <ClosureBanner closures={closures} />

      <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
        <h2 className="text-sm font-semibold opacity-70">Offline</h2>
        <p className="text-sm opacity-80">
          Ulož si túto stránku, GPX trasu a mapové podklady, aby fungovali aj bez signálu.
        </p>
        <OfflineSaveButton slug={trail.slug} gpxUrl={gpxUrl} bbox={trail.bbox} />
      </section>
    </main>
  );
}
