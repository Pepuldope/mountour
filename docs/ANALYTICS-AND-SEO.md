# Search, visitor stats and tester forms: setup

What the code does on its own, and the few things only you can click. Every tool here is free.
Settings that are not secret live in `lib/site.ts` (one line each). Secrets go only into the
Cloudflare dashboard, never into the repo (it is public).

## What is built

| Piece | Where | Needs setup? |
|---|---|---|
| Slovak titles, descriptions, canonical URLs, link previews | `lib/seo.ts`, each `page.tsx` | No |
| `sitemap.xml` (home, every trip, info pages) and `robots.txt` | `app/sitemap.ts`, `app/robots.ts` | No |
| Structured data (WebSite, Organization, TouristAttraction, breadcrumbs) | `components/JsonLd.tsx` | No |
| Brand icons and preview image | `app/icon.svg`, `app/apple-icon.png`, `public/og-image.png` | No |
| Privacy, disclaimer, sources pages + footer | `/sukromie`, `/upozornenie`, `/zdroje` | Optional contact e-mail |
| Umami visitor stats + product events | `components/Analytics.tsx`, `lib/analytics.ts` | **Step 1** |
| "People with 4+ visit days" counter | `app/api/visit`, `supabase/migrations/0006_visit_days.sql` | **Steps 2 and 3** |
| Tester sign-up and post-test feedback pages | `/testeri`, `/spatna-vazba` | **Step 4** |
| Google Search Console | outside the code | **Step 5**, after the domain |

The real address is `SITE_URL` in `lib/site.ts`. When mountour.sk is live, change that one line
to `https://mountour.sk` and add `mountour.sk` to Search Console; all canonical URLs, the sitemap
and link previews follow.

## Why two counters

Umami Cloud's free Hobby plan (100k events/month, 1 website, 6 months of history) gives the
dashboard: visitors, where they came from, which trips they opened, saves, shares and navigation
opens. It has **no API on the free plan**, so a script cannot read its numbers. The proposal KPI
"people who used MounTour on 4+ different days in a month" is therefore counted by our own small
table in Supabase, with the same method Umami uses: a one-way hash of IP + browser with a secret
key that changes every month. Nothing is stored on the visitor's device, so no consent banner.
The count is conservative: someone whose phone changes IP address between days is counted as two
people with fewer days each.

## Events sent to Umami

| Event | When | Data |
|---|---|---|
| `trip_open` | a trip page is opened | `trail` (slug) |
| `trip_saved` | "Uložiť výlet" tapped | `trail` |
| `share` | plan shared with the group (call `track("share", { trail })` from the share button) | `trail` |
| `nav_open` | Google Maps / map-app link tapped | `app`: google or geo |
| `transit_open` | cp.sk link tapped | none |
| `tester_signup_open`, `feedback_open` | form button tapped | none |

Links can also be tracked with no code: add `data-umami-event="nav_open"` to the `<a>`. Never
send coordinates, typed places or anything personal.

---

## Step 1. Umami account (about 10 minutes)

1. Open https://cloud.umami.is/signup and create an account (Hobby plan, free, no card).
2. After logging in you are asked to add a website. If not: left menu **Settings** → **Websites** →
   **Add website**.
   - Name: `MounTour`
   - Domain: `mountour.nemcok-peter123.workers.dev`
   - Click **Save**.
3. In the website list click **Edit** next to MounTour. Copy the **Website ID** (a long code like
   `a1b2c3d4-...`).
4. Send that ID to Claude in the project thread, or put it in `lib/site.ts` yourself:
   on GitHub open `lib/site.ts` → pencil icon (**Edit this file**) → change
   `?? ""` on the `UMAMI_WEBSITE_ID` line to `?? "your-id"` → **Commit changes**.
5. Optional: Settings → Team → add Radoslav, so he sees the dashboard without your login.

After the next deploy, open the site, then Umami → **Websites** → MounTour: your visit shows up
within a minute.

## Step 2. Supabase table for visit days (about 10 minutes)

1. Open https://supabase.com/dashboard and pick the MounTour project. If it says
   **Project paused**, click **Restore project** and wait a minute.
2. Left menu **SQL Editor** → **New query**. Paste the whole content of
   `supabase/migrations/0006_visit_days.sql` and click **Run**. "Success. No rows returned" is right.
3. Left menu **Project Settings** (gear) → **Data API** (or **API**): copy the **Project URL**
   (`https://xxxx.supabase.co`).
4. **Project Settings** → **API Keys**: copy a **secret** key (`sb_secret_...`). If you only see
   "legacy" keys, copy **service_role** instead. Never paste this key into the repo or a chat.

