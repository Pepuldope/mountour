import { FeedbackForm } from "@/components/FeedbackForm";
import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Report a problem",
  description: "Report a wrong route, a closed trail, a wrong car park or a problem with the site.",
  path: "/nahlasit-chybu",
  lang: "en",
});

export default function FeedbackPage() {
  return (
    <InfoPage title="Report a problem" intro="Spotted something wrong? We'll fix it as soon as we can.">
      <FeedbackForm kind="chyba" />
    </InfoPage>
  );
}
