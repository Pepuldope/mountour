import type { NextConfig } from "next";

// Basic browser protections for every page and API answer: no other site may
// show MounTour inside a frame (clickjacking), browsers don't guess file types,
// links to other sites don't carry our full addresses, and only location (for
// "Použiť moju polohu") is asked of the device. Files in public/ get the same
// via public/_headers.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
