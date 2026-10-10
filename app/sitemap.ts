import type { MetadataRoute } from "next";
import { getAllTrails } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

// Rebuilt with the trail list, so new trips appear without touching this file.
export const revalidate = 3600;

const INFO_PAGES = ["/testeri", "/zdroje", "/sukromie", "/upozornenie"];

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
