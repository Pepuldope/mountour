# MounTour roadmap

Feedback from Peter after the first live version (2026-10-07). Ordered roughly by
dependency, not priority. Status: `[ ]` todo · `[~]` in progress · `[x]` done.

## 1. Real trail data — Malé Karpaty  `[~]`
- Replace the made-up seed with 5–10 real day hikes in Malé Karpaty.
- Real trail geometry (GPX) following marked KST trails, real trailheads,
  real parking pins (OSM `amenity=parking`), real transit stops near the trailhead.
- Closures: only rows with a real `source_url`. No source → no row → the UI says
  „Stav chodníka neoverený". Remove the fake Devínska Kobyla closure.

## 2. Map as the main surface  `[~]`
- A map that always shows what the user is clicking through: parking spots,
  trails at a place, transit options, POIs.
- Trail lines drawn on the map, not just a parking link.
- Marked-trail overlay (turistické značky), which Google/Apple don't render.
- **Decided 2026-10-07:** Leaflet + OpenTopoMap base + Waymarked Trails hiking overlay. No API key.

## 3. User location  `[~]`
- Browser geolocation → "you are here" on the map, used as the trip's start.
- Manual start (typed place) as a fallback when GPS is denied.

## 4. Multi-leg trip: start → trailhead → trail  `[ ]`
- One route with stops: drive or transit leg to the trailhead, then the on-foot trail.
- Show how long the drive/transit leg takes.
- **Scope note:** the locked scope says MounTour "does not route-find" and hands the
  drive to Google/Apple Maps. Drawing the drive leg + its duration needs a routing
  API (e.g. OSRM / OpenRouteService). Transit times for Slovakia have no free public
  API. **Decided 2026-10-07: reopen.** Draw the drive leg + duration via a free routing
  API (OSRM / OpenRouteService); transit = nearby stops + a cp.sk link. Google/Apple
  still do the actual turn-by-turn navigation.

## 5. Day timeline instead of the sunset card  `[ ]`
- A horizontal timeline of the day: sunrise, sunset, (civil dusk), and the trip
  laid on it as segments — travel there, hike, travel back.
- Should make "you finish after dark" visible at a glance instead of a text verdict.

## 6. Live, interactive feel  `[ ]`
- No "fill the form → get a result" flow. Every input (time budget, kids,
  start location, departure time) updates the results, map and timeline instantly.

## 7. Layout  `[ ]`
- **Desktop:** left column = the inputs + nav (saved trips, etc.), right = map +
  timeline, the visual, interactive part.
- **Phone:** the visual side can shrink (no big map by default), but inputs still
  give live feedback, e.g. the result list and a compact timeline reacting to inputs.

## 8. Saved trips  `[ ]`
- A "saved trips" entry in the left nav. Fits with offline cache-on-plan: a saved
  trip = a cached trip. No accounts (still out of scope), so it is per-device.
