# Deploying to Cloudflare Workers (free plan)

MounTour runs on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`).
The free Workers plan allows commercial use (Vercel Hobby does not) and gives 100k requests/day.

## One-time setup (Cloudflare dashboard)

1. **Workers & Pages → Create → Import a repository.** Authorise the Cloudflare GitHub app for
   `Pepuldope/mountour` only, then pick the repo.
2. Build settings:

   | Field | Value |
   |---|---|
   | Project / Worker name | `mountour` (must match `name` in `wrangler.jsonc`) |
   | Production branch | `main` |
   | Build command | `npx opennextjs-cloudflare build` |
   | Deploy command | `npx opennextjs-cloudflare deploy` |
   | Non-production branch deploy command | `npx opennextjs-cloudflare upload` (preview link per branch/PR) |
   | Root directory | `/` |

3. **Variables** (Worker → Settings → Variables and Secrets, and the build's variables):

   | Name | Where | Why |
   |---|---|---|
   | `ORS_API_KEY` | Runtime, as a **Secret** | drive time + route (`/api/drive*`); without it the OSRM demo fallback is used |
   | `NEXT_PUBLIC_SUPABASE_URL` | **Build** variable | inlined at build time; without it the app reads `data/fixtures/trails.json` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Build** variable | same |

   The two Supabase variables go away once trail data ships as static files.

4. The site appears at `https://mountour.<your-subdomain>.workers.dev`. A custom domain is added later
   under Worker → Settings → Domains & Routes.

## Local commands

```bash
npm run cf:build     # build the Worker bundle into .open-next/
npm run cf:preview   # build + run it locally in the Workers runtime (wrangler)
npm run cf:deploy    # build + deploy from your machine (needs `npx wrangler login`)
```

Local runtime secrets go in `.dev.vars` (git-ignored), e.g. `ORS_API_KEY=...`.

## Limits worth knowing

- Free plan: 100k requests/day, 10 ms CPU per request. Static pages and assets are served from the
  edge cache and don't count against CPU. Keep server-rendered pages light; trail pages are meant to
  become static.
- `@opennextjs/cloudflare` requires Next.js ≥ 16.3.8, so `next` is pinned there.
