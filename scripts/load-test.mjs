// Load test: many people using the site at once (Peter, 2026-10-25: "the site should hold at
// least 100 people clicking, planning trips, changing things at the same time").
//
//   node scripts/load-test.mjs [base-url] [--people 100] [--minutes 1] [--one-address] [--live]
//
// Each simulated person walks the path a real visitor takes: the home page and its trip list,
// a few trip pages with their weather, reviews and drive, a town page, the usage counters, and
// saving a review. They all start together and keep going for the given time, with a short
// think time between clicks. The script prints how long answers took and every status that
// came back, and exits 1 when anything other than the expected answers came back.
//
// Run it against a local build (`npm run cf:preview`, http://localhost:8787 by default). Against
// the live site every request counts towards the free plan's 100,000 a day, so only with a
// short time and the owner's OK. --one-address sends everyone from one address (a class on
// school wifi), which is the hardest case for the per-address limits; otherwise each person
// gets an address of their own (local runs only: Cloudflare sets the real one live).
//
// --live is for turuj.sk itself (.github/workflows/loadtest.yml): it leaves out everything that
// spends a shared free quota or writes into the statistics (drives use the route service's
// 2,000 a day, weather asks MET, the counters and reviews write to the database), so only pages,
// the trip list and review totals are asked, as a visitor reading trips would.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const BASE = (args.find((a) => /^https?:/.test(a)) ?? "http://localhost:8787").replace(/\/$/, "");
const PEOPLE = Number(flag("people", 100));
const MINUTES = Number(flag("minutes", 1));
const ONE_ADDRESS = args.includes("--one-address");
const LIVE = args.includes("--live");
const THINK_MS = [500, 3000];

const list = JSON.parse(readFileSync(new URL("../public/data/trips/list.json", import.meta.url), "utf8")).trips;
const towns = JSON.parse(readFileSync(new URL("../data/towns.json", import.meta.url), "utf8")).towns;

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(THINK_MS[0] + Math.random() * (THINK_MS[1] - THINK_MS[0]));
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bratislava" });

/** Per kind of request: times (ms) and how many of each status. */
const stats = new Map();
/** "kind status" -> the start of one such answer. */
const samples = new Map();
function note(kind, ms, status) {
  let s = stats.get(kind);
  if (!s) stats.set(kind, (s = { ms: [], status: {} }));
  s.ms.push(ms);
  s.status[status] = (s.status[status] ?? 0) + 1;
}

async function hit(kind, path, person, init = {}) {
  const t = performance.now();
  let status;
  try {
    const res = await fetch(BASE + path, {
      ...init,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 turuj-load-test",
        "Sec-Fetch-Site": "same-origin",
        // Local runs only: workerd takes the visitor's address from this header.
        ...(LIVE ? {} : { "CF-Connecting-IP": ONE_ADDRESS ? "10.0.0.1" : `10.1.${person >> 8}.${person & 255}` }),
        ...init.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.text();
    status = res.status;
    // One sample of each failure, to tell Cloudflare's own errors (e.g. "error code: 1102") from ours.
    if (status >= 400 && !samples.has(`${kind} ${status}`)) {
      const title = /<title>([^<]*)<\/title>/i.exec(body)?.[1] ?? body.slice(0, 120);
      const code = /Error(?: code)?:?\s*(\d{3,4})/i.exec(body)?.[1] ?? "";
      samples.set(`${kind} ${status}`, `${res.headers.get("server") ?? ""} ${res.headers.get("cf-mitigated") ?? ""} ${code} ${title.replace(/\s+/g, " ").trim()}`);
    }
  } catch (err) {
    status = err.name === "TimeoutError" ? "timeout" : "network";
  }
  note(kind, performance.now() - t, status);
  return status;
}

/** One visitor, clicking until the time is up. */
async function person(n, until) {
  const town = pick(towns);
  // The visitor's start: their town, give or take a few km (rounded by the site like a real phone's).
  const from = `${(town.location.lat + (Math.random() - 0.5) * 0.05).toFixed(3)},${(town.location.lon + (Math.random() - 0.5) * 0.05).toFixed(3)}`;
  await hit("home page", "/", n);
  await hit("home list", "/data/home-list.json", n);
  if (!LIVE) await hit("visit counter", "/api/visit", n, { method: "POST" });
  while (Date.now() < until) {
    await think();
    const trip = pick(list);
    const p = trip.parking?.location ?? trip.start.location;
    // A tap on a trip card inside the site fetches the page's data (RSC), a shared link the whole page.
    if (Math.random() < 0.5) await hit("trip page", `/trasa/${trip.slug}`, n);
    else await hit("trip page data", `/trasa/${trip.slug}?_rsc=load`, n, { headers: { RSC: "1" } });
    await Promise.all([
      hit("reviews", `/api/review?slug=${trip.slug}`, n),
      ...(LIVE
        ? []
        : [
            hit("weather", `/api/weather?lat=${trip.destination.location.lat}&lon=${trip.destination.location.lon}`, n),
            hit("drive", `/api/drive?from=${from}&to=${p.lat},${p.lon}`, n),
            hit("visit counter", "/api/visit", n, { method: "POST" }),
          ]),
    ]);
    await think();
    if (Math.random() < 0.3) await hit("trip list", `/api/vylety?z=${town.id}&den=${today()}&limit=50`, n);
    if (Math.random() < 0.3) await hit("town page", `/vylety-z/${town.id}`, n);
    if (LIVE) continue;
    if (Math.random() < 0.3) {
      await hit("event counter", "/api/event", n, { method: "POST", body: JSON.stringify({ name: "trip_saved" }) });
    }
    if (Math.random() < 0.05) {
      const review = { slug: trip.slug, reviewer: `loadtest-${n}-${Date.now()}`, stars: 1 + Math.floor(Math.random() * 5), crowded: false };
      await hit("review save", "/api/review", n, { method: "POST", body: JSON.stringify(review) });
    }
  }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

const until = Date.now() + MINUTES * 60_000;
const started = performance.now();
console.log(`${PEOPLE} people for ${MINUTES} min on ${BASE}${ONE_ADDRESS ? " (all from one address)" : ""}`);
await Promise.all(Array.from({ length: PEOPLE }, (_, i) => person(i, until)));
const secs = (performance.now() - started) / 1000;

/** Answers a working site gives under load: limits and a busy router are expected, the page copes. */
const FINE = { drive: [200, 429, 502, 503], reviews: [200, 429], "review save": [200, 400, 429, 503], weather: [200, 429, 502] };
let bad = 0;
let total = 0;
console.log("\nrequest          count   p50 ms   p95 ms   p99 ms   max ms   statuses");
for (const [kind, s] of [...stats].sort()) {
  const ms = s.ms.sort((a, b) => a - b);
  total += ms.length;
  const ok = FINE[kind] ?? [200, 204];
  for (const [status, count] of Object.entries(s.status)) if (!ok.includes(Number(status))) bad += count;
  const cols = [ms.length, pct(ms, 50), pct(ms, 95), pct(ms, 99), ms[ms.length - 1]].map((v) => String(Math.round(v)).padStart(8));
  console.log(`${kind.padEnd(15)}${cols.join(" ")}   ${JSON.stringify(s.status)}`);
}
for (const [what, sample] of samples) console.log(`${what}: ${sample}`);
console.log(`\n${total} requests in ${secs.toFixed(0)} s (${(total / secs).toFixed(1)} a second), ${bad} unexpected answers`);
process.exit(bad > 0 ? 1 : 0);
