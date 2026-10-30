import type { Lang } from "@/lib/lang";

// The sign-in code email, sent through Resend (free: 3,000 a month, 100 a day; key in the
// RESEND_API_KEY Cloudflare secret, sender domain turuj.sk set up by Peter, 2026-10-30).

const FROM = "Túruj <prihlasenie@turuj.sk>";

const TEXT = {
  sk: {
    subject: (c: string) => `${c} je váš kód pre Túruj`,
    body: (c: string, min: number) =>
      `Váš kód pre Túruj:\n\n${c}\n\nPlatí ${min} minút. Ak ste o kód nežiadali, tento email pokojne zmažte.\n\nTúruj · turuj.sk`,
  },
  en: {
    subject: (c: string) => `${c} is your Túruj code`,
    body: (c: string, min: number) =>
      `Your Túruj code:\n\n${c}\n\nIt works for ${min} minutes. If you didn't ask for it, just delete this email.\n\nTúruj · turuj.sk`,
  },
};

function html(text: string, code: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const [first, , ...rest] = text.split("\n");
  return `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#14233b;max-width:420px">
<p>${esc(first)}</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${esc(code)}</p>
${rest.filter((l) => l && l !== code).map((l) => `<p style="color:#5b6577;font-size:14px">${esc(l)}</p>`).join("")}
</div>`;
}

/** Sends the code; false when there is no key or Resend refuses. */
export async function sendCodeMail(to: string, code: string, minutes: number, lang: Lang): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const t = TEXT[lang];
  const text = t.body(code, minutes);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: t.subject(code), text, html: html(text, code) }),
  });
  if (!res.ok) console.warn("[auth] mail not sent:", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}