## Step 3. Cloudflare settings (about 5 minutes)

1. https://dash.cloudflare.com → **Workers & Pages** → **mountour** → **Settings** →
   **Variables and Secrets** → **Add**.
2. Add three entries:

   | Type | Variable name | Value |
   |---|---|---|
   | Text | `SUPABASE_URL` | the Project URL from step 2.3 |
   | **Secret** | `SUPABASE_SECRET_KEY` | the secret key from step 2.4 |
   | **Secret** | `VISIT_SALT` | any long random text, e.g. 40 random letters and digits. Write it nowhere else. |

3. Click **Deploy** (or **Save and deploy**).

Do **not** add `NEXT_PUBLIC_SUPABASE_URL` here: that would switch trail data to the old Supabase
tables. The names above are different on purpose.

**The monthly report:** Supabase → **Table Editor** → `monthly_visitors`. One row per month:
`visitors`, `visitors_2plus_days`, `visitors_4plus_days` (the KPI) and `avg_days`. It is always
up to date. On the 2nd of each month a scheduled job copies finished months to
`monthly_visitors_archive` and deletes raw rows older than 14 months.

## Step 4. Google Forms for testers (about 20 minutes, Radoslav can do it)

Create two forms at https://forms.google.com (**Blank form**). In each: **Settings** →
**Responses** → turn **Collect email addresses** off (contact is asked as a question instead).
Then **Send** → link icon → **Shorten URL** → **Copy**, and send both links to Claude (or put them
into `TESTER_FORM_URL` and `FEEDBACK_FORM_URL` in `lib/site.ts`). Responses → green Sheets icon
links answers to a spreadsheet.

**Form 1: "MounTour – chcem testovať"** (sign-up, goal 8 testers before 12 Nov)

1. Meno (krátka odpoveď, povinné)
2. E-mail alebo telefón (krátka odpoveď, povinné)
3. Ako často chodíte na jednodňové výlety? (výber: viac ako raz za mesiac / raz za mesiac / pár razy do roka / zriedka)
4. S kým chodíte najčastejšie? (začiarkavacie: s deťmi / s partnerom / s kamarátmi / sám)
5. Ako sa na výlet dopravujete? (začiarkavacie: auto / vlak alebo autobus / bicykel)
6. Odkiaľ zvyčajne vyrážate? (krátka odpoveď, napr. Bratislava)
7. Môžeme vás pozvať na 20-minútový rozhovor? (áno / nie)
8. Súhlas (začiarkavacie, povinné): „Súhlasím, aby MounTour použil moje meno a kontakt na
   dohodnutie testovania. Údaje sa po skončení projektu zmažú.“

**Form 2: "MounTour – po teste"** (post-test, proposal: rating 1-5)

1. Celkovo, ako sa vám s MounTourom plánovalo? (lineárna škála 1-5, povinné)
2. Čo vám chýbalo alebo čo bolo mätúce? (odsek)
3. Čo sa vám páčilo najviac? (odsek)
4. Koľko rôznych dní ste MounTour za posledný mesiac použili? (výber: 1 / 2-3 / 4 a viac)
5. Ako by ste sa cítili, keby ste MounTour už nemohli používať? (výber: veľmi sklamaný / trochu sklamaný / vôbec)
6. Zaplatili by ste za verziu s offline mapami a reálnymi odchodmi vlakov? Koľko ročne? (výber: nie / do 5 € / 5-10 € / viac ako 10 €)
7. Meno alebo prezývka (krátka odpoveď, nepovinné; aby sme vedeli spojiť odpoveď s testom)

Share `/spatna-vazba` (not the raw Google link) after each test session, so `feedback_open` is
counted.

## Step 5. Google Search Console (after mountour.sk is live)

1. https://search.google.com/search-console → **Add property** → **Domain** → `mountour.sk` →
   **Continue**.
2. Copy the TXT record Google shows. At the DNS provider (Cloudflare, if the domain is moved
   there) → **DNS** → **Add record** → Type `TXT`, Name `@`, Content = the copied text → **Save**.
   Back in Search Console click **Verify**.
3. Left menu **Sitemaps** → enter `sitemap.xml` → **Submit**.
4. **URL inspection** → paste the home page and 2-3 trip links → **Request indexing**.
5. **Settings** → **Users and permissions** → **Add user** → Radoslav, Full.
6. Optional: https://www.bing.com/webmasters → **Import from Google Search Console**.

Before the domain exists you can already test link previews: paste a trip link into Messenger or
WhatsApp, or use https://www.opengraph.xyz, and check structured data at
https://search.google.com/test/rich-results.
