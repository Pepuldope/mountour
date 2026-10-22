// The home page reads a packed copy of the trip list (Peter 2026-10-22). Unpacking must give the
// list back, or the home would quietly lose a field: if this fails, fix scripts/pack-list.mjs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packList } from "../scripts/pack-list.mjs";
import { unpackList } from "@/lib/packedList";

const round = (v: unknown) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e5) / 1e5 : v);
const raw = readFileSync(join(process.cwd(), "public/data/trips/list.json"), "utf8");

describe("packed home list", () => {
  it("unpacks to list.json (coordinates to ~1 m)", () => {
    const expected = JSON.parse(raw, (k, v) => (k === "lat" || k === "lon" ? round(v) : k === "bbox" ? (v as number[]).map(round) : v));
    expect(unpackList(packList(JSON.parse(raw)))).toEqual(expected);
  });

  it("keeps a real null apart from a missing field", () => {
    const list = { version: 1, generated_at: "x", trips: [{ slug: "a", parking: null }, { slug: "b", parking: { name: null } }, { slug: "c" }] };
    expect(unpackList(packList(list))).toEqual(list);
  });

  it("is at most half of list.json", () => {
    expect(JSON.stringify(packList(JSON.parse(raw))).length).toBeLessThan(raw.length / 2);
  });
});
