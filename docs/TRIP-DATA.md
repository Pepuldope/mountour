# Trip data (schema v1)

MounTour's trips are plain static files generated from OpenStreetMap by a weekly
GitHub Actions job (`.github/workflows/trips.yml`, code in `pipeline/`). The site
only reads them: no database on the display path. Types: `lib/tripSchema.ts`.
Loader: `lib/trips.ts`.

| File | What | Written by |
|---|---|---|
| `data/trips/index.json` | `TripIndex`: every trip as a `TripSummary` (home list, filters, sitemap) | pipeline |
| `data/trips/<slug>.json` | `TripDetail`: summary + path, marking colours, other parking/stops, POIs | pipeline |
| `data/trips/details.generated.ts` | static `import()` per slug so the bundler includes every detail file | pipeline |
| `public/gpx/<slug>.gpx` | full-resolution GPX of the whole walk | pipeline |
| `data/drive-times.json` | `DriveTimes`: car minutes and km from ~140 Slovak towns to every trip's parking | pipeline (OSRM) |
| `data/closure-rules.json` | `ClosureRules`: seasonal and one-off closures, each with an official source and check date | by hand |
| `data/fee-rules.json` | `FeeRules`: entry fees OSM doesn't carry, each with a source | by hand |
| `data/pipeline-report.md` | counts, regressions against the 10 hand-picked trips, unresolved rule names | pipeline |

## What a trip is

A walk from a **start** (a KST guidepost with public parking or a stop nearby) to a
**destination** (named peak, viewpoint, castle, hut, tarn, waterfall) and back. Usually
the same way back (`route: "tam-a-spat"`); a loop (`"okruh"`) when a path is one-way,
like the gorges in Slovenský raj.

Key fields of `TripSummary` (see `lib/tripSchema.ts` for all):

- `slug`: stable across runs (`pipeline/slugs.json`), safe for URLs, saved trips and share links.
- `name`, `description`: generated in Slovak; curated trips and `pipeline/overrides.yaml` can override.
- `region` (`tatry`, `slovensky-raj`, `mala-fatra`, `male-karpaty`), `region_name`, `protected_area`.
- `destination` (`kind`, `ele_m`, `location`), `start`, `parking` (drive destination, `fee`), `transit` (nearest stop).
- `distance_m`, `ascent_m`, `duration_min` are for the **whole walk**. Time is DIN 33466 without breaks, rounded up to 15 min.
- `difficulty`: `lahka` ≤ 3 h and ≤ 400 m up and nothing harder than T2; `tazka` ≥ 6 h or ≥ 1,000 m up or any T4+; else `stredna`.
- `family_friendly`: `lahka`, ≤ 2.5 h, nothing harder than T2.
- `marking`: KST colours walked (`red`, `blue`, `green`, `yellow`, `black`), most-used first; `marked_share` 0..1.
- `fees`: entry fees from OSM tags or `fee-rules.json`. Empty means "none known", not "free".
- `closure_rule_ids`: rules from `closure-rules.json` that cover this trip. **Empty means "Stav chodníka neoverený", never "otvorené".** Use `isClosureActive()` in `lib/closures.ts` with the trip date to decide whether a rule is in force.
- `rank` 0..100 (how well known the destination is), `curated` (one of the 10 hand-picked trips), `gpx_url`, `bbox`.

`TripDetail` adds `path` (`[lon, lat, ele]`, ~10 m), `turnaround_index`, `marking_runs`
(index ranges of `path` with a KST colour, for drawing the route in trail colours),
`parking_alternatives`, `transit_alternatives`, `pois`.

## Drive times

`minutes[townIndex][slugIndex]` (and `km`) from each town centre to the trip's parking,
by OSRM on the same OSM data. Use `nearestTown()` + `driveMinutes()` for a list sorted by
travel time; refine the top results live with `/api/drive-matrix` when needed.

## Licences and credit

- OpenStreetMap data, © OpenStreetMap contributors, ODbL 1.0. Commercial use allowed;
  every page showing trip data must credit "© OpenStreetMap contributors" with a link
  to https://www.openstreetmap.org/copyright.
- Elevation: Copernicus DEM GLO-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space
  GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA. Free, commercial use allowed.
- Drive times: OSRM (BSD-2) on OSM data.
- Wikidata (ranking only): CC0.

## Changing things

- Regions, limits, hand-picked trips: `pipeline/config.yaml`.
- Rename a trip, rewrite its description or drop it: `pipeline/overrides.yaml`.
- Closure or fee: edit the JSON rule files (needs a source URL and a check date). Dates
  and texts apply at the next site build; a new rule area needs the next pipeline run
  (Actions → "Weekly trip data" → Run workflow).
