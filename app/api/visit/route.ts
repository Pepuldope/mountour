import { clientIp, isBot, localDay, visitorHash } from "@/lib/visitDays";

// Records "this visitor came today" (one row per visitor per day) so the
// monthly_visitors view in Supabase can count people with 4+ visit days.
// Called once per page load by components/VisitBeacon.tsx.
//
// Needs three server-only settings (Cloudflare → Variables and Secrets):
//   SUPABASE_URL, SUPABASE_SECRET_KEY (secret), VISIT_SALT (secret).
// Without them it does nothing, so local dev and previews are never counted.

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const salt = process.env.VISIT_SALT;
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? "";

  if (!url || !key || !salt || !ip || isBot(userAgent)) {
    return new Response(null, { status: 204 });
  }

  const day = localDay(new Date());
  const visitor = await visitorHash(salt, day, ip, userAgent);

  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates,return=minimal",
  };
  // Legacy service_role keys are JWTs and also go in Authorization; the newer
  // sb_secret_ keys are sent as apikey only.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/visit_day?on_conflict=visitor,day`, {
      method: "POST",
      headers,
      body: JSON.stringify({ visitor, day }),
    });
    if (!res.ok) console.warn("[visit] Supabase insert failed:", res.status, await res.text());
  } catch (err) {
    console.warn("[visit] Supabase unreachable:", err);
  }

  return new Response(null, { status: 204 });
}
