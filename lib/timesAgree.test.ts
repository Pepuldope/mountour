// Info quality check (Peter 2026-10-23: "some trips say different times on different pages"):
// every page that shows a trip's walk must show the trip page's number.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routeWalk, trailDetailFrom, walkFromCar } from "@/lib/data";
import { summaryFromList } from "@/lib/trips";
import type { TripDetail, TripList } from "@/lib/tripSchema";

const DIR = join(process.cwd(), "public", "data", "trips");

describe("walking times agree", () => {
  it("town pages (Výlety okolo …) show the trip page's walk by car", () => {
    // The town pages read list.json (lib/tripFiles.ts getCarWalks).
    const index = JSON.parse(readFileSync(join(DIR, "list.json"), "utf8")) as TripList;
    const off: string[] = [];
    for (const item of index.trips) {
      const trip = JSON.parse(readFileSync(join(DIR, `${item.slug}.json`), "utf8")) as TripDetail;
      const page = routeWalk(trailDetailFrom(trip));
      const want = (trip.parking ? page.car : (page.bus ?? page.car))?.min ?? trip.duration_min;
      const got = walkFromCar(summaryFromList(item));
      if (got !== want) off.push(`${item.slug} ${got}≠${want}`);
    }
    expect(off.slice(0, 10), `${off.length} trips`).toEqual([]);
  });
});
