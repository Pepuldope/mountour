import Script from "next/script";
import { COUNTED_HOSTS, UMAMI_WEBSITE_ID } from "@/lib/site";

/**
 * Umami Cloud: visits, sources and product events (lib/analytics.ts). No
 * cookies, nothing stored on the device, so no consent banner. Loads only when
 * a website ID is set, and counts only on the real site's hosts.
 */
export function Analytics() {
  if (!UMAMI_WEBSITE_ID) return null;
  return (
    <Script
      src="https://cloud.umami.is/script.js"
      strategy="afterInteractive"
      data-website-id={UMAMI_WEBSITE_ID}
      data-domains={COUNTED_HOSTS.join(",")}
    />
  );
}
