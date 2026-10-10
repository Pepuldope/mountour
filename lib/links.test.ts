import { describe, expect, it } from "vitest";
import { cpSkUrl, mapyUrl, readSharedPlan, sharePath, shareText, startTown } from "./links";
import { dayChips, dayFit, dayInSentence, longDay } from "./days";

const BRATISLAVA = { lat: 48.1486, lon: 17.1077 };

describe("shared plan links", () => {
  it("round-trips day, time and town, never coordinates", () => {
    const path = sharePath("pajstun", "2026-10-17", "08:50", "Bratislava");
    expect(path).toBe("/trasa/pajstun?den=2026-10-17&odchod=08%3A50&z=Bratislava");
    expect(readSharedPlan(path.split("?")[1])).toEqual({ date: "2026-10-17", time: "08:50", town: "Bratislava" });
  });

  it("ignores broken shared links", () => {
    expect(readSharedPlan("den=zajtra&odchod=08:50")).toBeNull();
    expect(readSharedPlan("den=2026-10-17")).toBeNull();
  });

  it("shares a GPS start only as its town name", () => {
    expect(startTown({ label: "Vaša poloha", source: "gps" }, null)).toBeNull();
    expect(startTown({ label: "Pezinok", source: "gps" }, "Pezinok")).toBe("Pezinok");
    expect(startTown({ label: "Pezinok, okres Pezinok", source: "manual" })).toBe("Pezinok");
  });

  it("writes a chat-ready message", () => {
    const text = shareText({
      name: "Pajštún z Borinky",
      dayLabel: "sobota 17. 10.",
      departure: new Date(2026, 9, 17, 8, 50),
      back: new Date(2026, 9, 17, 12, 10),
      hasDrive: true,
      inDaylight: true,
      town: "Bratislava",
      hikeMin: 130,
      difficulty: "lahka",
      familyFriendly: true,
      url: "https://mountour.sk/trasa/pajstun",
    });
    expect(text).toBe(
      "Pajštún z Borinky, sobota 17. 10.\n" +
        "Štart Bratislava, odchod 8:50, späť okolo 12:10, ešte za svetla.\n" +
        "2 h 10 min chôdze, ľahká, vhodné pre deti.\n" +
        "https://mountour.sk/trasa/pajstun"
    );
  });

  it("warns instead of promising daylight when the hike ends after sunset", () => {
    const text = shareText({
      name: "Chleb",
      dayLabel: "sobota 10. 10.",
      departure: new Date(2026, 9, 10, 8, 0),
      back: new Date(2026, 9, 10, 21, 10),
      hasDrive: true,
      inDaylight: false,
      town: "Bratislava",
      hikeMin: 360,
      difficulty: "tazka",
      familyFriendly: false,
      url: "https://mountour.sk/trasa/chleb",
    });
    expect(text).toContain("späť okolo 21:10. Pozor, z túry zídete až po západe slnka.");
    expect(text).not.toContain("za svetla");
  });
});

describe("hand-off links", () => {
  it("prefills cp.sk with from, to, day and time", () => {
    expect(cpSkUrl("Borinka", "Bratislava", "2026-10-17", "08:50")).toBe(
      "https://cp.sk/vlakbusmhd/spojenie/?f=Bratislava&t=Borinka&date=17.10.2026&time=08%3A50"
    );
    expect(cpSkUrl("Borinka", null, null, null)).toBe("https://cp.sk/vlakbusmhd/spojenie/?t=Borinka");
  });

  it("uses lon,lat order for Mapy.com", () => {
    expect(mapyUrl({ lat: 48.3, lon: 17.1 }, null)).toContain("center=17.10000,48.30000");
    expect(mapyUrl({ lat: 48.3, lon: 17.1 }, BRATISLAVA)).toContain("start=17.10770,48.14860&end=17.10000,48.30000");
  });
});

describe("days", () => {
  it("offers Dnes, Zajtra and the weekend without duplicates", () => {
    // Friday 16 Oct 2026: tomorrow is Saturday.
    expect(dayChips(new Date(2026, 9, 16, 10)).map((c) => c.label)).toEqual(["Dnes", "Zajtra", "Ne"]);
    // Tuesday 13 Oct 2026.
    expect(dayChips(new Date(2026, 9, 13, 10)).map((c) => c.iso)).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("names days the way people say them", () => {
    const now = new Date(2026, 9, 13, 10);
    expect(dayInSentence("2026-10-13", now)).toBe("dnes");
    expect(dayInSentence("2026-10-14", now)).toBe("zajtra");
    expect(dayInSentence("2026-10-17", now)).toBe("v sobotu");
    expect(dayInSentence("2026-10-22", now)).toBe("vo štvrtok 22. 10.");
    expect(longDay("2026-10-17")).toBe("sobota 17. 10.");
  });

  it("is strict today and lenient on other days", () => {
    const base = { date: "2026-10-13", driveMin: 60, hikeMin: 240, location: BRATISLAVA };
    expect(dayFit({ ...base, now: new Date(2026, 9, 13, 8) })!.status).toBe("fits");
    expect(dayFit({ ...base, now: new Date(2026, 9, 13, 14) })!.status).toBe("too-late");
    // Same trip planned for tomorrow from this afternoon still fits.
    expect(dayFit({ ...base, date: "2026-10-14", now: new Date(2026, 9, 13, 14) })!.status).toBe("fits");
  });

  it("drops trips that would mean leaving before 5:00", () => {
    const fit = dayFit({ date: "2026-10-14", now: new Date(2026, 9, 13, 14), driveMin: 360, hikeMin: 450, location: BRATISLAVA })!;
    expect(fit.status).toBe("too-early");
    expect(dayFit({ date: "2026-10-14", now: new Date(2026, 9, 13, 14), driveMin: 120, hikeMin: 450, location: BRATISLAVA })!.status).toBe("fits");
  });

  it("drops trips longer than the day's daylight", () => {
    const fit = dayFit({ date: "2026-12-21", now: new Date(2026, 11, 1), driveMin: 120, hikeMin: 480, location: BRATISLAVA })!;
    expect(fit.status).toBe("too-long");
  });
});
