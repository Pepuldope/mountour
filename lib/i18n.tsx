"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect } from "react";
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

/** A link inside the site that stays in the page's language. */
export function LangLink({ href, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  return <Link href={langPath(useLang(), href)} {...rest} />;
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
