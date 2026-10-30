import { accountFor, checkLoginCode, cleanEmail, sessionCookie, startSession } from "@/lib/auth";
import { OTHER_SITE, TOO_MANY, fromOtherSite, overCallLimit } from "@/lib/routeGuard";

// Step 2 of the email sign-in: the typed code starts a session (lib/auth.ts).

export async function POST(request: Request): Promise<Response> {
  if (fromOtherSite(request)) return OTHER_SITE();
  if (await overCallLimit(request, "auth")) return TOO_MANY();
  let body: { email?: unknown; code?: unknown } = {};
  try {
    body = JSON.parse((await request.text()).slice(0, 500));
  } catch {}
  const email = cleanEmail(body.email);
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!email || code.length !== 6) return Response.json({ error: "wrong" }, { status: 400 });
  try {
    const check = await checkLoginCode(email, code);
    if (check !== "ok") return Response.json({ error: check }, { status: 400 });
    const account = await accountFor(email);
    const token = await startSession(account.id);
    return Response.json({ account: { email: account.email, name: account.name } }, { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } });
  } catch (err) {
    console.warn("[auth] code check failed:", err);
    return Response.json({ error: "off" }, { status: 503 });
  }
}
