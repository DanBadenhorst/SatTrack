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

[https://sat-track-satellite-tracker.vercel.app/](https://sat-track-satellite-tracker.vercel.app/)

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
   # Optional:
   # RESEND_FROM_EMAIL=SatTrack <alerts@yourdomain.com>   # after verifying a domain in Resend
   # APP_URL=http://localhost:3000                         # canonical links in emails
   ```

3. **Apply the database schema.** Run the SQL in `artifacts/satellite-tracker/supabase-schema.sql` against your Supabase project (via the Supabase dashboard SQL editor).

4. **Start the dev server** (from the repo root). This command works the same on Windows, macOS, and Linux:

   ```bash
   pnpm --filter @workspace/satellite-tracker run dev:local
   ```

   The app runs at `http://localhost:3000`.

   > `dev:local` uses a fixed port (3000) so no environment variable or shell-specific syntax is needed. To use a different port, edit the `dev:local` script in `artifacts/satellite-tracker/package.json`.

See `artifacts/satellite-tracker/DEPLOYMENT.md` for full production (Vercel) setup.

## Assumptions

- **Anyone can join a group.** There is no request-and-approval workflow to approve users joining groups.
- **A geographic view of where groups are located** is provided to see location at a glance, along with a list of groups that users can join or leave. Joining or leaving a group is possible on the geo-view but doesn't work as smoothly when areas overlap, so the list should be used as a backup function.
- **All users are in South Africa (SAST = UTC+2, no daylight saving).** The daily digest cron runs once a day at 11:00 UTC (= 1pm local), which keeps it on Vercel's free Hobby plan. Supporting other time zones would require an hourly cron (Vercel Pro).
- **Pass predictions for satellite (visual) tracking** look for satellites that are elevated above a certain degree over the horizon, that are in dark enough light conditions, and that are positioned so the sun reflects off the satellite. Cloud coverage is also considered.
- **Pass predictions for satellite radio operators** focus primarily on line of sight and whether the satellite passes over the observer's location.
- **Pass predictions are fetched on demand**, not on page load, to stay within the N2YO API transaction quota. Pass data is cached briefly per location and reused across users observing from the same site.
- **Group chat for coordination is sufficient for now.** It is assumed that a group chat mechanism — which shows the satellites tracked for the group at a glance and allows chat to coordinate group activity — is sufficient for coordination at this time.
- **Alerts are sent via email per user.** Although tracking of satellites for locations is done at the group level, users have the flexibility to configure their own alerts within the confines of the group's monitored satellites.
- **Group chat email notifications are opt-in.** Users can switch on email notifications for chat messages posted by other members of their groups; when enabled, a new group message also notifies subscribed members by email (with a deep link back to the chat).
- **Email delivery requires a verified Resend domain.** Until a domain is verified, Resend's sandbox sender only delivers to the account owner's own email; set `RESEND_FROM_EMAIL` (with a verified domain) to reach external recipients.
- **The Supabase schema is managed manually** — neither Vercel nor the app runs migrations automatically.
- **Secrets live only in environment variables** (Replit / Vercel / Supabase), never in the repository.
- **Vercel's free-tier cron job runs once a day** to send alerts. Any failed alerts will not be resent until the next day the job runs. This can be improved to run hourly with a paid Vercel plan.
- **Refined user management will come in later releases.** Functionality such as 2FA, password change and reset, and user-detail modification and deletion is not required in this delivery.
- **POPIA and security hardening still need to be done.** Although the basics have been implemented, a full review and implementation of findings is still to be done.
- **Code needs refactoring and cleanup.** There was not enough time for this; it is assumed this can be done in a future iteration.
- **The alert configuration functionality needs refinement.** Changing settings currently requires removing and re-creating the alert; implementing in-place change functionality will be done in future.
- **Responsive design has not been verified** for mobile and tablet devices. It may work due to the frameworks used, but this has not been verified and will be done in future releases.
