"use client";

import { track, type AnalyticsEvent } from "@/lib/analytics";

/** Big button to an external form, or a "coming soon" note while the URL is empty. */
export function FormLink({ href, label, event }: { href: string; label: string; event: AnalyticsEvent }) {
  if (!href) {
    return <p className="rounded-lg border border-[var(--border)] p-3 text-sm">Formulár práve pripravujeme. Skúste to o pár dní.</p>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track(event)}
      className="w-fit rounded-lg bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--accent-contrast)]"
    >
      {label}
    </a>
  );
}
