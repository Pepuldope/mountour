import type { Closure } from "@/lib/types";
import { activeClosures } from "@/lib/closures";
import { formatDateSk } from "@/lib/format";

interface Props {
  closures: Closure[];
  /** ISO YYYY-MM-DD, injectable for tests; defaults to today. */
  today?: string;
}

export function ClosureBanner({ closures, today }: Props) {
  const todayIso = today ?? new Date().toISOString().slice(0, 10);

  // CRITICAL: missing data must never read as good news. If we have no
  // closure rows at all for this trail, say so plainly instead of implying
  // "otvorene".
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

  const active = activeClosures(closures, todayIso);

  if (active.length > 0) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border-2 border-[var(--warn)] bg-[var(--warn-bg)] p-4">
        <p className="font-bold text-[var(--warn)]">Chodník je momentálne uzavretý</p>
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
      <p className="font-semibold">Podla dostupnych udajov aktualne ziadna uzavierka neplati</p>
      <p className="text-sm opacity-70">
        Naposledy overene: {formatDateSk(mostRecentlyVerified.verified_on)}
      </p>
    </div>
  );
}
