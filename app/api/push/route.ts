import { getDb } from "@/lib/d1";
import { REMINDER_KINDS, cancelReminders, cleanName, messageFor, planReminders, vapidKeys } from "@/lib/pushPlan";
import type { PlanItem, ReminderKind } from "@/lib/pushPlan";
import { OTHER_SITE, TOO_MANY, fromOtherSite, overCallLimit } from "@/lib/routeGuard";
import { isPushEndpoint, sendPush, vapidPublicKey } from "@/lib/webPush";
import type { PushSub } from "@/lib/webPush";

// Reminders during a walk (lib/pushPlan.ts). GET: the key the browser subscribes with.
// POST {action: "plan" | "cancel" | "test", sub, slug, ...}: our pages only, a few calls a minute.

const MAX_BODY = 2000;
const NO_DB = () => Response.json({ error: "Pripomienky teraz nefungujú." }, { status: 503 });

export async function GET(): Promise<Response> {
  const db = await getDb();
  if (!db) return NO_DB();
  return Response.json({ key: vapidPublicKey(await vapidKeys(db)) });
}

function subOf(v: unknown): PushSub | null {
  const s = v as PushSub | null;
  if (!s || typeof s.endpoint !== "string" || !isPushEndpoint(s.endpoint)) return null;
  if (typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return null;
  if (s.keys.p256dh.length > 200 || s.keys.auth.length > 100 || s.endpoint.length > 1000) return null;
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}

export async function POST(request: Request): Promise<Response> {
  if (fromOtherSite(request)) return OTHER_SITE();
  if (await overCallLimit(request, "push")) return TOO_MANY();
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) throw new Error("too long");
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const sub = subOf(body.sub);
  const slug = typeof body.slug === "string" && /^[a-z0-9-]{1,120}$/.test(body.slug) ? body.slug : null;
  if (!sub || !slug) return Response.json({ error: "bad request" }, { status: 400 });
  const lang = body.lang === "en" ? "en" : "sk";
  const db = await getDb();
  if (!db) return NO_DB();
  try {
    if (body.action === "cancel") {
      const kind = REMINDER_KINDS.includes(body.kind as ReminderKind) ? (body.kind as ReminderKind) : undefined;
      await cancelReminders(db, sub.endpoint, slug, kind);
      return Response.json({ ok: true });
    }
    if (body.action === "test") {
      const got = await sendPush(sub, JSON.stringify(messageFor("test", "", slug, Date.now(), lang)), await vapidKeys(db));
      return Response.json({ ok: got === "ok" });
    }
    if (body.action === "plan") {
      const items: PlanItem[] = (Array.isArray(body.items) ? body.items : [])
        .map((i: { kind?: unknown; at?: unknown }) => ({ kind: i?.kind as ReminderKind, at: Number(i?.at) }))
        .filter((i: PlanItem) => Number.isFinite(i.at));
      const planned = await planReminders(db, sub, slug, cleanName(body.name), items, lang);
      return Response.json({ planned });
    }
  } catch (err) {
    console.warn("[push] failed:", err);
    return Response.json({ error: "Pripomienky sa teraz nepodarilo nastaviť." }, { status: 503 });
  }
  return Response.json({ error: "bad request" }, { status: 400 });
}
