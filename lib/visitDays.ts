// "Visit days": how many different days in a month one visitor came back.
// Same method Umami uses for its visitors: a one-way hash of IP + browser
// with a key that changes every month. Nothing is stored on the device and the
// raw IP is never stored; next month the same person gets a new, unrelated hash.

const TIME_ZONE = "Europe/Bratislava";

/** YYYY-MM-DD in Slovak local time. */
export function localDay(now: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|monitor/i;

export function isBot(userAgent: string): boolean {
  return userAgent === "" || BOT_UA.test(userAgent);
}

/** The visitor's IP as Cloudflare / Vercel / a proxy pass it on, or null. */
export function clientIp(headers: Headers): string | null {
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  if (direct) return direct.trim();
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

/** sha256(salt | month | ip | user agent), hex. */
export async function visitorHash(salt: string, day: string, ip: string, userAgent: string): Promise<string> {
  const month = day.slice(0, 7);
  const bytes = new TextEncoder().encode(`${salt}|${month}|${ip}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
