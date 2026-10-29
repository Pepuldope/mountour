// Writes .open-next/fast-pages.mjs for worker.ts: which addresses have a page built ahead, where
// the deploy keeps it, and the headers Next.js would add. With it the Worker answers those pages
// itself, without starting Next.js (load test on turuj.sk, 2026-10-29: about 1 in 8 answers was
// Cloudflare's "Worker exceeded resource limits"; a fresh Worker spent ~580 ms of CPU starting
// Next.js on its first visit, and a ready trip page still ~12 ms, over the free plan's 10 ms).
//
// Run after `opennextjs-cloudflare build` (npm run cf:build, deploy.yml, preview.yml). Reads only
// the build's own files: .next/routes-manifest.json and the page cache in .open-next/cache.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(".next/routes-manifest.json", "utf8"));
const buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
const pagesDir = `.open-next/cache/${buildId}/route-cache/APP_PAGE`;
const built = new Set(existsSync(pagesDir) ? readdirSync(pagesDir) : []);

// Next.js keeps each route's pages under the hash of the route's page path ("/trasa/[slug]/page").
const dirOf = (page) => createHash("sha256").update(`${page === "/" ? "" : page}/page`).digest("hex");

const routes = [...manifest.staticRoutes, ...manifest.dynamicRoutes]
  .filter((r) => !r.page.startsWith("/api/") && !r.page.startsWith("/_") && built.has(dirOf(r.page)))
  .map((r) => [r.regex, dirOf(r.page)]);

// Headers from next.config.ts as the build worked them out (security headers, Cache-Control,
// the deployment id that keeps open tabs from mixing old and new code).
const headers = manifest.headers.map((h) => [h.regex, h.headers.map((x) => [x.key, x.value])]);

// Old addresses that Next.js redirects to turuj.sk: those requests keep going through Next.js.
const redirectHosts = manifest.redirects.flatMap((r) => (r.has ?? []).filter((h) => h.type === "host").map((h) => h.value));

const out = { buildId, routes, headers, redirectHosts };
writeFileSync(".open-next/fast-pages.mjs", `export default ${JSON.stringify(out)};\n`);
console.log(`Fast pages: ${routes.length} routes with pages built ahead, build ${buildId}`);
if (routes.length === 0) {
  console.error("No built pages found: every page would go through Next.js again.");
  process.exit(1);
}
