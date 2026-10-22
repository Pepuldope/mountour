import type { NextConfig } from "next";

// Which outside servers a page may talk to. Anything not listed here is
// blocked by the browser: no scripts from other hosts and no fetch() to them.
// It doesn't stop an injected inline script from running (Next.js puts its page
// data in inline scripts, hence 'unsafe-inline'; nonces would stop pages from
// being prebuilt). Map: OpenFreeMap (style, tiles, fonts, icons), and MapLibre
// draws in a blob: worker. Place search: Nominatim. Visits: Umami Cloud. Town
// photos: Wikimedia (lib/assetBudget.test.ts checks photos.json against img-src).
// Adding a new outside service? Add it here.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://cloud.umami.is${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://thumb.wikimedia.org https://upload.wikimedia.org",
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://cloud.umami.is https://api-gateway.umami.dev",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Basic browser protections for every page and API answer: no other site may
// show MounTour inside a frame (clickjacking), browsers don't guess file types,
// links to other sites don't carry our full addresses, and only location (for
// "Použiť moju polohu") is asked of the device. Files in public/ get the same
// via public/_headers.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
];

// Pages and their client-side navigation data: the browser asks again on every
// visit (a quick check, cheap thanks to the ETag). Next.js's default lets the
// browser show a page up to 30 days old while it fetches the new one, so the
// first visit after a deploy ran the old page's code against new data and
// deleted code files: trails missing, first click failing. The Worker's own page
// cache (lib/pageCache.ts) is not affected. API answers set their own caching.
const PAGE_CACHE_CONTROL = { key: "Cache-Control", value: "no-cache" };

// One id per deploy (Workers Builds gives every build its commit). Next.js tags
// code files with it, and a tab still open from before a deploy reloads the page
// on its next click instead of mixing old and new code. OpenNext also uses it to
// key the page cache, so a deploy still starts that cache fresh. Unset locally.
const DEPLOYMENT_ID = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 12) || undefined;
// The browser compares this answer header with its own id on every click. Pages
// served from the Worker's page cache come without it, which made every click a
// full reload, so send it with every page here.
const DEPLOYMENT_HEADERS = DEPLOYMENT_ID ? [{ key: "x-nextjs-deployment-id", value: DEPLOYMENT_ID }] : [];

const nextConfig: NextConfig = {
  deploymentId: DEPLOYMENT_ID,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/((?!api/|_next/).*)", headers: [PAGE_CACHE_CONTROL, ...DEPLOYMENT_HEADERS] },
    ];
  },
};

export default nextConfig;
