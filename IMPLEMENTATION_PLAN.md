# FightHub — Audit & Implementation Plan

_Audit date: 2026-09-24 · Repo: github.com/caanray786/Fighthub (main)_

---

## 1. What's actually there today

A static HTML/CSS/vanilla-JS site (11 public pages + 10 admin pages), served locally by `start-server.ps1`.

| Area | Current state |
|---|---|
| **Data / "back end"** | `js/datastore.js` saves everything to **IndexedDB in the visitor's own browser**, seeded from `js/data-defaults.js`. There is no server. Supabase support is half-built (see issues). |
| **Fighters** | 27, hard-coded. Mixed legends (Ali, Tyson, Bruce Lee, Karelin…) + a few current names. |
| **Martial arts** | 11 disciplines (MMA, Muay Thai, BJJ, Boxing, Wrestling, Judo, Karate, TKD, Kickboxing, Sambo, Krav Maga), ~1.7k chars each. Only MMA, BJJ and Muay Thai have their own page (~150 words each). No Boxing page. |
| **News** | 6 seed articles (June–July 2026). |
| **Events** | 4 seed events, **all dated July–Aug 2026, so all in the past**. |
| **Rankings** | 6 lists that mix sports and eras (e.g. Welterweight: GSP, Royce Gracie, Pacquiao, champion Crawford). |
| **Gyms** | 8 gyms (file header claims 12). |
| **Training "app"** | `training.html`: round timer, BMI calc, calorie calc, 3 workout categories. |
| **AI** | `content-bot.js` (RSS → OpenRouter rewrite), `autopilot-agent.js` (OpenRouter invents records), `api-sports.js` (API-Sports MMA feed). |
| **Images** | ~20 generic Unsplash stock photos reused everywhere. Hero = 151 PNG frames (~120 MB). |

## 2. Audit findings (by severity)

