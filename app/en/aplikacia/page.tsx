import { InfoPage } from "@/components/InfoPage";
import { InstallGuide } from "@/components/InstallGuide";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Get the app",
  description: "How to put Túruj on your iPhone or Android home screen: step by step, with pictures.",
  path: "/aplikacia",
  lang: "en",
});

export default function AppPage() {
  return (
    <InfoPage title="Túruj ako appka" intro="Žiadny obchod s aplikáciami: Túruj si pridáte na plochu priamo z prehliadača.">
      <InstallGuide />
    </InfoPage>
  );
}
