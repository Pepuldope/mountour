// Layout stress check (Peter, 2026-10-27): fill the pages with extreme content (no saved
// trips, 1, 10 and 100; very long and very short names; many stops) on phone, tablet and
// computer sizes, and fail when anything runs off the screen, overlaps something else, or
// gets cut off. Runs against a running site:
//
//   node scripts/layout-check.mjs https://<preview>.workers.dev   (preview.yml does this)
//   node scripts/layout-check.mjs http://localhost:3000
//
// Writes layout-check/report.md and a screenshot per failing case; exits 1 on any failure.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = "layout-check";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "phone-small", width: 320, height: 640, mobile: true },
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "tablet", width: 820, height: 1180, mobile: true },
  { name: "desktop", width: 1366, height: 860, mobile: false },
];

const LONG = "Vyhliadková veža na Veľkej Javorine nad Starou Turou a Myjavou cez Lubinu";
const SHORT = "Ťa";
const LONG_START = "Liptovský Mikuláš – Palúdzka, Ulica Tranovského 1234/56";
const TRIP = "devin";

function savedTrips(n) {
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return Array.from({ length: n }, (_, i) => ({
    slug: TRIP,
    name: i % 3 === 0 ? LONG : i % 3 === 1 ? SHORT : `Výlet ${i + 1}`,
    date: day,
    time: "08:00",
    start: { lat: 48.1486, lon: 17.1077, label: i % 2 ? LONG_START : "BA" },
    driveMin: i % 2 ? 187 : 9,
    hikeMin: i % 2 ? 545 : 15,
    withKids: i % 2 === 1,
    sun: { lat: 48.17, lon: 16.98 },
    stops: i % 2
      ? Array.from({ length: 6 }, (_, k) => ({ id: `${TRIP}:poi:${k}`, name: k % 2 ? LONG : "Obed", min: 30 + k * 5, way: "oboje" }))
      : [],
    savedAt: new Date().toISOString(),
    ...(i % 4 === 3 ? { doneAt: new Date().toISOString() } : {}),
    offline: "ok",
  }));
}

/** Pages to try. `storage` goes into localStorage before the page loads; `names` rewrites visible names after. */
const CASES = [
  { name: "home-no-start", path: "/" },
  { name: "home-long-start", path: "/", storage: { "turuj-start": { lat: 49.08, lon: 19.61, label: LONG_START } }, names: "home" },
  { name: "home-100-saved", path: "/", storage: { "turuj-saved-trips": savedTrips(100) } },
  ...[0, 1, 10, 100].map((n) => ({ name: `saved-${n}`, path: "/ulozene", storage: { "turuj-saved-trips": savedTrips(n) } })),
  { name: "trip", path: `/trasa/${TRIP}`, storage: { "turuj-start": { lat: 48.1486, lon: 17.1077, label: LONG_START } }, names: "trip" },
  { name: "trip-en", path: `/en/trasa/${TRIP}`, names: "trip" },
];

/** Runs in the page: puts extreme names into the visible name spots. */
function stressNames({ which, long, short }) {
  if (which === "home") {
    const titles = [...document.querySelectorAll('a[href*="/trasa/"] span.font-bold')];
    titles.forEach((el, i) => (el.textContent = i % 2 ? long : short));
  }
  if (which === "trip") {
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = long;
  }
}

