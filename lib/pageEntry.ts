// A page built ahead, as the deploy keeps it (cdn-cgi/_next_cache/...): read by worker.ts.

export interface PageEntry {
  type?: string;
  html?: string;
  rsc?: string;
  meta?: { status?: number; headers?: Record<string, string> };
}

/**
 * The cache entry with only the part this answer needs. A home page entry is ~0.5 MB of JSON (the
 * page, its data and each part again for prefetches), and parsing all of it was most of the CPU
 * left; the entry is {"type":..,"meta":{..},"html":"..","rsc":"..","segmentData":{..}}, so the
 * meta and the one string are cut out and parsed alone. Anything unexpected: parse it all.
 */
export function pick(text: string, part: "html" | "rsc"): PageEntry {
  const html = text.indexOf(',"html":"');
  const rsc = text.indexOf('","rsc":"', html);
  const end = text.indexOf('","segmentData":', rsc);
  if (text.startsWith('{"type":"app","meta":') && html > 0 && rsc > html && end > rsc) {
    try {
      const meta = JSON.parse(text.slice('{"type":"app","meta":'.length, html));
      const value = part === "html" ? text.slice(html + 8, rsc + 1) : text.slice(rsc + 8, end + 1);
      return { type: "app", meta, [part]: JSON.parse(value) };
    } catch {
      // Not the layout we expect: fall through.
    }
  }
  return JSON.parse(text) as PageEntry;
}
