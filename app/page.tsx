import { getAllTrails } from "@/lib/data";
import { HomeExplorer } from "@/components/HomeExplorer";

// Rebuild the trail list from Supabase at most every 5 minutes.
export const revalidate = 300;

export default async function Home() {
  const trails = await getAllTrails();

  return <HomeExplorer trails={trails} />;
}
