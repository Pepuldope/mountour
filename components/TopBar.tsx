"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { googleHref, signOut, signedIn, useAccount } from "@/lib/account";
import { LangLink, useLang, useT } from "@/lib/i18n";
import { langOfPath, langPath, skPath } from "@/lib/lang";
import { useSavedTrips } from "@/lib/savedTrips";
import { UiIcon } from "@/components/UiIcon";
import type { UiIconName } from "@/lib/uiIcons";

// The account button and the menu (Peter, 2026-10-29). Phone: a bar along the top that slides
// away while scrolling down and comes back on the way up. Computer: a small card in the top
// right corner, over the map.

/** The menu's links, in order. Peter adds more here. */
const MENU: { href: string; label: string; icon: UiIconName }[] = [
  { href: "/ulozene", label: "Moje výlety", icon: "list" },
  { href: "/vylety-z", label: "Výlety z miest", icon: "peak" },
  { href: "/aplikacia", label: "Získať appku", icon: "phone" },
  { href: "/napiste-nam", label: "Napíšte nám", icon: "chat" },
  { href: "/nahlasit-chybu", label: "Nahlásiť chybu", icon: "flag" },
  { href: "/o-nas", label: "O nás", icon: "person" },
];

/** The phone bar's height, without the notch. */
const BAR_PX = 52;

type Panel = "menu" | "account" | null;

export function TopBar() {
  const t = useT();
  const path = usePathname() ?? "/";
  // Kept with the page it was opened on: a new page closes it.
  const [opened, setOpened] = useState<{ kind: Panel; path: string }>({ kind: null, path });
  const panel = opened.path === path ? opened.kind : null;
  const setPanel = (p: Panel | ((cur: Panel) => Panel)) => setOpened((o) => ({ kind: typeof p === "function" ? p(o.path === path ? o.kind : null) : p, path }));
  const [shown, setShown] = useState(true);
  const [solid, setSolid] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { account } = useAccount();

  // Phone: hide on the way down, show on the way up and near the top.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setSolid(y > 8);
      if (y < 60) setShown(true);
      else if (y - last > 6) setShown(false);
      else if (last - y > 6) setShown(true);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const visible = shown || panel !== null;

  // Things stuck to the top of the page (the home page's search row) move down under the bar.
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 1023.98px)");
    const apply = () =>
      document.documentElement.style.setProperty("--topbar", phone.matches && visible ? `calc(${BAR_PX}px + env(safe-area-inset-top))` : "0px");
    apply();
    phone.addEventListener("change", apply);
    return () => phone.removeEventListener("change", apply);
  }, [visible]);

  // Back from Google with a problem: open the account panel and say what happened.
  useEffect(() => {
    const u = new URL(location.href);
    const why = u.searchParams.get("prihlasenie");
    if (!why) return;
    u.searchParams.delete("prihlasenie");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    if (why === "zrusene") return;
    const id = setTimeout(() => {
      setNotice(why === "off" ? "Prihlásenie cez Google ešte nie je zapnuté. Skúste email." : "Prihlásenie cez Google sa nepodarilo. Skúste znova alebo cez email.");
      setOpened({ kind: "account", path: location.pathname });
    });
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpened((o) => ({ ...o, kind: null }));
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpened((o) => ({ ...o, kind: null }));
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));
  const initial = account ? (account.name ?? account.email).trim().charAt(0).toUpperCase() : null;

  return (
    <div
      ref={boxRef}
      className={`fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-[transform,background-color,box-shadow] duration-200 motion-reduce:transition-none lg:inset-x-auto lg:top-3 lg:right-3 lg:translate-y-0 lg:bg-transparent lg:p-0 lg:shadow-none ${
        visible ? "translate-y-0" : "-translate-y-full"
      } ${solid || panel ? "bg-[var(--card-bg)] shadow-[0_1px_0_var(--border),0_6px_16px_rgba(20,35,59,.08)]" : "bg-transparent"}`}
    >
      <div className={`flex h-[52px] items-center justify-between gap-2 px-3 lg:h-auto lg:justify-end lg:gap-1 lg:rounded-full lg:bg-[var(--card-bg)] lg:p-1 lg:shadow-[var(--shadow-float)]`}>
        {/* The name only once the page's own header (which shows it) has scrolled away. */}
        <LangLink href="/" aria-label="Túruj" className={`block lg:hidden ${solid || panel ? "" : "invisible"}`}>
          <picture>
            <source srcSet="/brand/turuj-wordmark-on-dark.svg" media="(prefers-color-scheme: dark)" />
            <img src="/brand/turuj-wordmark.svg" alt="Túruj" width={56} height={24} className="h-6 w-auto" />
          </picture>
        </LangLink>
        <span className="flex items-center gap-2 lg:gap-1">
          <button
            type="button"
            onClick={() => toggle("account")}
            aria-expanded={panel === "account"}
            aria-label={account ? t("Účet") : t("Prihlásiť sa")}
            className={`grid h-10 w-10 place-items-center rounded-full border text-[15px] font-bold lg:h-9 lg:w-9 lg:border-0 ${
              initial ? "border-transparent bg-[var(--accent)] text-[var(--accent-contrast)]" : "border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--segment-bg)]"
            }`}
          >
            {initial ?? <UiIcon name="person" size={20} />}
          </button>
          <button
            type="button"
            onClick={() => toggle("menu")}
            aria-expanded={panel === "menu"}
            aria-label={t("Menu")}
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--segment-bg)] lg:h-9 lg:w-9 lg:border-0"
          >
            <UiIcon name={panel === "menu" ? "close" : "menu"} size={20} />
          </button>
        </span>
      </div>
      {panel && (
        <div className="absolute inset-x-3 top-[calc(100%+6px)] max-h-[calc(100dvh-80px)] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card-bg)] p-2 shadow-[var(--shadow-float)] lg:inset-x-auto lg:right-0 lg:w-80">
          {panel === "menu" ? <MenuList /> : <AccountPanel notice={notice} onDone={() => setNotice(null)} />}
        </div>
      )}
    </div>
  );
}

