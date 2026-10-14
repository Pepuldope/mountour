import type { MetadataRoute } from "next";
import { getAllTrails } from "@/lib/tripFiles";
import { absoluteUrl } from "@/lib/site";

// Built once per deploy (every push to main, including the weekly trip refresh), so new
// trips appear without touching this file and the Worker never re-reads the index for it.
export const dynamic = "force-static";

const INFO_PAGES = ["/zdroje", "/sukromie", "/upozornenie"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const trails = await getAllTrails();
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    ...trails.map(({ trail }) => ({
      url: absoluteUrl(`/trasa/${trail.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...INFO_PAGES.map((path) => ({ url: absoluteUrl(path), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
