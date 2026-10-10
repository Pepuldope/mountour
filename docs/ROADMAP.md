# MounTour roadmap

Feedback from Peter after the first live version (2026-10-07). Ordered roughly by
dependency, not priority. Status: `[ ]` todo · `[~]` in progress · `[x]` done.

## 1. Real trail data — Malé Karpaty  `[x]`
- Replace the made-up seed with 5–10 real day hikes in Malé Karpaty.
- Real trail geometry (GPX) following marked KST trails, real trailheads,
  real parking pins (OSM `amenity=parking`), real transit stops near the trailhead.
- Closures: only rows with a real `source_url`. No source → no row → the UI says
  „Stav chodníka neoverený". Remove the fake Devínska Kobyla closure.

## 2. Map as the main surface  `[x]`
- A map that always shows what the user is clicking through: parking spots,
  trails at a place, transit options, POIs.
- Trail lines drawn on the map, not just a parking link.
- Marked-trail overlay (turistické značky), which Google/Apple don't render.
- **Decided 2026-10-07:** Leaflet + OpenTopoMap base + Waymarked Trails hiking overlay. No API key.

## 3. User location  `[x]`
- Browser geolocation → "you are here" on the map, used as the trip's start.
- Manual start (typed place) as a fallback when GPS is denied. Nominatim search on
  Enter (its policy forbids search-as-you-type); a typed start wins over GPS and is
  remembered per device (localStorage). Done 2026-10-10.

## 4. Multi-leg trip: start → trailhead → trail  `[x]`
- One route with stops: drive or transit leg to the trailhead, then the on-foot trail.
- Show how long the drive/transit leg takes.
- **Scope note:** the locked scope says MounTour "does not route-find" and hands the
  drive to Google/Apple Maps. Drawing the drive leg + its duration needs a routing
  API (e.g. OSRM / OpenRouteService). Transit times for Slovakia have no free public
  API. **Decided 2026-10-07: reopen.** Draw the drive leg + duration via a free routing
  API (OSRM / OpenRouteService); transit = nearby stops + a cp.sk link. Google/Apple
  still do the actual turn-by-turn navigation.
- **Built 2026-10-10:** `/api/drive` → OpenRouteService (`ORS_API_KEY`, server-side),
  falls back to the public OSRM demo without a key. Coords rounded to ~100 m. Dashed
  drive line on the trip map; map fits start + trail. Drive ends at the parking pin,
  else the trailhead. Transit timing still not modelled (cp.sk link only).

## 5. Day timeline instead of the sunset card  `[x]`
- A horizontal timeline of the day: sunrise, sunset, (civil dusk), and the trip
  laid on it as segments — travel there, hike, travel back.
- Should make "you finish after dark" visible at a glance instead of a text verdict.
- **Built 2026-10-10:** `lib/dayPlan.ts` (unit tested) + `components/DayTimeline.tsx`.
  Inputs: date + departure. Sky band night / civil twilight / day, segments drive →
  hike → drive back, dashed "latest safe departure" line with a one-tap "nastaviť".
  Safety is judged at the END OF THE HIKE (driving home after dark is fine).
  Verdicts: ok / tesné (<30 min) / po západe / potme. Without a start, the time is
  the hike start and only the hike is shown.

## 6. Live, interactive feel  `[x]`
- No "fill the form → get a result" flow. Every input (time budget, kids,
  start location, departure time) updates the results, map and timeline instantly.
- **Built 2026-10-10:** `lib/tripSettings.tsx` holds date / departure / hours / kids for
  the whole app (sessionStorage, survives home <-> trip navigation). Home list gets drive
  times for every trail in one call (`/api/drive-matrix`, ORS matrix), sorts by drive
  time, and the budget counts the whole day (drive there + hike + drive back). Each item
  shows a compact timeline + verdict; trails ending after sunset stay listed, flagged.
  Default departure: now (rounded to 15 min), or tomorrow 08:00 after 15:00.

## 7. Layout  `[x]`
- **Desktop:** left column = the inputs + nav (saved trips, etc.), right = map +
  timeline, the visual, interactive part.
- **Phone:** the visual side can shrink (no big map by default), but inputs still
  give live feedback, e.g. the result list and a compact timeline reacting to inputs.
- **Built 2026-10-10:** desktop right column = map + day plan of the active trail (home:
  last hovered / tapped on map). Phone home: map behind "Zobraziť mapu", mini timelines in
  the list. Phone trip page: short map, inputs, then the plan.

## 8. Saved trips  `[x]`
- A "saved trips" entry in the left nav. Fits with offline cache-on-plan: a saved
  trip = a cached trip. No accounts (still out of scope), so it is per-device.
- **Built 2026-10-10:** "Uložiť výlet" on the trip page saves a snapshot (trail, date,
  departure, start, drive time) to localStorage AND caches the page + GPX + tiles + the
  build assets it runs on. `/ulozene` lists them (mini timeline, verdict, Otvoriť restores
  date/time/start, Odstrániť also drops the cache). Service worker: build assets
  cache-first in `mountour-static`, pages network-first with the saved copy as offline
  fallback. Verified offline in headless Chromium: trip page + map tiles + /ulozene load.

## Data sources (decided 2026-10-07)
- Trails, parking, transit stops, POIs: OpenStreetMap via `scripts/build_trails.py`;
  on-foot track: BRouter. Parking is searched along the whole route (out-and-back
  trails can start from either end).
- **Rejected:** Google Places (results must be shown on a Google Map), Mapy.com API
  (terms forbid storing/caching results). Missing data → fix it in OSM, re-run the build.
