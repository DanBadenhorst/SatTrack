# Deploying SatTrack to Vercel

SatTrack runs on **Vercel** (hosting) + **Supabase** (database/auth) and auto-deploys
from the **GitHub** repo on every push.

## One-time setup

### 1. Import the repo into Vercel
1. Go to https://vercel.com and sign up / log in **with GitHub**.
2. **Add New… → Project**, then **Import** the `SatTrack` GitHub repo.
3. **Root Directory:** click **Edit** and select **`artifacts/satellite-tracker`**
   (this is a pnpm monorepo — the app is not at the repo root). This is the single
   most important setting.
4. Framework Preset should auto-detect **Next.js**. Leave build/install commands as default.
5. Add the environment variables below (next section) **before** the first deploy.
6. Click **Deploy**.

After this, every push to GitHub `main` triggers an automatic production deploy.

### 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Required:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wieadxnlvnnrjpvzjlne.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase → Project Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase → Project Settings → API) |
| `N2YO_API_KEY` | (your N2YO key) |
| `RESEND_API_KEY` | (your Resend key) |
| `SESSION_SECRET` | (any long random string) |
| `CRON_SECRET` | (any long random string — Vercel auto-sends it to the cron) |

Recommended / optional:

| Name | Value |
| --- | --- |
| `APP_URL` | Public URL, e.g. `https://sattrack.vercel.app` (canonical links in emails) |
| `RESEND_FROM_EMAIL` | e.g. `SatTrack <alerts@yourdomain.com>` after verifying a domain in Resend |
| `ALERT_CRON_SECRET` | Only if you also hit `/api/alerts` from an external scheduler |

Set each variable for **Production** (and Preview if you want preview deploys to work).

### 3. Point Supabase auth at the Vercel domain
Supabase → **Authentication → URL Configuration**:
- **Site URL:** your Vercel URL (e.g. `https://sattrack.vercel.app`)
- **Redirect URLs:** add `https://sattrack.vercel.app/auth/callback`

Otherwise signup confirmation and the auth callback will fail in production.

## Scheduled alert digests (cron)

`vercel.json` registers a **daily** cron that calls `GET /api/alerts` at **11:00 UTC**.
Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`, which the route verifies.

> **Why 11:00 UTC:** all users are in South Africa (SAST = UTC+2, no daylight
> saving), so 1pm local = 11:00 UTC. The route only sends a subscriber's digest
> once their local clock is at/after 1pm, so this single daily run covers everyone.
>
> **Plan note:** a once-a-day cron runs on Vercel's **Hobby (free)** plan — no Pro
> needed. (Pro is only required if you later add users in other time zones and need
> the cron to run hourly to catch each zone's 1pm.)
>
> **Trade-off:** with one run per day, a transient send failure (e.g. N2YO/Resend
> hiccup) means that subscriber misses that day's digest — there's no later retry
> until tomorrow.

## Notes
- Secrets live in Vercel + Supabase, never in the repo.
- The Supabase database schema is managed manually (see project README); Vercel does
  not run migrations.
