"use client";

import { useEffect } from "react";
import { isStaleCodeError, mayReloadNow } from "@/lib/staleCode";

/**
 * Safety net for a page that outlived a deploy: when one of its code files can't
 * be loaded any more (the deploy removed it), reload once to get the new page.
 * The reload time is kept per tab, so a file that is really broken can't loop.
 * Renders nothing.
 */
export function StaleCodeReload() {
  useEffect(() => {
    const reload = () => {
      // Offline (a saved trip): a reload can't fetch anything newer.
      if (!navigator.onLine) return;
      try {
        if (!mayReloadNow(sessionStorage, Date.now())) return;
      } catch {
        return; // No storage: no guard against a loop, so don't reload at all.
      }
      window.location.reload();
    };
    // A <script> or stylesheet that fails to load: resource errors don't bubble, so listen while capturing.
    const onError = (e: Event) => {
      const el = e.target as HTMLScriptElement | HTMLLinkElement | null;
      const src = el && "src" in el ? el.src : el && "href" in el ? el.href : "";
      if (src && new URL(src, location.href).pathname.startsWith("/_next/static/")) reload();
      else if (e instanceof ErrorEvent && isStaleCodeError(e.error)) reload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleCodeError(e.reason)) reload();
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
