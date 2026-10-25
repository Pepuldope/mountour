import Link from "next/link";
import { primaryTrailhead, sunLocation } from "@/lib/data";
import { gpxUrlFor } from "@/lib/gpx";
import { GpxDownload } from "@/components/GpxDownload";
import { getRouteWalks, getTrip, getTripPhoto, photoSource, withLoopRoutes } from "@/lib/tripFiles";
import { buildProfile } from "@/lib/tripProfile";
import { GOAL_LABEL, POI_LABEL } from "@/lib/format";
import { kindSvg } from "@/lib/kindIcons";
import { GOAL_COLOUR, POI_COLOUR, ROUTE_COLOURS } from "@/lib/palette";
import { seasonOf } from "@/lib/season";
import { SeasonScene } from "@/components/SeasonScene";
import { UiIcon } from "@/components/UiIcon";
import { FeeBlock } from "@/components/FeeBlock";
import { ParkingBlock } from "@/components/ParkingBlock";
import { PhoneTripMap } from "@/components/PhoneTripMap";
import { PoiList } from "@/components/PoiList";
import { StopsBlock } from "@/components/TransitBlock";
import { ClosureBanner } from "@/components/ClosureBanner";
import { TripPlanner } from "@/components/TripPlanner";
import { TripReviews } from "@/components/TripReviews";
import { SavedTripsLink } from "@/components/SavedTripsLink";
import { SiteFooter } from "@/components/SiteFooter";
import { TripFacts } from "@/components/TripFacts";
import { TripMap } from "@/components/TripMap";
import type { OtherRoute } from "@/components/TripMap";
import { RouteChoice } from "@/components/RouteChoice";
import { TripAccessProvider } from "@/components/TripAccess";
import { JsonLd } from "@/components/JsonLd";
import { TrackEvent } from "@/components/TrackEvent";
import { absoluteUrl } from "@/lib/site";
import type { RouteBrief, Town, TripDetail } from "@/lib/tripSchema";
import type { TrailDetail } from "@/lib/types";
import { LOOP_SUFFIX } from "@/lib/loopRoute";
import { nearestTown } from "@/lib/trips";
import { townGenitive } from "@/lib/townNames";

/** schema.org data: the trail as a place to visit + breadcrumbs (all trips > the nearest town's page > this one). */
function trailJsonLd(detail: TrailDetail, photoUrl: string | null, town: Town | null) {
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
        image: photoUrl ?? absoluteUrl("/og-image.png"),
        // Only when an entry fee is known; no known fee doesn't mean free.
        ...(detail.fees.some((f) => f.kind === "vstupne") ? { isAccessibleForFree: false } : {}),
        publicAccess: true,
        touristType: trail.family_friendly ? ["Rodiny s deťmi", "Turisti"] : ["Turisti"],
        ...(start ? { geo: { "@type": "GeoCoordinates", latitude: start.lat, longitude: start.lon } } : {}),
        containedInPlace: { "@type": "Country", name: "Slovensko" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Výlety", item: absoluteUrl("/") },
          ...(town
            ? [{ "@type": "ListItem", position: 2, name: `Okolo ${townGenitive(town.id, town.name)}`, item: absoluteUrl(`/vylety-z/${town.id}`) }]
            : []),
          { "@type": "ListItem", position: town ? 3 : 2, name: trail.name, item: url },
        ],
      },
    ],
  };
}

/** A route as the route list names it, quoted inside a sentence: „Iným chodníkom“. */
function routeName(r: RouteBrief | undefined): string {
  return `„${r?.route_label ?? "Hlavná cesta"}“`;
}

/** A second reason to go, from what the walk passes: a hut, a castle or a viewpoint. */
function secondGoal(detail: TrailDetail): "chata" | "hrad" | "vyhliadka" | null {
  const goal = detail.trail.goal;
  const kinds = new Set(detail.pois.filter((p) => p.detour_min === null).map((p) => p.kind));
  for (const k of ["chata", "hrad", "vyhliadka"] as const) if (k !== goal && kinds.has(k)) return k;
  return null;
}

