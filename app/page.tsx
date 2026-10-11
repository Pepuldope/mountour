import { getAllTrails } from "@/lib/tripFiles";
import { HomeExplorer } from "@/components/HomeExplorer";
import { JsonLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, absoluteUrl } from "@/lib/site";

// Rebuild the page at most every 5 minutes, so a new weekly build shows up.
export const revalidate = 300;

export const metadata = pageMetadata({
  title: `${SITE_TITLE} | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

const HOME_FIRST = 30;

export default async function Home() {
  // The best known trips are in the page itself; the browser then loads every trip.
  const trails = (await getAllTrails()).slice(0, HOME_FIRST);

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
