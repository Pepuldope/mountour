import { FeedbackForm } from "@/components/FeedbackForm";
import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Napíšte nám",
  description: "Povedzte nám, čo sa vám na Túruj páči a čo by sme mali zlepšiť.",
  path: "/napiste-nam",
});

export default function FeedbackPage() {
  return (
    <InfoPage title="Napíšte nám" intro="Čítame každú správu. Pomôžete nám spraviť Túruj lepším.">
      <FeedbackForm kind="napad" />
    </InfoPage>
  );
}