function Badge({ colour, icon, children }: { colour: string; icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-[12.5px] font-bold text-white" style={{ background: `color-mix(in oklab, ${colour} 88%, #000)` }}>
      {/* Slightly deeper than the pin colour: white small text on it stays above 4.5:1. */}
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

/**
 * The trip page itself, for a route as it is (/trasa/<slug>) or walked as a loop, back down another
 * route from the same start (/trasa/<slug>/okruh, lib/loopRoute.ts).
 */
export async function TripSheet({ trip, detail, loopBack }: { trip: TripDetail; detail: TrailDetail; loopBack?: RouteBrief }) {

  const { trail, parkingLots, transitStops, closures, fees } = detail;
  const trailStart = primaryTrailhead(detail)?.location ?? null;
  const profile = buildProfile(trip);
  const gpxUrl = gpxUrlFor(trail.gpx_path);
  const sun = sunLocation(detail);
  const goal = trail.goal ?? "ine";
  const also = secondGoal(detail);
  const goalEle = trip?.destination.ele_m;
  const trailNumbers = { distance_m: trail.distance_m, ascent_m: trail.ascent_m, duration_min: trail.duration_min };
  // Other routes to the same place: listed under the facts, drawn faint on the map. They come
  // with the trip's own file (the database row doesn't carry them), never from the whole index.
  const baseRoutes =
    trip.routes ?? (trip.variant_of || trip.route_count ? ((await getTrip(trail.slug))?.routes ?? []) : []);
  // Loops (up one route, down another from the same start) are routes of their own in the list
  // and on the comparison map (lib/loopRoute.ts, Peter 2026-10-24).
  const routes = baseRoutes.length > 1 ? await withLoopRoutes(baseRoutes) : baseRoutes;
  const current = loopBack ? `${trail.slug}${LOOP_SUFFIX}` : trail.slug;
  const walks = routes.length > 1 ? await getRouteWalks(routes.map((r) => r.slug)) : {};
  // The place's photo from Wikimedia Commons, when there is one (Peter, 2026-10-22: photos on the planner).
  const photo = await getTripPhoto(trail.slug, trip.destination.osm);
  // The town page this trip belongs to: a link for people and search engines to more trips nearby.
  const town = nearestTown(trip.start.location);
  const description = loopBack
    ? `Okruh zo štartu ${trip.start.name}: hore po trase ${routeName(routes.find((r) => r.slug === trail.slug))}, dole po trase ${routeName(loopBack)}.`
    : trail.description;
  // A loop has no GPX file: its maps draw the line from the trip itself.
  const loopLine = loopBack ? trip.path.map(([lon, lat]) => [lat, lon] as [number, number]) : undefined;
  const others: OtherRoute[] = routes
    .map((r, i) => ({
      slug: r.slug,
      label: r.route_label ?? r.start_name,
      points: r.up.map(([lon, lat]) => [lat, lon] as [number, number]),
      colour: ROUTE_COLOURS[i % ROUTE_COLOURS.length],
      // Loops, and the routes this loop is made of, would draw their lines twice: only on hover.
      hoverOnly: r.slug.endsWith(LOOP_SUFFIX) || r.slug === trail.slug || r.slug === loopBack?.slug,
    }))
    .filter((r) => r.slug !== current);

  // Named for the route, as the route list calls it, when the place has several.
  const ownLabel = routes.length > 1 ? routes.find((r) => r.slug === trail.slug)?.route_label : null;
  const gpxName = ownLabel ? `${trail.name} (${ownLabel})` : trail.name;

  return (
    <TripAccessProvider slug={trail.slug} parkingLots={parkingLots} transitStops={transitStops} trailStart={trailStart} trail={trailNumbers}>
      <main className="flex flex-1 flex-col bg-[var(--page-sunk)] lg:h-dvh lg:flex-none lg:flex-row lg:overflow-hidden">
        <JsonLd data={trailJsonLd(detail, photo?.url ?? null, town)} />
        <TrackEvent name="trip_open" data={{ trail: trail.slug }} />
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-4 pb-6 md:max-w-[760px] lg:mx-0 lg:w-[460px] lg:max-w-none lg:shrink-0 relative lg:overflow-y-auto lg:overscroll-contain">
          <header className="relative -mx-4 -mt-4 flex h-[220px] shrink-0 flex-col justify-between sm:overflow-hidden sm:rounded-b-[24px] lg:overflow-visible lg:rounded-none">
            {photo ? (
              <>
                {/* Plain img, no cookies or referrer to Wikimedia (as on town tiles). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  decoding="async"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  width={photo.w}
                  height={photo.h}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.25)_0%,rgba(0,0,0,0)_35%,rgba(0,0,0,.55)_100%)]" />
                <a
                  href={photo.page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-2 bottom-1 z-10 max-w-[60%] truncate text-[10px] text-white/80 no-underline [text-shadow:0_1px_2px_rgba(0,0,0,.7)]"
                >
                  Foto: {photo.author}, {photo.license}, {photoSource(photo)}
                </a>
              </>
            ) : (
              <SeasonScene season={seasonOf(new Date())} width={460} height={220} seed={3} sunX={0.2} sunY={0.28} shade className="absolute inset-0 h-full w-full" />
            )}
            <nav aria-label="Navigácia" className="relative flex items-center justify-between gap-2 px-4 pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)]/90 px-3 py-1.5 text-sm font-semibold"
              >
                <UiIcon name="back" size={15} />
                Všetky výlety
              </Link>
              <SavedTripsLink />
            </nav>
            <div className="relative flex flex-col gap-1.5 px-4 pb-3.5 text-white">
              <div className="flex flex-wrap gap-1.5">
                <Badge colour={GOAL_COLOUR[goal]} icon={kindSvg(goal, 16)}>
                  {GOAL_LABEL[goal]}
                  {/* Peter: always the height, said as height ("277 m" alone read like a distance). */}
                  {goalEle ? ` · ${goalEle} m n. m.` : ""}
                </Badge>
                {also && (
                  <Badge colour={POI_COLOUR[also]} icon={kindSvg(also, 16)}>
                    {POI_LABEL[also]} na trase
                  </Badge>
                )}
              </div>
              <h1 className="text-[2.4rem] leading-none font-extrabold tracking-tight [text-shadow:0_1px_3px_rgba(0,0,0,.45),0_1px_14px_rgba(0,0,0,.3)]">{trail.name}</h1>
              <p className="text-[13.5px] font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,.6),0_0_10px_rgba(0,0,0,.45)]">
                {[trail.region_name, trip ? `štart ${trip.start.name}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
          </header>

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
            profile={profile}
            gpxUrl={gpxUrl}
            bbox={trail.bbox}
            closures={closures}
            hasPlaces={detail.pois.length > 0}
            intro={
              <>
                <div className="flex flex-col gap-2">
                  <TripFacts
                    loop={trip.route === "okruh"}
                    difficulty={trail.difficulty}
                    familyFriendly={trail.family_friendly}
                  />
                  {description && <p className="text-sm text-[var(--muted)]">{description}</p>}
                  <TripReviews slug={trail.slug} name={trail.name} />
                </div>
                <RouteChoice slug={current} destination={trip.destination.name} routes={routes} walks={walks} />
                {/* A real closure stays up top; "no data" is a quiet note under the map. */}
                {closures.length > 0 && <ClosureBanner closures={closures} />}
              </>
            }
            outro={
              gpxUrl && (
                <section className="flex flex-col gap-1 text-sm">
                  <h2 className="text-base font-bold">Na túru</h2>
                  <GpxDownload gpxUrl={gpxUrl} slug={trail.slug} name={gpxName} />
                </section>
              )
            }
            walk={{ points: trip.path.map(([lon, lat]) => [+lat.toFixed(5), +lon.toFixed(5)]), loop: trip.route === "okruh" }}
          >
            {/* Testers: Uložiť and navigation belong at the end; parking first, then the map. */}
            <ParkingBlock />
            <StopsBlock />

            <div className="lg:hidden">
              <PhoneTripMap detail={detail} gpxUrl={gpxUrl} path={loopLine} others={others} loop={trip.route === "okruh"} />
            </div>

            {closures.length === 0 && <ClosureBanner closures={closures} />}

            {fees.length > 0 && <FeeBlock fees={fees} />}

            <PoiList pois={detail.pois} slug={trail.slug} loop={trip.route === "okruh"} />
          </TripPlanner>

          {town && (
            <Link href={`/vylety-z/${town.id}`} className="w-fit text-sm font-semibold text-[var(--accent)]">
              Ďalšie výlety okolo {townGenitive(town.id, town.name)} →
            </Link>
          )}

          <SiteFooter />
        </div>

        <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:flex-1 lg:border-l lg:border-[var(--border)]">
          <TripMap detail={detail} gpxUrl={gpxUrl} path={loopLine} others={others} loop={trip.route === "okruh"} />
        </div>
      </main>
    </TripAccessProvider>
  );
}
