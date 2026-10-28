// TEMP (remove before merge): open a trip page and log what /api/weather answers.
import { chromium } from "playwright";
const b = await chromium.launch();
for (const base of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  p.on("response", async (r) => {
    if (!r.url().includes("/api/weather")) return;
    let info = "";
    try {
      const j = await r.json();
      const by = {};
      for (const s of j.steps ?? []) (by[s.t.slice(0, 10)] ??= new Set()).add(s.symbol);
      info = `updated ${j.updated} steps ${j.steps?.length} ` + Object.entries(by).map(([d, v]) => `${d}:${[...v].join("/")}`).join(" ");
    } catch {
      info = "NOT JSON: " + (await r.text().catch(() => "")).slice(0, 120);
    }
    console.log(base, r.status(), r.url().split("?")[1], info);
  });
  await p.goto(base + "/trasa/krivan", { waitUntil: "networkidle" }).catch((e) => console.log(base, "goto", e.message));
  await p.waitForTimeout(4000);
  console.log(base, "title:", await p.title(), "weather text:", await p.getByText(/Počas túry/).count());
  const iny = p.getByRole("button", { name: /Iný deň/ }).first();
  if (await iny.count()) { await iny.click(); await p.waitForTimeout(3000); }
  console.log(base, "strip icons:", await p.locator("[role=option] svg").count());
}
await b.close();
