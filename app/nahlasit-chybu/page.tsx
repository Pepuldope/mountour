import { FeedbackForm } from "@/components/FeedbackForm";
import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Nahlásiť chybu",
  description: "Nahláste zlú trasu, uzavretý chodník, nesprávne parkovisko alebo chybu na stránke.",
  path: "/nahlasit-chybu",
});

export default function FeedbackPage() {
  return (
    <InfoPage title="Nahlásiť chybu" intro="Videli ste niečo zlé? Opravíme to čo najskôr.">
      <FeedbackForm kind="chyba" />
    </InfoPage>
  );
}
