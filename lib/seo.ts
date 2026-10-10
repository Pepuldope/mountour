import type { Metadata } from "next";
import { OG_IMAGE, SITE_NAME } from "@/lib/site";

/**
 * Title, description, canonical URL and link-preview text for one page.
 * Child pages replace the root `openGraph` object as a whole, so the shared
 * fields are repeated here.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** true = use the title as is, without the " | MounTour" suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "sk_SK",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [OG_IMAGE.url] },
  };
}
