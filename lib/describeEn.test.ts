import { describe, expect, it } from "vitest";
import { describeEn } from "./describeEn";

describe("describeEn", () => {
  it("translates the generated description, names stay", () => {
    expect(describeEn("Výstup na vrchol Baba (536 m). Štart: Podbabská dolina, chaty, späť rovnakou cestou. Po modrej a červenej značke.")).toBe(
      "A hike up Baba (536 m). Start: Podbabská dolina, chaty, back the same way. Follows the blue and red trail markings.",
    );
    expect(describeEn("Výlet k vodopádu: Barikádový vodopád. Štart: Podlesok, ATC, okruh. Po zelenej, modrej a červenej značke.")).toBe(
      "A trip to a waterfall: Barikádový vodopád. Start: Podlesok, ATC, a loop. Follows the green, blue and red trail markings.",
    );
    expect(describeEn("Výlet k vyhliadke Biela skala. Štart: Nad parkom, späť rovnakou cestou.")).toBe(
      "A trip to the viewpoint Biela skala. Start: Nad parkom, back the same way.",
    );
  });
  it("leaves hand-written text alone", () => {
    expect(describeEn("Krásny výlet s deťmi.")).toBeNull();
  });
});
