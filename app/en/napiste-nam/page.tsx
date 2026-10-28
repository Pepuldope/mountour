import { FeedbackForm } from "@/components/FeedbackForm";
import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Write to us",
  description: "Tell us what you like about Túruj and what we should improve.",
  path: "/napiste-nam",
  lang: "en",
});

export default function FeedbackPage() {
  return (
    <InfoPage title="Write to us" intro="We read every message. You help us make Túruj better.">
      <FeedbackForm kind="napad" />
    </InfoPage>
  );
}
