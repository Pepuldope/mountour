"use client";

import { track } from "@/lib/analytics";
import { routeGpx } from "@/lib/gpx";
import { useT } from "@/lib/i18n";

/**
 * "Stiahnuť GPX trasu": a place's file holds every route to it, so this downloads only the
 * route on this page, as `<slug>.gpx`. Falls back to the whole file when it can't be cut.
 */
export function GpxDownload({ gpxUrl, slug, name }: { gpxUrl: string; slug: string; name: string }) {
  const file = gpxUrl.split("#")[0];
  const t = useT();

  async function download(e: React.MouseEvent<HTMLAnchorElement>) {
    // Decided before the fetch: once the click returns, the browser would already follow the link.
    e.preventDefault();
    track("gpx_download", { trail: slug });
    let gpx: string | null = null;
    try {
      const res = await fetch(file);
      if (res.ok) gpx = routeGpx(await res.text(), decodeURIComponent(new URL(gpxUrl, "http://x").hash.slice(1)), name);
    } catch {
      // Offline and not saved: fall back to the whole file.
    }
    const url = gpx ? URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" })) : file;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (gpx) setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <a href={file} download={`${slug}.gpx`} onClick={download} className="w-fit font-semibold text-[var(--accent)] underline">
      {t("Stiahnuť GPX trasu")}
    </a>
  );
}
