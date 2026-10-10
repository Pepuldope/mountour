import { getAllTrails } from "@/lib/data";
import { HomeExplorer } from "@/components/HomeExplorer";
import { JsonLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, absoluteUrl } from "@/lib/site";

// Rebuild the trail list from Supabase at most every 5 minutes.
export const revalidate = 300;

export const metadata = pageMetadata({
  title: `${SITE_TITLE} | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

export default async function Home() {
  const trails = await getAllTrails();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: absoluteUrl("/"),
              name: SITE_NAME,
              description: SITE_DESCRIPTION,
              inLanguage: "sk",
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: SITE_NAME,
              url: absoluteUrl("/"),
              logo: absoluteUrl("/icons/icon-512.png"),
            },
          ],
        }}
      />
      <HomeExplorer trails={trails} />
    </>
  );
}
