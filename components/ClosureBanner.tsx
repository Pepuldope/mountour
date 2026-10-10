"use client";

import type { Closure } from "@/lib/types";
import { activeClosures } from "@/lib/closures";
import { formatDateSk } from "@/lib/format";
import { useTripDay } from "@/lib/tripSettings";

interface Props {
  closures: Closure[];
}

export function ClosureBanner({ closures }: Props) {
  // The day the trip page plans for (picked day, else today or tomorrow).
  const { date } = useTripDay();

  // CRITICAL: missing data must never read as good news. If we have no
  // closure rows at all for this trail, say so plainly instead of implying
  // "otvorené".
  if (closures.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
        <p className="font-semibold">Stav chodníka neoverený</p>
        <p className="text-sm opacity-70">
          Pre túto trasu nemáme žiadne údaje o uzávierkach. Pred výletom si stav overte na inom zdroji.
        </p>
      </div>
    );
  }

  // The trip date only exists in the browser (it is filled in after hydration,
  // in local time). Don't guess from the server's clock: wait for it.
  if (!date) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
        <p className="font-semibold">Overujem uzávierky…</p>
      </div>
    );
  }

  // Check the day the user plans to go, not today: a closure starting next
  // week matters for a trip planned next week.
  const checkDate = date;
  const active = activeClosures(closures, checkDate);

  if (active.length > 0) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border-2 border-[var(--warn)] bg-[var(--warn-bg)] p-4">
        <p className="font-bold text-[var(--warn)]">
          Chodník je v deň výletu ({formatDateSk(checkDate)}) uzavretý
        </p>
        {active.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 text-sm">
            <p>{c.reason}</p>
            <p>
              <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                Zdroj informácie
              </a>
            </p>
            <p className="opacity-70">Overené: {formatDateSk(c.verified_on)}</p>
          </div>
        ))}
      </div>
    );
  }

  const mostRecentlyVerified = closures.reduce((latest, c) =>
    c.verified_on > latest.verified_on ? c : latest
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--ok-bg)] p-4">
      <p className="font-semibold">
        Podľa dostupných údajov v deň výletu ({formatDateSk(checkDate)}) neplatí žiadna uzávierka
      </p>
      <p className="text-sm opacity-70">
        Naposledy overené: {formatDateSk(mostRecentlyVerified.verified_on)}
      </p>
    </div>
  );
}
