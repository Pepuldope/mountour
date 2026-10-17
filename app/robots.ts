import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Route comparisons (/trasa/<slug>/cesty) are drawn on their first visit and kept in KV, which
    // takes 1,000 writes a day: a crawler walking thousands of them would spend that and the CPU.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/ulozene", "/trasa/*/cesty"] },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