function MenuList() {
  const t = useT();
  const lang = useLang();
  const path = usePathname() ?? "/";
  const { trips } = useSavedTrips();
  const other = langOfPath(path) === "en" ? skPath(path) : langPath("en", path);
  const row = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-[var(--segment-bg)]";
  return (
    <nav aria-label={t("Menu")} className="flex flex-col">
      {MENU.map((m) => (
        <LangLink key={m.href} href={m.href} className={row}>
          <span className="text-[var(--muted)]">
            <UiIcon name={m.icon} size={19} />
          </span>
          <span className="flex-1">{t(m.label)}</span>
          {m.href === "/ulozene" && trips.length > 0 && (
            <span className="rounded-full bg-[var(--accent)] px-2 text-xs font-bold text-[var(--accent-contrast)]">{trips.length}</span>
          )}
        </LangLink>
      ))}
      <a href={other} hrefLang={lang === "en" ? "sk" : "en"} lang={lang === "en" ? "sk" : "en"} className={`${row} mt-1 border-t border-[var(--border)] pt-3`}>
        <span className="text-[var(--muted)]">
          <UiIcon name="globe" size={19} />
        </span>
        <span className="flex-1">{lang === "en" ? "Slovensky" : "English"}</span>
      </a>
    </nav>
  );
}

const ERRORS: Record<string, string> = {
  email: "Skontrolujte email, niečo v ňom chýba.",
  wait: "Kód sme poslali pred chvíľou. Nový o minútu.",
  wrong: "Kód nesedí. Skúste ho prepísať ešte raz.",
  expired: "Tento kód už neplatí. Pošlite si nový.",
  off: "Prihlásenie teraz nefunguje. Skúste to neskôr.",
  mail: "Email sa nepodarilo poslať. Skúste to neskôr.",
};

