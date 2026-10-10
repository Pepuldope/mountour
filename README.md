# MounTour

A Slovak day-hike trip planner for Malé Karpaty (maturita school project).
MounTour plans the *chain* around a hike — where you start, the drive there,
where you park, the trail itself, and getting back before dark — and hands off
to the tools that already do the rest: Google/Apple Maps for turn-by-turn
driving, and a GPX file for the hike itself.

Live at https://mountour.vercel.app (Vercel deploys every push to `main`).
What is built and what was decided along the way is in `docs/ROADMAP.md`.

## Locked scope

MounTour does **not** do turn-by-turn navigation. It is deliberately narrow.
In scope:

- A trail picker (`/`): 10 real Malé Karpaty trails, filtered and sorted live by
  your time budget, start place (GPS or typed), departure and whether you're
  going with kids, each with a mini day timeline.
- A trip sheet (`/trasa/[slug]`): trail summary, a Leaflet map (trail, drive leg,
  parking, transit stops, POIs), a day timeline with the sunset safety check, a
  closure banner, parking with a directions deep link, nearby transit stops with
  a cp.sk link, and a save button.
- Saved trips (`/ulozene`): per-device, and each saved trip works offline.

The drive leg is the one deliberate exception to "no route-finding" (reopened
2026-10-07, see roadmap #4): its line and duration come from OpenRouteService,
but the actual navigation is still handed to Google/Apple Maps.

Explicitly **out of scope** — do not add these without reopening the spec:

- Parking prices or capacity/fullness
- Multi-day trips or accommodation
- Community features (reviews, check-ins, comments)
- Personal records / stats over time
- User-drawn routes
- Turn-by-turn navigation or route-finding of any kind
- User accounts / auth

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4, deployed on Vercel
- Supabase Postgres + PostGIS for data (see `supabase/migrations/`), read through
  the `trail_detail` view
- Leaflet + OpenTopoMap base + Waymarked Trails hiking overlay for the map (no `react-leaflet` — plain
  `leaflet` used directly from a client component, to keep the dependency
  surface small)
- A hand-written service worker (`public/sw.js`) for offline trip caching
- OpenRouteService (`/api/drive`, `/api/drive-matrix`) for drive times, with the
  public OSRM demo as a keyless fallback; Nominatim for typed start places
- No auth, no user accounts

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. **No Supabase project is required** — if
`NEXT_PUBLIC_SUPABASE_URL` and a key are unset (or the project is unreachable),
the app reads `data/fixtures/trails.json` instead, which holds the same 10
trails as `supabase/seed.sql`. Without `ORS_API_KEY`, drive times come from the
public OSRM demo server, which is fine for development but has no SLA.

```bash
npm run lint        # eslint
npm run typecheck   # next typegen + tsc --noEmit
npm test            # unit tests (vitest, lib/**/*.test.ts)
npm run build       # production build
```

`npm run typecheck` runs `next typegen` first because Next 16 generates route
types (e.g. `LayoutProps`) that plain `tsc` can't see otherwise.

## CI

`.github/workflows/ci.yml` runs lint, typecheck, tests and a production build on
every pull request and every push to `main`. Vercel deploys `main` regardless,
so keep changes on a branch and merge once CI is green.

## Supabase setup (optional, for real data)

1. Create a Supabase project.
2. Run the migrations in `supabase/migrations/` in order. They enable PostGIS,
   create the tables, turn on read-only RLS for the public key, and create the
   `trail_detail` view that returns each trail already shaped like the app's
   `TrailDetail` type (geography decoded to `{lat, lon}` in SQL).
3. Run `supabase/seed.sql` to load the 10 trails.
4. Copy `.env.local.example` to `.env.local` and fill in the project URL and
   publishable (or anon) key, plus `ORS_API_KEY` for drive times.

Free-tier Supabase pauses after 7 idle days; the fixture fallback keeps the site
working when it does, so a paused project is easy to miss.

## Trail data

`scripts/build_trails.py` builds everything from open data: the on-foot track
from BRouter, parking, transit stops and POIs from OpenStreetMap (Overpass). It
overwrites `public/gpx/*.gpx`, `supabase/seed.sql` and `data/fixtures/trails.json`.
Missing or wrong data is fixed in OSM and the script re-run. Closures are never
generated; add them by hand with a real source.

## Schema decisions (`supabase/migrations/0001_init.sql`)

- All five tables use `geography` (not `geometry`) columns so `ST_Distance`
  etc. give directly useful metre results without extra SRID juggling.
- `parking_lot` intentionally has no price/capacity columns — see "locked
  scope" above.
- `closure.source_url` and `closure.verified_on` are `NOT NULL` on purpose:
  closure info must always be attributable and dated. Never add a closure row
  without a real source.
- `closure.kind`: `rocna` (recurring annual range, e.g. TANAP 1 Nov-15 Jun,
  compared by month/day only — see `lib/closures.ts`, which also handles
  ranges that wrap the new year) vs `jednorazova` (a one-off with real
  calendar dates).
- GIST indexes on every geography column (`trail.bbox`, `trailhead.location`,
  `parking_lot.location`, `poi.location`).
- The seed has no closure rows yet: no trail has a sourced closure, so every
  trip page currently shows "Stav chodníka neoverený".

## The sunset/safety rule

`lib/sun.ts` computes sunrise/sunset from latitude, longitude and calendar
date with a pure implementation of the standard NOAA/Meeus sunrise equation —
no API key, no network call, no heavy astronomy dependency. Verified against
Bratislava's known sunset times in `lib/sun.test.ts`.

`lib/dayPlan.ts` lays the trip on the day (drive there, hike, drive back) for
the chosen date and departure, and judges safety at the **end of the hike**
(driving home after dark is fine): ok / tesné (<30 min) / po západe / potme.
The trip page and the home list both render it as a timeline.

## The closure rule (important, do not relax)

If a trail has **no closure data at all**, the UI renders
**"Stav chodníka neoverený"** ("trail status unverified") — never
**"otvorené"** ("open"). Missing data must never read as good news. See
`components/ClosureBanner.tsx`.

Closures are checked against the **planned trip date** (the date input shared
across the app, which defaults to today or tomorrow in local time). The date logic, including
annual closures that run past New Year, is in `lib/closures.ts` and tested in
`lib/closures.test.ts`.

## Offline caching

Nothing is precached at install — this is cache-on-plan, not cache-everything.
Saving a trip (`components/SaveTripButton.tsx`) stores a snapshot (trail, date,
departure, start, drive time) in localStorage and asks the service worker
(`public/sw.js`) to cache the trip page, its GPX file, the map tiles covering
the trail at zoom 13-15 (`lib/tiles.ts`), and the build assets the page runs on.
Build assets are served cache-first; pages network-first with the saved copy
as the offline fallback. Removing a saved trip also drops its cache.
