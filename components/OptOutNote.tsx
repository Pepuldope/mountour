"use client";

import { useEffect, useState } from "react";
import { applyOptOut, optedOut } from "@/lib/analytics";

/** On /statistiky: whether this browser is left out of the counts ("?nepocitat=1"). */
export function OptOutNote() {
  const [off, setOff] = useState<boolean | null>(null);
  useEffect(() => {
    applyOptOut();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOff(optedOut());
  }, []);
  if (off === null) return null;
  return (
    <p className="text-xs opacity-70">
      {off
        ? "Tento prehliadač sa nepočíta (zapnuté cez ?nepocitat=1, zrušíte cez ?nepocitat=0)."
        : "Tento prehliadač sa počíta. Pre vlastné zariadenia tímu otvorte stránku s ?nepocitat=1."}
    </p>
  );
}
