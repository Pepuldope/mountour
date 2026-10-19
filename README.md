# MounTour

A Slovak one-day-trip planner for the mountains and nature of all of Slovakia.
MounTour plans the *chain* around a hike — where you start, the drive or bus there,
where you park, the trail itself, and getting back before dark — and hands off
to the tools that already do the rest: Google/Apple Maps or Mapy.com for
turn-by-turn directions, and a GPX file for the hike itself.

Live at https://mountour.nemcok-peter123.workers.dev (Cloudflare Workers, deployed
from `main`; setup in `docs/DEPLOY-CLOUDFLARE.md`). What is built and what was
decided along the way is in `docs/ROADMAP.md` (a dated log).

## What it does

- Home (`/`): every place on a map of Slovakia and in a list, ranked by how long it
  takes from your start (GPS or a town), for the chosen day, with or without kids.
- A trip page (`/trasa/[slug]`): the route on a map with parking, stops and POIs,
  the plan for the day with the sunset check, closures and fees, the other routes
  to the same place (`/trasa/[slug]/cesty` compares them), and a save button.
- Saved trips (`/ulozene`): per-device, and each saved trip works offline.

Out of scope: turn-by-turn navigation, accounts, reviews or other community
features, multi-day trips.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 on Cloudflare
  Workers (OpenNext, free plan)
- Trips: static files built weekly from OpenStreetMap (`pipeline/`,
  `docs/TRIP-DATA.md`), 2,131 places with 6,463 routes, also loaded into
  Cloudflare D1 (`pipeline/db.py`)
- Maps: MapLibre GL with OpenFreeMap tiles and the site's own trail layer
- A hand-written service worker (`public/sw.js`) for offline trip caching
- Drives: OpenRouteService (`/api/drive`, `/api/drive-town` reads the weekly
  drive table), with the public OSRM demo as a keyless fallback in development
- Weather: MET Norway (`/api/weather`); sunrise and sunset computed locally
- No auth, no user accounts

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. It reads the trip files in `public/data`; no
database or keys are needed. Without `ORS_API_KEY`, drive times come from the
public OSRM demo server, which is fine for development but has no SLA.

```bash
npm run lint        # eslint
npm run typecheck   # next typegen + tsc --noEmit
npm test            # unit tests (vitest, lib/**/*.test.ts)
npm run build       # production build
npm run cf:build    # production build + Cloudflare Worker bundle
```

`npm run typecheck` runs `next typegen` first because Next 16 generates route
types (e.g. `LayoutProps`) that plain `tsc` can't see otherwise.

## CI

`.github/workflows/ci.yml` runs lint, typecheck, tests and the Cloudflare build
(which includes `next build`) on every pull request and every push to `main`.
Deploys from `main` don't wait for CI, so keep changes on a branch and merge
once CI is green. The weekly trip data is committed by a bot, which GitHub doesn't
run CI for, so `.github/workflows/trips.yml` runs the same tests, the Cloudflare
build and the page check on the new data before committing it.

## Trail data

The weekly pipeline (`.github/workflows/trips.yml`, `pipeline/`) builds every trip
from OpenStreetMap, Copernicus elevation and OSRM, and commits the files; how to
change rules, names and places is in `docs/TRIP-DATA.md`. Missing or wrong data is
fixed in OSM or `pipeline/overrides.yaml`. Closures are never generated; they come
from `data/closure-rules.json`, each with an official source.

## Search and stats

SEO metadata, sitemap, Umami analytics and the visit-day counter are set up in
[`docs/ANALYTICS-AND-SEO.md`](docs/ANALYTICS-AND-SEO.md). Non-secret settings (site address,
Umami ID, contact e-mail) live in `lib/site.ts`.

## Closure kinds

- `rocna`: a yearly range (e.g. TANAP 1 Nov-31 May), compared by month and day
  only; `lib/closures.ts` also handles ranges that wrap the new year.
- `jednorazova`: a one-off with real calendar dates.

Every rule needs a `source_url` and a `verified_on` date: closure info must always
be attributable and dated.

## The sunset/safety rule

`lib/sun.ts` computes sunrise/sunset from latitude, longitude and calendar
date with a pure implementation of the standard NOAA/Meeus sunrise equation —
no API key, no network call, no heavy astronomy dependency. Verified against
Bratislava's known sunset times in `lib/sun.test.ts`.

`lib/dayPlan.ts` lays the trip on the day (drive there, hike, drive back) for
the chosen date and departure, and judges safety at the **end of the hike**
(driving home after dark is fine): ok / tesné (<30 min) / po západe / potme.
The trip page and the home list both show it.

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

## Licence

All rights reserved: the code is public to read, not to reuse. See [LICENSE](LICENSE). Map data © OpenStreetMap contributors (ODbL).
