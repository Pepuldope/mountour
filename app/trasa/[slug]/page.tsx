import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { primaryTrailhead, sunLocation, trailDetailFrom } from "@/lib/data";
import { gpxUrlFor } from "@/lib/gpx";
import { getTripLive } from "@/lib/tripDb";
import { buildProfile } from "@/lib/tripProfile";
import { GOAL_LABEL, POI_LABEL, formatDistance, formatDuration } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { GOAL_COLOUR, POI_COLOUR } from "@/lib/palette";
import { seasonOf } from "@/lib/season";
import { SeasonScene } from "@/components/SeasonScene";
import { UiIcon } from "@/components/UiIcon";
import { FeeBlock } from "@/components/FeeBlock";
import { ParkingBlock } from "@/components/ParkingBlock";
import { PoiList } from "@/components/PoiList";
import { StopsBlock } from "@/components/TransitBlock";
import { ClosureBanner } from "@/components/ClosureBanner";
import { TripPlanner } from "@/components/TripPlanner";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { SiteFooter } from "@/components/SiteFooter";
import { TripFacts } from "@/components/TripFacts";
import { TripMap } from "@/components/TripMap";
import { TripAccessProvider } from "@/components/TripAccess";
import { JsonLd } from "@/components/JsonLd";
import { TrackEvent } from "@/components/TrackEvent";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import type { TrailDetail } from "@/lib/types";

interface Props {
  params: Promise<{ slug: string }>;
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

/** A second reason to go, from what the walk passes: a hut, a castle or a viewpoint. */
function secondGoal(detail: TrailDetail): "chata" | "hrad" | "vyhliadka" | null {
  const goal = detail.trail.goal;
  const kinds = new Set(detail.pois.map((p) => p.kind));
  for (const k of ["chata", "hrad", "vyhliadka"] as const) if (k !== goal && kinds.has(k)) return k;
  return null;
}

function Badge({ colour, icon, children }: { colour: string; icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-[12.5px] font-bold text-white" style={{ background: colour }}>
      <span
        aria-hidden
        className="inline-flex"
        // Constant markup from lib/kindIcons.ts, no user data.
        dangerouslySetInnerHTML={{ __html: icon }}
      />
      {children}
    </span>
  );
}

export default async function TripSheetPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await loadTrip(slug);
  if (!loaded) notFound();
  const { trip, detail } = loaded;

  const { trail, parkingLots, transitStops, closures, fees } = detail;
  const trailStart = primaryTrailhead(detail)?.location ?? null;
  const profile = buildProfile(trip);
  const gpxUrl = gpxUrlFor(trail.gpx_path);
  const sun = sunLocation(detail);
  const goal = trail.goal ?? "ine";
  const also = secondGoal(detail);
  const goalEle = trip?.destination.ele_m;

  return (
    <TripAccessProvider slug={trail.slug} parkingLots={parkingLots} transitStops={transitStops} trailStart={trailStart}>
      <main className="flex flex-1 flex-col lg:h-dvh lg:flex-none lg:flex-row lg:overflow-hidden">
        <JsonLd data={trailJsonLd(detail)} />
        <TrackEvent name="trip_open" data={{ trail: trail.slug }} />
        <div className="flex w-full flex-col gap-5 px-4 pt-4 pb-6 lg:w-[460px] lg:shrink-0 relative lg:overflow-y-auto lg:overscroll-contain">
          <header className="relative -mx-4 -mt-4 flex h-[220px] flex-col justify-between">
            <SeasonScene season={seasonOf(new Date())} width={460} height={220} seed={3} sunX={0.2} sunY={0.28} shade className="absolute inset-0 h-full w-full" />
            <nav aria-label="Navigácia" className="relative flex items-center justify-between gap-2 px-4 pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)]/90 px-3 py-1.5 text-sm font-semibold"
              >
                <UiIcon name="back" size={15} />
                Kam dnes
              </Link>
              <SavedTripsLink />
            </nav>
            <div className="relative flex flex-col gap-1.5 px-4 pb-3.5 text-white">
              <div className="flex flex-wrap gap-1.5">
                <Badge colour={GOAL_COLOUR[goal]} icon={kindSvg(goal, 16)}>
                  {GOAL_LABEL[goal]}
                  {goalEle ? ` · ${goalEle} m` : ""}
                </Badge>
                {also && (
                  <Badge colour={POI_COLOUR[also]} icon={kindSvg(also, 16)}>
                    {POI_LABEL[also]} na trase
                  </Badge>
                )}
              </div>
              <h1 className="text-[2.4rem] leading-none font-extrabold tracking-tight [text-shadow:0_1px_12px_rgba(0,0,0,.25)]">{trail.name}</h1>
              <p className="text-[13.5px] [text-shadow:0_1px_6px_rgba(0,0,0,.35)]">
                {[trail.region_name, trip ? `štart ${trip.start.name}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-2">
            <TripFacts
              distanceM={trail.distance_m}
              ascentM={trail.ascent_m}
              durationMin={trail.duration_min}
              difficulty={trail.difficulty}
              familyFriendly={trail.family_friendly}
            />
            {trail.description && <p className="text-sm text-[var(--muted)]">{trail.description}</p>}
          </div>

          <ClosureBanner closures={closures} />

          <TripPlanner
            slug={trail.slug}
            name={trail.name}
            difficulty={trail.difficulty}
            familyFriendly={trail.family_friendly}
            sun={sun}
            goal={{
              lat: trip.destination.location.lat,
              lon: trip.destination.location.lon,
              ele: trip.destination.ele_m,
              name: trip.destination.name,
            }}
            baseHikeMin={trail.duration_min}
            profile={profile}
            gpxUrl={gpxUrl}
            bbox={trail.bbox}
          />

          <ParkingBlock />
          <StopsBlock />

          {fees.length > 0 && <FeeBlock fees={fees} />}

          <PoiList pois={detail.pois} />

          <div className="h-[45vh] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] lg:hidden">
            <TripMap detail={detail} gpxUrl={gpxUrl} />
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
          <TripMap detail={detail} gpxUrl={gpxUrl} />
        </div>
      </main>
    </TripAccessProvider>
  );
}
