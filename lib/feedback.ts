import { getDb } from "@/lib/d1";

// Messages from the "Napíšte nám" and "Nahlásiť chybu" pages (Peter, 2026-10-25: C2). Stored in our
// database; nothing about the sender unless they leave an email for a reply. No IP, no browser id.

import { FEEDBACK_KINDS, FEEDBACK_MAX, PROBLEM_TOPICS } from "@/lib/feedbackLimits";
import type { FeedbackKind, ProblemTopic } from "@/lib/feedbackLimits";

export interface FeedbackIn {
  kind: FeedbackKind;
  topic: ProblemTopic | null;
  /** The trip it is about, when sent from a trip page. */
  slug: string | null;
  text: string;
  /** Only when the sender wants a reply. */
  email: string | null;
  lang: "sk" | "en";
}

const SLUG = /^[a-z0-9-]{1,120}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

/** The message as stored, or null when anything in it is off. */
export function parseFeedback(body: unknown): FeedbackIn | null {
  if (!body || typeof body !== "object") return null;
  const { kind, topic, slug, text, email, lang } = body as Record<string, unknown>;
  if (!FEEDBACK_KINDS.includes(kind as FeedbackKind)) return null;
  if (topic != null && !PROBLEM_TOPICS.includes(topic as ProblemTopic)) return null;
  if (kind === "chyba" && topic == null) return null;
  if (slug != null && (typeof slug !== "string" || !SLUG.test(slug))) return null;
  if (typeof text !== "string") return null;
  const clean = text.trim().slice(0, FEEDBACK_MAX);
  if (clean.length < 3) return null;
  let mail: string | null = null;
  if (email != null && email !== "") {
    if (typeof email !== "string" || !EMAIL.test(email.trim())) return null;
    mail = email.trim();
  }
  return {
    kind: kind as FeedbackKind,
    topic: kind === "chyba" ? (topic as ProblemTopic) : null,
    slug: (slug as string | null | undefined) ?? null,
    text: clean,
    email: mail,
    lang: lang === "en" ? "en" : "sk",
  };
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, topic TEXT, slug TEXT, text TEXT NOT NULL, email TEXT, lang TEXT NOT NULL, at TEXT NOT NULL)`;
let ready: Promise<unknown> | null = null;

async function db() {
  const d = await getDb();
  if (!d) return null;
  ready ??= d
    .prepare(SCHEMA)
    .run()
    .catch((err) => {
      ready = null;
      throw err;
    });
  await ready;
  return d;
}

/** Stores one message; false without the database. */
export async function saveFeedback(f: FeedbackIn, at: Date): Promise<boolean> {
  const d = await db();
  if (!d) return false;
  await d
    .prepare(`INSERT INTO feedback (kind, topic, slug, text, email, lang, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(f.kind, f.topic, f.slug, f.text, f.email, f.lang, at.toISOString())
    .run();
  return true;
}
