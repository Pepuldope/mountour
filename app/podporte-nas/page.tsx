import { SupportPage } from "@/components/SupportPage";
import { pageMetadata } from "@/lib/seo";
import { SUPPORT_ON } from "@/lib/site";
import { getAllTrails } from "@/lib/tripFiles";
import { getTowns } from "@/lib/trips";

export const dynamic = "force-static";

export const metadata = {
  ...pageMetadata({
    title: "Podporte nás",
    description: "Túruj je zadarmo a bez reklám. Pomôžte nám príspevkom cez QR kód v banke alebo tým, že o nás poviete ďalej.",
    path: "/podporte-nas",
  }),
  // Out of search until money is switched on (lib/support.ts).
  ...(SUPPORT_ON ? {} : { robots: { index: false, follow: false } }),
};

export default async function SupportUsPage() {
  return <SupportPage trips={(await getAllTrails()).length} towns={getTowns().length} />;
}
