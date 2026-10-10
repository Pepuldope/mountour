"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";

// MapLibre touches `window`, so the map is client-only.
const TrailMapInner = dynamic(() => import("@/components/TrailMap").then((m) => m.TrailMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[var(--border)]" />,
});

/**
 * The map, loaded only once it scrolls near the screen: MapLibre is the
 * heaviest thing on the page and most phone visitors never reach it.
 */
export function TrailMap(props: ComponentProps<typeof TrailMapInner>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className="h-full w-full">
      {visible ? <TrailMapInner {...props} /> : <div className="h-full w-full bg-[var(--border)]" />}
    </div>
  );
}
