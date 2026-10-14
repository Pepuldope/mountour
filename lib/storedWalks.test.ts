// The weekly build stores the walk from each parking and stop to the trail (pipeline/walks.py,
// a port of lib/trailJoin.ts). The trip map draws it only when it ends where the page joins the
// trail, so the two must agree, or the page falls back to the rate-limited router.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { trailDetailFrom } from "@/lib/data";
import { haversineM } from "@/lib/geo";
import type { TripDetail } from "@/lib/tripSchema";

const DIR = join(process.cwd(), "public", "data", "trips");
/** components/TripMap.tsx STORED_END_M */
const STORED_END_M = 40;

describe("stored walks to the trail", () => {
  it("end where the trip page joins the trail", () => {
    const files = readdirSync(DIR).filter((f) => f !== "index.json" && f !== "list.json");
    let walks = 0;
    const off: string[] = [];
    for (const f of files.filter((_, i) => i % 5 === 0)) {
      const trip = JSON.parse(readFileSync(join(DIR, f), "utf8")) as TripDetail;
      const detail = trailDetailFrom(trip);
      for (const place of [...detail.parkingLots, ...detail.transitStops]) {
        if (!place.walk) continue;
        walks++;
        const [lon, lat] = place.walk.line[place.walk.line.length - 1];
        const target = place.join?.location ?? trip.start.location;
        if (haversineM({ lat, lon }, target) > STORED_END_M) off.push(`${f} ${place.name}`);
      }
    }
    // Before the first weekly build with walks there are none; after it, nearly all should match.
    expect(off.length).toBeLessThanOrEqual(Math.ceil(walks * 0.02));
  });
});
