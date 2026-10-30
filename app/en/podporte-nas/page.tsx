import { SupportPage } from "@/components/SupportPage";
import { pageMetadata } from "@/lib/seo";
import { SUPPORT_ON } from "@/lib/site";
import { getAllTrails } from "@/lib/tripFiles";
import { getTowns } from "@/lib/trips";

export const dynamic = "force-static";

export const metadata = {
  ...pageMetadata({
    title: "Support us",
    description: "Túruj is free and has no ads. Help us with a gift by bank QR code, or by telling others about us.",
    path: "/podporte-nas",
    lang: "en",
  }),
  ...(SUPPORT_ON ? {} : { robots: { index: false, follow: false } }),
};

export default async function SupportUsPage() {
  return <SupportPage trips={(await getAllTrails()).length} towns={getTowns().length} />;
}
