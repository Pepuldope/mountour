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

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
