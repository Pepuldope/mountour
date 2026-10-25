import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  title: "Day trips from towns in Slovakia",
  description: "Day trips to the mountains and nature by the town you set off from: Bratislava, Košice, Žilina, Nitra and more than 130 other towns.",
  path: "/vylety-z",
  lang: "en",
});

export { default } from "../../vylety-z/page";
