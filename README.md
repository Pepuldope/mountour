# MounTour

A Slovak day-hike trip planner (maturita school project). MounTour plans the
*chain* around a hike — where you start, where you park, the trail itself,
and getting back before dark — and hands off to the tools that already do the
rest: Google/Apple Maps for the drive, and a GPX file for the hike itself.

## Locked scope

MounTour does **not** do navigation and does **not** route-find. It is
deliberately narrow. In scope:

- A trail picker (`/`): how much time you have, where you're starting from,
  whether you're going with kids.
- A trip sheet (`/trasa/[slug]`): trail summary, a Leaflet map (GPX track +
  parking + POIs), a parking block with a driving-directions deep link, a
  sunset/return-time safety check, a closure banner, and an offline-save
  button.

Explicitly **out of scope** — do not add these without reopening the spec:

- Parking prices or capacity/fullness
- Multi-day trips or accommodation
- Community features (reviews, check-ins, comments)
- Personal records / stats over time
- User-drawn routes
- Turn-by-turn navigation or route-finding of any kind
- User accounts / auth

## Stack

- Next.js (App Router) + TypeScript, target deploy: Vercel
- Supabase Postgres + PostGIS for data (see `supabase/migrations/0001_init.sql`)
- Leaflet + OpenStreetMap tiles for the map (no `react-leaflet` — plain
  `leaflet` used directly from a client component, to keep the dependency
  surface small)
- A hand-written service worker (`public/sw.js`) for offline trip caching
- No auth, no user accounts

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. **No Supabase project is required** — if
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset (or the
project is unreachable), the app reads `data/fixtures/trails.json` instead,
which mirrors `supabase/seed.sql`'s one seeded trail (Devínska Kobyla). This is
intentional — the slice must run standalone.

```bash
npm run build       # production build
npx tsc --noEmit    # typecheck
npm test            # unit tests (lib/sun.ts, vitest)
```

## Supabase setup (optional, for real data)

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` against it (enables PostGIS and
   creates the five tables: `trail`, `trailhead`, `parking_lot`, `closure`,
   `poi`).
3. Run `supabase/seed.sql` to load the one example trail.
4. Upload a GPX file to Supabase Storage at the path referenced by
   `trail.gpx_path` (or keep serving it from `public/gpx/` as this slice
   does).
5. Copy `.env.local.example` to `.env.local` and fill in the project URL and
   anon key.

**Note on PostGIS decoding:** `lib/data.ts`'s `fetchFromSupabase()` currently
detects whether Supabase is reachable but does not decode the `geography`
columns back into `{lat, lon}` — that needs either a Postgres view/RPC that
calls `st_asgeojson(...)`, or client-side WKB parsing, and there's no live
project to develop and verify that against yet. Until it's wired up, the app
always falls back to the JSON fixture for actual trail data. This is called
out explicitly in that file.

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
- The seed data's one closure row is a `jednorazova` example that is already
  expired, so the UI has real data to render without falsely implying the
  trail is closed today.

## The sunset/safety rule

`lib/sun.ts` computes sunrise/sunset from latitude, longitude and calendar
date with a pure implementation of the standard NOAA/Meeus sunrise equation —
no API key, no network call, no heavy astronomy dependency. Verified against
Bratislava's known sunset times (~16:01 local on 21 Dec, ~21:00 local on 21
Jun) in `lib/sun.test.ts`.

The trip sheet's sunset card takes an arrival time + the trail's stated
duration, computes an estimated return-to-car time, and compares it against
sunset for that date/location — showing a clear OK or warning state.

## The closure rule (important, do not relax)

If a trail has **no closure data at all**, the UI renders
**"Stav chodníka neoverený"** ("trail status unverified") — never
**"otvorené"** ("open"). Missing data must never read as good news. See
`components/ClosureBanner.tsx`.

## Offline caching

Nothing is precached at install — this is cache-on-plan, not
cache-everything. Tapping "Uložiť výlet offline" on a trip sheet
(`components/OfflineSaveButton.tsx`) posts a message to the service worker
(`public/sw.js`) with the exact URLs to store: the trip page itself, its GPX
file, and the OpenStreetMap tiles covering the trail's `bbox` at zoom 13-15
(computed in `lib/tiles.ts`). The service worker then serves those URLs
cache-first, with a background refresh when back online.

**Deviation from spec:** the static PNG fallback for the zero-tiles case
(useful if a visitor is offline before ever visiting a trip page) was not
built. It would have meant either a headless-render step at build time or a
third-party tile-stitching call — both are heavier than this slice
justifies. Skipped per the spec's own "skip it if it balloons the slice"
allowance; worth adding later if the offline-tile flow proves unreliable in
practice.

## Verification run for this slice

- `npm run build` — passes
- `npx tsc --noEmit` — clean
- `npm test` (vitest, `lib/sun.test.ts`) — 3/3 passing
- `npm run dev` — `/` and `/trasa/devinska-kobyla` both return 200 with no
  runtime errors in the server log; an unknown slug correctly 404s
