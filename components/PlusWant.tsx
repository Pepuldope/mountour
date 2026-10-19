"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { TESTER_FORM_URL } from "@/lib/site";

/**
 * "Chcem to" for MounTour+, which does not exist yet: a price test. A tap is
 * counted in Umami (no personal data) and the page says so straight away.
 */
export function PlusWant() {
  const [answer, setAnswer] = useState<"want" | "no" | null>(null);

  if (answer === "want") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl bg-[var(--ok-bg)] p-3 text-sm">
        <p className="font-semibold text-[var(--ok)]">Ďakujeme, započítané.</p>
        <p>
          Úprimne: MounTour+ zatiaľ neexistuje. Zisťujeme, či by oň bol záujem, a postavíme ho, len ak áno. Nič
          neplatíte a nič sme si o vás neuložili.
        </p>
        <a href={TESTER_FORM_URL} target="_blank" rel="noopener noreferrer" className="w-fit font-semibold text-[var(--accent)] underline">
          Chcem vedieť, keď bude hotový
        </a>
      </div>
    );
  }
  if (answer === "no") {
    return (
      <p role="status" className="rounded-xl bg-[var(--segment-bg)] p-3 text-sm">
        Ďakujeme, aj to nám pomôže. MounTour ostáva zadarmo tak ako doteraz.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => {
          track("plus_want");
          setAnswer("want");
        }}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--accent-contrast)]"
      >
        Chcem to
      </button>
      <button
        type="button"
        onClick={() => {
          track("plus_no");
          setAnswer("no");
        }}
        className="px-2 text-sm text-[var(--muted)] underline"
      >
        Za túto cenu nie
      </button>
    </div>
  );
}
