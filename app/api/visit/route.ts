import { clientIp, isBot, localDay, visitorHash } from "@/lib/visitDays";
import { monthSalt, recordVisitDay } from "@/lib/visitStore";

// Records "this visitor came today" (one row per visitor per day) so
// /statistiky can count people with 4+ visit days a month. Called once per
// page load by components/VisitBeacon.tsx. Without the Cloudflare database
// (local dev, Vercel) it does nothing.

export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!ip || isBot(userAgent)) return new Response(null, { status: 204 });

  try {
    const day = localDay(new Date());
    const salt = await monthSalt(day.slice(0, 7));
    if (salt) await recordVisitDay(await visitorHash(salt, day, ip, userAgent), day);
  } catch (err) {
    console.warn("[visit] not recorded:", err);
  }

  return new Response(null, { status: 204 });
}
