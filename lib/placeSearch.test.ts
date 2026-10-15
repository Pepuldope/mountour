import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { plain, preparePlaces, searchPlaces } from "./placeSearch";
import type { SearchIndexFile } from "./placeSearch";

const file: SearchIndexFile = {
  v: 1,
  trips: ["kamzik", "revin", "kozie-rebra", "krivan"],
  places: [
    ["Železná studnička", 48.19031, 17.08224, "pramen", [0]],
    ["Železná studnička", 48.17426, 17.07407, "parkovisko", [2]],
    ["Červený most", 48.17262, 17.07411, "zastavka", [1]],
    ["Kriváň", 49.1628, 20.0, "vrchol", [3]],
  ],
};

describe("search by place", () => {
  const index = preparePlaces(file);
  const words = (q: string) => plain(q).split(/\s+/).filter(Boolean);

  it("finds a place without accents and the trips that touch it", () => {
    const r = searchPlaces(index, words("zelezna studnicka"));
    expect(r.hits.map((h) => h.place.name)).toEqual(["Železná studnička"]);
    expect([...r.slugs]).toEqual(expect.arrayContaining(["kamzik", "kozie-rebra"]));
  });

  it("brings the place next door along: Červený most with Železná studnička", () => {
    const r = searchPlaces(index, words("železná studnička"));
    expect(r.near.map((h) => h.place.name)).toEqual(["Červený most"]);
    expect(r.near[0].nextTo).toBe("Železná studnička");
    expect(r.slugs.has("revin")).toBe(true);
    expect(r.slugs.has("krivan")).toBe(false);
  });

  it("finds nothing for nothing", () => {
    expect(searchPlaces(index, []).hits).toEqual([]);
  });
});

describe("the published index", () => {
  const path = join(process.cwd(), "public", "data", "search.json");

  it("stays small enough to fetch while typing", () => {
    expect(statSync(path).size).toBeLessThan(1.5 * 1024 * 1024);
  });

  it("knows Železná studnička and Červený most", () => {
    const index = preparePlaces(JSON.parse(readFileSync(path, "utf8")));
    const r = searchPlaces(index, ["zelezna", "studnicka"]);
    expect([...r.hits, ...r.near].map((h) => h.place.name)).toContain("Červený most");
  });
});
