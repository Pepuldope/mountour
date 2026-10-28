"use client";

import { useEffect, useState } from "react";

/** Chrome's install prompt event (not in the DOM typings). */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Opened from the home screen icon (Android, desktop Chrome, and iPhone's own flag). */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia("(display-mode: standalone)").matches;
}

/** True once the page knows it runs as the installed app; false on the server and in a browser tab. */
export function useInstalled(): boolean {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(isInstalled());
  }, []);
  return installed;
}

// Chrome fires the event once, early, often before the install page mounts: keep it for later.
let saved: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    saved = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    saved = null;
    listeners.forEach((l) => l());
  });
}

/**
 * Android Chrome's own install dialog, when the browser offers it. `install` is null when it
 * doesn't (iPhone, Firefox, already installed); the page then shows the steps instead.
 */
export function useInstallPrompt(): { install: (() => Promise<boolean>) | null } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!saved) return { install: null };
  const ev = saved;
  return {
    install: async () => {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      saved = null;
      listeners.forEach((l) => l());
      return outcome === "accepted";
    },
  };
}
