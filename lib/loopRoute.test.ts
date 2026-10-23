import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loopPartner, loopTrip } from "@/lib/loopRoute";
import type { TripDetail } from "@/lib/tripSchema";

const read = (slug: string) => JSON.parse(readFileSync(join(process.cwd(), "public", "data", "trips", `${slug}.json`), "utf8")) as TripDetail;

describe("loop routes", () => {
  it("come back by another route from the same start", () => {
    const own = read("rozhladna-dubravka");
    expect(loopPartner(own.slug, own.routes!)?.slug).toBe("rozhladna-dubravka-kubra-kyselka-ina-cesta");
    // The short way from the upper car park starts elsewhere: never a way back.
    expect(loopPartner("rozhladna-dubravka-od-auta", own.routes!)).toBeNull();
    // Trenčiansky hrad's other path from Brezina runs mostly along the main one: not a loop.
    const hrad = read("trenciansky-hrad");
    expect(loopPartner(hrad.slug, hrad.routes!)).toBeNull();
  });

  it("go up one way and down the other, counted like the trip it starts from", () => {
    const own = read("rozhladna-dubravka");
    const other = read("rozhladna-dubravka-kubra-kyselka-ina-cesta");
    const loop = loopTrip(own, other);
    expect(loop.route).toBe("okruh");
    expect(loop.path).toHaveLength(own.path.length + other.path.length - 1);
    expect(loop.path[loop.turnaround_index]).toEqual(own.path[own.path.length - 1]);
    expect(loop.path[loop.path.length - 1]).toEqual(other.path[0]);
    for (const r of loop.marking_runs) {
      expect(r.from).toBeGreaterThanOrEqual(0);
      expect(r.to).toBeLessThan(loop.path.length);
      expect(r.from).toBeLessThanOrEqual(r.to);
    }
    // Between the two there-and-back walks it is made of.
    const [lo, hi] = [own.duration_min, other.duration_min].sort((a, b) => a - b);
    expect(loop.duration_min).toBeGreaterThanOrEqual(lo - 10);
    expect(loop.duration_min).toBeLessThanOrEqual(hi + 10);
    expect(loop.gpx_url).toBe("");
  });
});
