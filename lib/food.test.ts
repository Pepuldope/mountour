import { describe, expect, it } from "vitest";
import { foodKind, poiIcon } from "@/lib/food";

describe("foodKind", () => {
  it("keeps what the build stored", () => {
    expect(foodKind("Pohoda", "kaviaren")).toBe("kaviaren");
  });

  it("reads older trips from the name", () => {
    expect(foodKind("Reštaurácia Gurmen")).toBe("restauracia");
    expect(foodKind("Restaurant Pizza Bar u Barťáka")).toBe("restauracia");
    expect(foodKind("Cafe & Bufet u Orla")).toBe("bufet");
    expect(foodKind("Čachtický Kebab")).toBe("bufet");
    expect(foodKind("Caffe Bar Europa")).toBe("kaviaren");
    expect(foodKind("Bar pod Skalku")).toBe("kaviaren");
    expect(foodKind("Pohoda")).toBe("restauracia");
  });

  it("only changes food places", () => {
    expect(poiIcon({ kind: "pramen", name: "Bufetový prameň" })).toBe("pramen");
    expect(poiIcon({ kind: "obcerstvenie", name: "Bufet Dam" })).toBe("bufet");
  });
});
