# SatTrack

## Overview

SatTrack is a live satellite pass tracker for amateur radio operators and satellite spotters. It tells you exactly when satellites are overhead, groups your team around the best passes, and emails a daily digest of upcoming passes so nobody misses a window.

Key features:

- **Live pass predictions** — upcoming passes for any tracked satellite from your observing site (azimuth, elevation, timing), plus a live map of the satellite's current position.
- **Group coordination** — create or join a group around one shared observing location; discover nearby groups on a map.
- **Daily pass digest** — one email a day, at 1pm in the subscriber's local time, listing the upcoming passes that matter (filtered by chosen weekdays, look-ahead window, minimum elevation, and pass type).
- **Sky conditions** — each pass shows a cloud-cover hint (clear / partly cloudy / overcast) so you know whether you'll actually see it.

## Design and Tools

- **Framework:** Next.js 15 (App Router, React Server Components, Server Actions)
- **Language:** TypeScript
- **Auth & Database:** Supabase (email/password auth, PostgreSQL, Row Level Security)
- **Email:** Resend
- **Maps:** Leaflet + react-leaflet (dynamically imported, SSR-safe)
- **Styling:** Tailwind CSS v3
- **Monorepo:** pnpm workspace (the app lives in `artifacts/satellite-tracker`)
- **Hosting:** Vercel (auto-deploys from GitHub on every push to `main`)

## Live URL

<!-- Replace with your deployed Vercel URL -->
[https://sattrack.vercel.app](https://sat-track-satellite-tracker.vercel.app/)

## Test Account

Use the following credentials to sign in and explore the app:

<!-- Fill in a working demo account before sharing -->
- **Email:** `dan.badenhorst@dhc-sa.com`
- **Password:** `Included in submission email to Andrea for security`

> Or click **Get started free** on the landing page to create your own account.

## APIs Used

- **[N2YO](https://www.n2yo.com/api/)** — satellite pass predictions and live position (requires `N2YO_API_KEY`).
- **[Supabase](https://supabase.com/)** — authentication, PostgreSQL database, and Row Level Security.
- **[Resend](https://resend.com/)** — transactional email for alert digests and group messages.
- **[Open-Meteo](https://open-meteo.com/)** — hourly cloud-cover forecasts for the sky-visibility hint (free, no key required).
- **[Nominatim / OpenStreetMap](https://nominatim.org/)** — address-to-coordinates geocoding for observing sites (free, no key required).

## Running Locally

This is a pnpm monorepo; the app lives in `artifacts/satellite-tracker`.

**Prerequisites:** Node.js 18.18+ and [pnpm](https://pnpm.io/) (`npm install -g pnpm`).

1. **Install dependencies** (from the repo root):

   ```bash
   pnpm install
   ```

2. **Configure environment variables.** Create `artifacts/satellite-tracker/.env.local` with:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase → Project Settings → API>
   SUPABASE_SERVICE_ROLE_KEY=<from Supabase → Project Settings → API>
   N2YO_API_KEY=<your N2YO key>
   RESEND_API_KEY=<your Resend key>
   SESSION_SECRET=<any long random string>
   # Optional:
   # RESEND_FROM_EMAIL=SatTrack <alerts@yourdomain.com>   # after verifying a domain in Resend
   # APP_URL=http://localhost:3000                         # canonical links in emails
   ```

3. **Apply the database schema.** Run the SQL in `artifacts/satellite-tracker/supabase-schema.sql` against your Supabase project (via the Supabase dashboard SQL editor).

4. **Start the dev server.** The `dev` script reads the port from the `PORT` environment variable, so provide one on the command line (from the repo root):

   ```bash
   PORT=3000 pnpm --filter @workspace/satellite-tracker run dev
   ```

   The app runs at `http://localhost:3000`.

   > On Windows (PowerShell): `$env:PORT=3000; pnpm --filter @workspace/satellite-tracker run dev`

See `artifacts/satellite-tracker/DEPLOYMENT.md` for full production (Vercel) setup.

## Assumptions

- **All users are in South Africa (SAST = UTC+2, no daylight saving).** The daily digest cron runs once a day at 11:00 UTC (= 1pm local), which keeps it on Vercel's free Hobby plan. Supporting other time zones would require an hourly cron (Vercel Pro).
- **Pass predictions are fetched on demand**, not on page load, to stay within the N2YO API transaction quota. Pass data is cached briefly per location and reused across users observing from the same site.
- **Email delivery requires a verified Resend domain.** Until a domain is verified, Resend's sandbox sender only delivers to the account owner's own email; set `RESEND_FROM_EMAIL` (with a verified domain) to reach external recipients.
- **Group chat email notifications are opt-in.** Users can switch on email notifications for chat messages posted by other members of their groups; when enabled, a new group message also notifies subscribed members by email (with a deep link back to the chat).
- **The Supabase schema is managed manually** — neither Vercel nor the app runs migrations automatically.
- **Secrets live only in environment variables** (Replit / Vercel / Supabase), never in the repository.
