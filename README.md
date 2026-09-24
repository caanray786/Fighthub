# FightHub

Combat sports hub: fighter database, martial arts guides, news, events, rankings, gym finder and training tools.

## Run locally

```powershell
.\start-server.ps1
```

Opens http://localhost:8000. The admin panel is at `/admin/login.html`.

## Deploy

The site is a static site with no build step. Vercel is connected to this repository, so every push to `main` goes live automatically. `.vercelignore` keeps the SQL, notes and scripts off the public site.

## How data works

`js/config.js` decides the mode:

- **Cloud mode** (Supabase URL + anon key set): all visitors share one Supabase database. Admins sign in with a Supabase account listed in `public.admins`.
- **Local mode** (both empty): content lives in the browser's IndexedDB, seeded from `js/data-defaults.js`. Useful for development; the admin password is `fighthub2024`.

### Setting up Supabase

In Dashboard → SQL Editor, run these in order:

1. `supabase/migrations/001_schema.sql`: tables, security rules, admin check.
2. `supabase/seed.sql`: starter content.
3. Create your user (Authentication → Users → Add user, auto-confirm). Then run `supabase/002_make_admin.sql` with your email.
4. Turn off public sign-ups (Authentication → Sign In / Providers → "Allow new users to sign up").
5. Put the Project URL and **anon/publishable** key in `js/config.js`. Never use the `service_role` / secret key there.

Free-tier projects pause after about a week without traffic. While paused, the site shows the bundled starter content.

### Local seed versions

When you change seed content, bump `DEFAULT_DATA_VERSION` in `js/data-defaults.js` and regenerate `supabase/seed.sql`. Local browsers pick up the new defaults on their next visit. Records listed in `REMOVED_SEED_IDS` are deleted, and records the admin created are kept.

## Content rules

- No invented facts. Events, results and news must come from a real source; store it in `sourceUrl`.
- Unknown details stay `TBA` rather than being guessed.
- Fighter photos must be of the actual fighter, with a licence that permits use. Without one, the site shows initials.
- All text rendered with `innerHTML` goes through `escapeHtml()` / `safeUrl()` (defined in `js/datastore.js`).

## Project layout

| Path | What |
|---|---|
| `*.html` | Public pages |
| `admin/` | Admin CRM pages |
| `js/datastore.js` | Data layer + shared helpers |
| `js/data-defaults.js` | Seed data |
| `js/content-bot.js`, `js/rss-parser.js`, `js/api-sports.js` | News/fight-card pipeline |
| `images/hero/` | Home page scroll animation frames |

See `IMPLEMENTATION_PLAN.md` for the roadmap.
