// The Worker Cloudflare runs: OpenNext's (the whole site) plus a cron job.
// Every 5 minutes (wrangler.jsonc "triggers") it sends the walk reminders that fall due (lib/pushPlan.ts).
// Built by `opennextjs-cloudflare build` before wrangler bundles this file: missing until then.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import site from "./.open-next/worker.js";
import type { D1Like } from "./lib/d1";
import { sendDue } from "./lib/pushPlan";

interface Env {
  VISITS_DB?: D1Like;
}

interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

const worker = {
  fetch: site.fetch,
  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    if (!env.VISITS_DB) return;
    ctx.waitUntil(
      sendDue(env.VISITS_DB).then(
        (r) => r.sent + r.dropped > 0 && console.log(`[push] sent ${r.sent}, dropped ${r.dropped}`),
        (err) => console.warn("[push] cron failed:", err)
      )
    );
  },
};

export default worker;
