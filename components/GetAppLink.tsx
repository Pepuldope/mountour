"use client";

import { track } from "@/lib/analytics";
import { useInstalled } from "@/lib/installApp";
import { LangLink, useT } from "@/lib/i18n";
import { UiIcon } from "@/components/UiIcon";

/** "Získať appku" chip in the home top bar; gone once Túruj runs from the home screen. */
export function GetAppLink() {
  const t = useT();
  if (useInstalled()) return null;
  return (
    <LangLink
      href="/aplikacia"
      onClick={() => track("app_link", { from: "top" })}
      className="inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-chip)] bg-[var(--accent)] px-3 py-1.5 text-sm font-bold whitespace-nowrap text-[var(--accent-contrast)]"
    >
      <UiIcon name="phone" size={15} />
      {t("Získať appku")}
    </LangLink>
  );
}
