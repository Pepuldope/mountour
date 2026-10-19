import { monthlyEvents } from "@/lib/eventCounts";
import { monthlyStats } from "@/lib/visitStore";

/**
 * GET /api/statistiky -> { months, events }: the numbers on /statistiky.
 * Read by that page in the browser, so the page itself stays a prebuilt file:
 * drawing it on the server for every visit runs over the free plan's CPU time.
 * null means no database (local dev).
 */
export async function GET() {
  const [months, events] = await Promise.all([monthlyStats(), monthlyEvents()]);
  return Response.json({ months, events }, { headers: { "Cache-Control": "no-store" } });
}