/** Runs in the page: what is off the screen, overlapping or cut off. */
function findProblems() {
  const vw = document.documentElement.clientWidth;
  const problems = [];
  const label = (el) => {
    const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("alt") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}> "${t}"`;
  };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
      if (e.getAttribute("aria-hidden") === "true" && e !== el) return false;
      if (e.tagName === "DETAILS" && !e.open && !el.closest("summary")) return false;
      // Folded away inside a box that hides its overflow (closed drop-downs, sliders).
      if (e !== el && e !== document.body && e !== document.documentElement && s.overflow !== "visible") {
        const c = e.getBoundingClientRect();
        if (Math.min(r.right, c.right) - Math.max(r.left, c.left) < 2 || Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) < 2) return false;
      }
    }
    return true;
  };
  // Map canvases and their pins/controls float on purpose.
  const inMap = (el) => !!el.closest(".maplibregl-map");
  const scrollsX = (e) => ["auto", "scroll"].includes(getComputedStyle(e).overflowX);

  // 1. Wider than the screen.
  if (document.documentElement.scrollWidth > vw + 1) {
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => !inMap(el) && shown(el))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return false;
        for (let e = el.parentElement; e; e = e.parentElement) if (scrollsX(e)) return false;
        return true;
      })
      .slice(0, 5);
    problems.push({ kind: "off-screen", detail: `page is ${document.documentElement.scrollWidth}px wide on a ${vw}px screen`, els: wide.map(label) });
  }

  // 2. Overlaps between things laid out next to each other (not floating on purpose).
  const floats = (el, stop) => {
    for (let e = el; e && e !== stop; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === "absolute" || p === "fixed" || p === "sticky") return true;
    }
    return false;
  };
  const items = [...document.querySelectorAll("a, button, h1, h2, h3, p, label, input, select, img, [role=switch]")]
    .filter((el) => !inMap(el) && shown(el));
  const boxes = items.map((el) => ({ el, r: el.getBoundingClientRect() }));
  let overlaps = 0;
  for (let i = 0; i < boxes.length && overlaps < 8; i++) {
    for (let j = i + 1; j < boxes.length && overlaps < 8; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w < 3 || h < 3) continue;
      // Common ancestor: anything floating below it overlaps by design (badges on photos, menus).
      let common = a.el.parentElement;
      while (common && !common.contains(b.el)) common = common.parentElement;
      if (floats(a.el, common) || floats(b.el, common)) continue;
      problems.push({ kind: "overlap", detail: `${Math.round(w)}x${Math.round(h)}px`, els: [label(a.el), label(b.el)] });
      overlaps++;
    }
  }

  // 3. Text cut off without "…".
  let cut = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (cut >= 5) break;
    if (inMap(el) || !shown(el)) continue;
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!text) continue;
    const s = getComputedStyle(el);
    const clips = ["hidden", "clip"].includes(s.overflowX) || ["hidden", "clip"].includes(s.overflowY);
    if (!clips || s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none") continue;
    if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
      problems.push({ kind: "cut-off", detail: `${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`, els: [label(el)] });
      cut++;
    }
  }
  return problems;
}

const browser = await chromium.launch();
const failures = [];
let checked = 0;
for (const vp of VIEWPORTS) {
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, serviceWorkers: "block", locale: "sk-SK" });
    await ctx.addInitScript((storage) => {
      try {
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
      } catch {
        // Storage blocked: the page just starts empty.
      }
    }, c.storage ?? {});
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + c.path, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(2500);
      if (c.names) {
        await page.evaluate(stressNames, { which: c.names, long: LONG, short: SHORT });
        await page.waitForTimeout(300);
      }
      const problems = await page.evaluate(findProblems);
      checked++;
      if (problems.length) {
        const shot = `${OUT}/${vp.name}-${c.name}.png`;
        await page.screenshot({ path: shot, fullPage: true });
        failures.push({ vp: vp.name, c: c.name, problems, shot });
      }
    } catch (err) {
      failures.push({ vp: vp.name, c: c.name, problems: [{ kind: "load", detail: String(err).slice(0, 200), els: [] }] });
    }
    await ctx.close();
  }
}
await browser.close();

const lines = [`# Layout check: ${BASE}`, "", `${checked} page loads, ${failures.length} with problems.`, ""];
for (const f of failures) {
  lines.push(`## ${f.vp} · ${f.c}`);
  for (const p of f.problems) lines.push(`- **${p.kind}** ${p.detail}${p.els.length ? `: ${p.els.join(" / ")}` : ""}`);
  if (f.shot) lines.push(`- screenshot: ${f.shot}`);
  lines.push("");
}
writeFileSync(`${OUT}/report.md`, lines.join("\n"));
console.log(lines.join("\n"));
process.exit(failures.length ? 1 : 0);
