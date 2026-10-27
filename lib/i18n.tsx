"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { langOfPath, langPath, skPath, tr } from "@/lib/lang";
import type { Lang, Vars } from "@/lib/lang";

const LangContext = createContext<Lang>("sk");

/** Reads the language from the address, so it is right in the built HTML too. */
export function LangProvider({ children }: { children: ReactNode }) {
  const lang = langOfPath(usePathname());
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** t("Slovak sentence", vars) in the page's language. */
export function useT() {
  const lang = useLang();
  return useCallback((sk: string, vars?: Vars) => tr(lang, sk, vars), [lang]);
}

/**
 * A link that loads its page ahead only once someone points at it, touches it or tabs to it.
 * Next.js loads every link on screen ahead by default: the home list alone sent a dozen trip
 * pages to the Worker per visitor, a few came back 503 (Peter's console, 2026-10-26), and each
 * one counts towards the free plan's 100,000 requests a day (load test, 2026-10-27).
 */
export function IntentLink({ prefetch, onPointerEnter, onTouchStart, onFocus, ...rest }: ComponentProps<typeof Link>) {
  const [wanted, setWanted] = useState(false);
  return (
    <Link
      {...rest}
      prefetch={prefetch !== undefined ? prefetch : wanted ? null : false}
      onPointerEnter={(e) => (setWanted(true), onPointerEnter?.(e))}
      onTouchStart={(e) => (setWanted(true), onTouchStart?.(e))}
      onFocus={(e) => (setWanted(true), onFocus?.(e))}
    />
  );
}

/** A link inside the site that stays in the page's language. */
export function LangLink({ href, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  return <IntentLink href={langPath(useLang(), href)} {...rest} />;
}

/** Small "EN" / "SK" switch to the same page in the other language. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const path = usePathname() ?? "/";
  const lang = langOfPath(path);
  const other = lang === "en" ? skPath(path) : langPath("en", path);
  return (
    <a
      href={other}
      hrefLang={lang === "en" ? "sk" : "en"}
      lang={lang === "en" ? "sk" : "en"}
      aria-label={lang === "en" ? "Slovensky" : "English"}
      className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-bold tracking-wide ${className}`}
    >
      {lang === "en" ? "SK" : "EN"}
    </a>
  );
}

/** Slovak text in the page's language, for server components: <T>Späť na výlety</T>. */
export function T({ children, vars }: { children: string; vars?: Vars }) {
  return <>{useT()(children, vars)}</>;
}