function AccountPanel({ notice, onDone }: { notice: string | null; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const { account } = useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account) {
    return (
      <div className="flex flex-col gap-1 p-1">
        <div className="px-2 pt-1 pb-2">
          <p className="font-bold">{account.name ?? t("Prihlásený účet")}</p>
          <p className="truncate text-sm text-[var(--muted)]">{account.email}</p>
        </div>
        <LangLink href="/ulozene" className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] font-medium hover:bg-[var(--segment-bg)]">
          <span className="text-[var(--muted)]"><UiIcon name="list" size={19} /></span>
          {t("Moje výlety")}
        </LangLink>
        <button type="button" onClick={() => void signOut()} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-left text-[15px] font-medium hover:bg-[var(--segment-bg)]">
          <span className="text-[var(--muted)]"><UiIcon name="logout" size={19} /></span>
          {t("Odhlásiť sa")}
        </button>
      </div>
    );
  }

  async function post(url: string, body: object): Promise<{ ok: boolean; json: Record<string, unknown> }> {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    onDone();
    try {
      const { ok, json } = await post("/api/auth/email", { email, lang });
      if (ok) {
        setStep("code");
        setCode("");
      } else setError(ERRORS[String(json.error)] ?? ERRORS.off);
    } catch {
      setError(ERRORS.off);
    }
    setBusy(false);
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ok, json } = await post("/api/auth/code", { email, code });
      if (ok && json.account) signedIn(json.account as { email: string; name: string | null });
      else setError(ERRORS[String(json.error)] ?? ERRORS.off);
    } catch {
      setError(ERRORS.off);
    }
    setBusy(false);
  }

  const input = "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] outline-none focus:border-[var(--accent)]";
  const main = "w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-[15px] font-bold text-[var(--accent-contrast)] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3 p-2">
      <div>
        <p className="text-[17px] font-bold">{t("Prihláste sa")}</p>
        <p className="text-sm text-[var(--muted)]">{t("Bez hesla: cez Google alebo kódom na email.")}</p>
      </div>
      {(notice || error) && <p className="rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-sm font-semibold text-[var(--warn)]">{t((error ?? notice)!)}</p>}
      {step === "email" ? (
        <>
          <a
            href="/api/auth/google"
            onClick={(e) => (e.currentTarget.href = googleHref())}
            className="flex items-center justify-center gap-2.5 rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-[15px] font-bold text-[#1f1f1f] hover:border-[var(--accent)]"
          >
            <GoogleG />
            {t("Pokračovať cez Google")}
          </a>
          <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            {t("alebo emailom")}
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <form onSubmit={sendCode} className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="login-email">{t("Email")}</label>
            <input id="login-email" type="email" required autoComplete="email" inputMode="email" placeholder={t("vas@email.sk")} value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            <button type="submit" disabled={busy || !email} className={main}>
              {busy ? t("Posielame…") : t("Poslať kód")}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={checkCode} className="flex flex-col gap-2">
          <p className="text-sm">{t("Poslali sme 6-miestny kód na {email}. Pozrite aj spam.", { email })}</p>
          <label className="sr-only" htmlFor="login-code">{t("Kód z emailu")}</label>
          <input
            id="login-code"
            autoFocus
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${input} text-center text-[22px] font-bold tracking-[0.3em]`}
          />
          <button type="submit" disabled={busy || code.replace(/\D/g, "").length !== 6} className={main}>
            {busy ? t("Overujeme…") : t("Prihlásiť sa")}
          </button>
          <div className="flex justify-between gap-2 text-sm font-semibold text-[var(--accent)]">
            <button type="button" onClick={() => (setStep("email"), setError(null))}>{t("Iný email")}</button>
            <button type="button" disabled={busy} onClick={() => void sendCode()}>{t("Poslať znova")}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