### 🔴 Blockers
1. **Nothing the admin does reaches visitors.** Admin edits and AI output are written to the admin's own browser storage. Every other visitor only ever sees the hard-coded seed data. A real shared database is required before any "AI updates the site" feature means anything.
2. **Supabase can't be switched on.** The "Save Cloud Credentials" form in `admin/settings.html` has no submit handler, and no database tables or schema exist.
3. **The OpenRouter key has nowhere safe to live.** It is stored in `localStorage` (base64 "encoded", which isn't encryption). If Supabase were enabled, it would go into a `settings` table readable with the public anon key. **The key must live only on a server.**
4. **The AI makes things up.** The autopilot prompt asks the model to invent a "highly realistic" fighter/event/gym and **an image URL**. That produces fictional records and broken or wrong images. The fallback content is also fabricated: fake results such as "Canelo def. Benavidez", fake fights, and fake MMA Fighting/BoxingScene links. It gets published as real news.
5. **`autopilot-agent.js` is dead code.** No page loads it.
6. **`run-pipeline.ps1` does nothing.** It fetches RSS and prints "database updated" but never writes anything.

### 🟠 Major
7. **Fighter images are wrong.** Every fighter uses a random stock photo; Ali, Khabib and Usyk all show the same gym shots.
8. **Gym search is fake.** "Miles away" is computed from the length of the gym's name. "View Map" opens a modal with no map. Opening hours are hard-coded. There is no geolocation.
9. **Pipeline creates duplicates.** Each run re-adds the same events and articles (no upsert or dedupe).
10. **Admin security is cosmetic.** The default password `fighthub2024` is in the source, the "hash" is a 32-bit JS hash, and the auth is client-side only. Anyone can edit their own copy.
11. **XSS risk.** AI/RSS text is injected with `innerHTML` unescaped (gyms, cards, toasts).
12. **Hero animation is ~120 MB** of PNGs preloaded on the home page. It is unusable on mobile data.

### 🟡 Content / polish
13. Thin content: 27 fighters, 11 arts, 6 articles, stale events, rankings that mix sports.
14. The footer newsletter, social links and ticket links are placeholders (`#`).
15. No SEO: no per-fighter URLs, sitemap, meta/OG tags or structured data.
16. No PWA manifest or service worker (needed as a stepping stone to the app).

---

## 3. Key decisions (recommended defaults)

| Decision | Recommendation | Why |
|---|---|---|
| Back end | **Supabase** (Postgres + Auth + Storage + Edge Functions + cron) | Already half-wired in `datastore.js`; the free tier covers launch; it also becomes the mobile app's back end later. |
| Where the AI runs | **Supabase Edge Function** holding `OPENROUTER_API_KEY` as a secret, run on a schedule | The key never touches a browser, and it runs without anyone having the admin page open. |
| AI accuracy | Use a **web-search-grounded model** (OpenRouter `:online` models) that must return **source URLs**. The AI writes **drafts** and an admin approves them before publishing. | Stops fabricated fights and results. Facts are traceable. |
| Fighter photos | **Wikimedia Commons** via the Wikidata/Wikipedia API (free licences), with attribution stored per image, plus a manual upload override. | Real photos of the actual fighters, legally. Google Images or promotion photos without permission = copyright risk. Some fighters have no free photo; they get a clean initials/silhouette card instead of a wrong face. |
| Gym finder | **Google Places API** (best coverage) *or* OpenStreetMap/Overpass (free) + Leaflet map + browser geolocation | Real "nearest clubs" with real distances. |
| Front end | Keep the current HTML/CSS for now, move to **Astro or Next.js** in Phase 3 | Per-fighter pages and SEO need generated routes; the same components can later feed the app. |
| Mobile app | **Capacitor** wrapping the site first (fastest), or **Expo/React Native** for a fully native app. Paywall via **RevenueCat**. | One codebase → Android + iOS. RevenueCat handles store subscriptions, which Apple/Google require for digital features. |

---

## 4. Phased plan

### Phase 0 — Clean-up & safety ✅ done 2026-09-24
- [x] Added `.gitignore`, `README.md`, `.env.example`. *(Git itself isn't installed on this PC yet; needed to push.)*
- [x] Removed fabricated fallback content (fake results, news, links, odds, fighter records) from `api-sports.js`, `rss-parser.js`, `content-bot.js` and the home page. Articles keep a `sourceUrl`; the pipeline upserts, so re-runs don't duplicate.
- [x] Hero: 151 PNGs (119 MB) → 76 JPEGs (5.2 MB), first frame loads first; still image for reduced-motion / data-saver.
- [x] Shared `escapeHtml()` / `safeUrl()` applied across public and admin pages; inline `onclick` handlers built from data replaced with listeners.
- [x] Seed data v2: 17 real, sourced events (Sep–Dec 2026, unknown details left as TBA); per-sport all-time rankings; `sport` field on fighters; unsourced news removed. Existing browsers upgrade automatically without losing admin edits.
- [x] Deleted dead `autopilot-agent.js` and fake `run-pipeline.ps1`.
- [x] Extra: stock photos no longer shown as fighters (initials until a real photo is added); fake gym distances, map and hours replaced with a real OpenStreetMap embed; events calendar uses today's date; admin pipeline tiles show real status.

### Phase 1 — Real back end (in progress)
- [x] Supabase project created (by owner).
- [x] `supabase/migrations/001_schema.sql`: one table per content type (`fighters, articles, events, rankings, gyms, martial_arts, training_plans`). Each record is stored as a JSON `doc`, so AI-added fields need no migration. Admins table + `is_admin()`. *(Tables for `ai_jobs`, `sources`, `media` come with Phase 2/3.)*
- [x] Row Level Security: the public can read everything except `status = 'draft'`; only admins can write.
- [x] Admin login uses **Supabase Auth** (email + password, must be listed in `admins`). The old browser password remains only for local mode.
- [x] `datastore.js` runs in cloud mode when `js/config.js` has the URL and anon key; if the database is unreachable it falls back to the bundled content. Secrets are never written to the database.
- [x] `supabase/seed.sql`: starter content (74 records).
- [x] SQL run on the live project, admin user created, public sign-ups disabled, `js/config.js` connected (2026-09-24). Verified: visitors read all 74 records, and anonymous insert/update/delete are blocked. Owner confirmed admin login and a live edit showing on the site.
- [x] Admin tables: click a row to edit, Edit/Delete pinned right; edits merge into the stored record so fields not on the form are kept.
- [ ] Deploy the site (Netlify / Cloudflare Pages drag-and-drop works without git) with a custom domain.

### Phase 2 — AI engine with OpenRouter (≈1–2 weeks)
- [ ] Edge Function `ai-worker` with the `OPENROUTER_API_KEY` secret (set via `supabase secrets set`, **never committed**). Model is configurable in the admin panel.
- [ ] Job types, each writing **drafts with sources**:
  - `news` — ingest RSS (MMA Fighting, MMA Junkie, BoxingScene, Bad Left Hook, ONE, Muay Thai news), summarise/rewrite in house style, tag fighters and discipline, link to the original.
  - `events` — upcoming cards (API-Sports MMA + boxing schedule sources), **upsert** by external ID, auto-mark completed and write results.
  - `fighter-enrich` — for a given fighter: bio, record, titles, fight history from Wikipedia/Wikidata/BoxRec-style public sources, with citations.
  - `blog` — weekly evergreen posts (technique breakdowns, history pieces, beginner guides).
  - `rankings` — suggest changes after events (admin approves).
  - `gyms` — pull clubs from Places/OSM for a city and write descriptions.
- [ ] Scheduling with `pg_cron`: news every 2 h, events daily, blog weekly.
- [ ] Admin "AI Review Queue" page: approve / edit / reject, see sources, and a cost log per run.
- [ ] Guardrails: JSON-schema validation, dedupe by slug/external ID, a daily spend cap, and no AI-generated image URLs.

### Phase 3 — Content expansion (ongoing, AI-assisted + reviewed)
- [ ] **Fighters → 500+ at launch**, then continuous growth:
  - Boxing history: every lineal/undisputed heavyweight champion, the P4P greats by era (Robinson, Louis, Marciano, Armstrong, Pep, Monzón, Hagler, Hearns, Chávez, Holyfield, Lewis, De La Hoya, the Klitschkos, Canelo, Usyk, Inoue…).
  - MMA: UFC/Pride/Strikeforce/Bellator/ONE/PFL champions past and present, women's divisions.
  - Muay Thai: Lumpinee/Rajadamnern legends (Samart, Dieselnoi, Apidej, Sagat, Namsaknoi) and ONE stars.
  - Kickboxing (K-1, Glory), BJJ/grappling (ADCC, IBJJF), Olympic wrestling, judo, sambo, karate, taekwondo, lethwei, savate, sanda, bare-knuckle (BKFC).
- [ ] **Martial arts → 25+ disciplines**, each with its own page: history, rules/scoring, ranks/belts, key techniques, legendary fighters (linked), major organisations, how to start, gear list, and "find a club near you" for that style.
- [ ] **Real images**: a Wikimedia Commons fetcher that fills `media` rows with licence and author; the UI shows attribution. The admin can upload a replacement (Supabase Storage). Otherwise an initials/silhouette placeholder, never a random stranger.
- [ ] Per-fighter pages (`/fighters/muhammad-ali`) with the full record table, fight timeline and related fighters.
- [ ] Events with full cards, results and countdowns; rankings per sport/organisation.

### Phase 4 — Gym finder done properly (≈3–5 days)
- [ ] "Use my location" (browser geolocation) + postcode/city search (geocoding).
- [ ] Real distances (haversine / PostGIS), Leaflet map with pins, filter by style.
- [ ] Data from Google Places or OSM, enriched by AI; "claim your gym" form for owners.
- [ ] Reviews/ratings (logged-in users) — optional.

### Phase 5 — Design & quality (≈1 week, overlaps)
- [ ] Consistent design system (type scale, colours, cards), a proper logo instead of the 🥋 emoji.
- [ ] Mobile-first pass on every page; Lighthouse ≥ 90 (performance, accessibility, SEO).
- [ ] SEO: meta/OG tags, sitemap, `schema.org/Person` & `SportsEvent` JSON-LD.
- [ ] Real newsletter (Buttondown/Mailchimp/Resend), social links, cookie/privacy pages.
- [ ] Automated smoke tests (Playwright) for key pages and the admin flow.

### Phase 6 — Mobile app, free + premium (after the site is done)
- [ ] Make the site a PWA first (manifest, service worker, offline cache).
- [ ] Wrap it with Capacitor (or build Expo/React Native screens) against the same Supabase back end.
- [ ] **Free**: news, fighters, events, rankings, basic timer, gym finder.
- [ ] **Premium** (subscription via RevenueCat → App Store / Play billing): full training programmes, workout tracking & history, AI coach chat, fight-camp planner, push alerts for favourite fighters' fights, offline content, ad-free.
- [ ] Store prep: developer accounts (Apple $99/yr, Google $25 one-off), privacy policy, data-safety forms, screenshots, review.

---

## 5. What's needed from you
1. **OpenRouter API key**: this goes into Supabase secrets (or a local `.env`), **not** into the code or the chat.
2. A **Supabase** account/project (free), and a hosting choice (Netlify/Vercel/Cloudflare).
3. Optional keys: API-Sports (fight schedules), Google Maps/Places (gym finder).
4. A monthly AI budget cap for OpenRouter (for example $10–30/mo is plenty for the schedule above).
5. The domain name, if you have one.

## 6. Suggested order of work
Phase 0 → Phase 1 → Phase 2 → Phase 3 (runs continuously once the AI is live) → Phase 4 → Phase 5 → Phase 6.
The website is complete at the end of Phase 5; the app starts at Phase 6.
