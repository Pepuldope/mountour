import Link from "next/link";
import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { FormLink } from "@/components/FormLink";
import { pageMetadata } from "@/lib/seo";
import { FEEDBACK_FORM_URL } from "@/lib/site";

// Shared with testers after a session; not meant for search results.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Ako sa vám s MounTourom plánovalo?",
    description: "Krátky formulár po testovaní MounTouru: hodnotenie 1 až 5 a čo vám chýbalo.",
    path: "/spatna-vazba",
  }),
  robots: { index: false, follow: true },
};

export default function FeedbackPage() {
  return (
    <InfoPage
      title="Ako sa vám s MounTourom plánovalo?"
      intro="Ďakujeme, že ste MounTour vyskúšali. Tri minúty vašich odpovedí nám povedia, čo zlepšiť ako prvé."
    >
      <FormLink href={FEEDBACK_FORM_URL} label="Ohodnotiť MounTour" event="feedback_open" />
      <p className="text-xs opacity-70">
        Formulár beží v službe Google Forms. Viac v časti <Link href="/sukromie">Súkromie</Link>.
      </p>
    </InfoPage>
  );
}
