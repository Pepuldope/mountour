// Guard against error 1102 ("Worker exceeded resource limits") coming back.
// The free Worker plan gives each request 10 ms of CPU, and drawing a page
// costs several times that, so a page may never be drawn on every visit: it
// must be built ahead (home, info pages) or drawn once and kept (trip pages,
// lib/pageCache.ts). Run after `next build`; fails when a page would be drawn
// per visit or would ask to be redrawn on a timer.
import { readFileSync } from "node:fs";

/** Pages that may draw on every visit, and why. */
const ALLOWED_PER_VISIT = {
  "/statistiky": "noindex report page, opened by the team only",
};

const routes = JSON.parse(readFileSync(".next/app-path-routes-manifest.json", "utf8"));
const prerender = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
const config = readFileSync("open-next.config.ts", "utf8");

const problems = [];
const pages = Object.entries(routes)
  .filter(([file]) => file.endsWith("/page"))
  .map(([, path]) => path)
  .filter((path) => !path.startsWith("/_"));

for (const path of pages) {
  if (path in ALLOWED_PER_VISIT) continue;
  const built = prerender.routes[path];
  const onFirstVisit = prerender.dynamicRoutes[path];
  if (!built && !onFirstVisit) {
    problems.push(`${path} is drawn on every visit. Make it static, or give it generateStaticParams (see app/trasa/[slug]/page.tsx).`);
  }
  const seconds = built?.initialRevalidateSeconds ?? onFirstVisit?.fallbackRevalidate;
  if (typeof seconds === "number") {
    problems.push(`${path} uses revalidate (${seconds} s). The page cache is read-only between deploys: remove it.`);
  }
}
for (const path of Object.keys(prerender.routes)) {
  const seconds = prerender.routes[path].initialRevalidateSeconds;
  if (typeof seconds === "number" && !pages.includes(path)) {
    problems.push(`${path} uses revalidate (${seconds} s). The page cache is read-only between deploys: remove it.`);
  }
}
if (!/incrementalCache:\s*pageCache/.test(config) || !/enableCacheInterception:\s*true/.test(config)) {
  problems.push("open-next.config.ts must use lib/pageCache.ts with enableCacheInterception: true.");
}

if (problems.length) {
  console.error("Pages that would run the free Worker out of CPU (error 1102):\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`Page cache check: ${pages.length} pages, all built ahead or kept after the first visit.`);
