# SatTrack

Live satellite pass tracker for amateur radio operators and satellite spotters. SatTrack tells you exactly when satellites are overhead, groups your team around the best passes, and sends email alerts before the window opens.

## Run & Operate

- `pnpm --filter @workspace/satellite-tracker run dev` — start Next.js dev server (port 23059)
- `pnpm --filter @workspace/api-server run dev` — start API server (port 8080, unused by satellite-tracker; repathed to `/_api-server` so it no longer hijacks the Next.js `/api/*` routes)

## Stack

- **Framework:** Next.js 15 (App Router, RSC, Server Actions)
- **Auth + DB:** Supabase (email/password auth, PostgreSQL, RLS)
- **Satellite data:** N2YO API (pass predictions, live position)
- **Email alerts:** Resend
- **Maps:** Leaflet + react-leaflet (dynamic import, SSR-safe)
- **Styling:** Tailwind CSS v3
- **Deployment target:** Vercel

## Where things live

```
artifacts/satellite-tracker/
├── app/
│   ├── page.tsx              # Public landing page
│   ├── auth/login/           # Sign-in / sign-up
│   ├── auth/callback/        # Supabase OAuth callback
│   ├── dashboard/            # Authenticated home (stats + checklist)
│   ├── locations/            # Manage observing sites (QTH)
│   ├── satellites/           # Manage tracked satellites
│   ├── passes/               # Pass predictions + live map
│   ├── groups/               # Group coordination
│   └── api/
│       ├── locations/        # CRUD for locations
│       ├── satellites/       # CRUD for tracked satellites
│       ├── passes/           # N2YO pass predictions
│       ├── satellite-position/ # Live position polling
│       ├── geocode/          # Address → lat/lon
│       ├── alerts/           # Alert pipeline (cron endpoint)
│       ├── alerts/subscriptions/ # CRUD for alert subscriptions
│       └── groups/messages/  # Group feed: post message + email subscribed members
├── lib/
│   ├── supabase/             # server.ts, client.ts, middleware.ts
│   ├── n2yo.ts               # N2YO API wrapper
│   ├── resend.ts             # Email alert sender
│   ├── geocoding.ts          # Nominatim geocoder
│   └── types.ts              # Shared TypeScript types
├── components/
│   ├── Navbar.tsx
│   └── PassMap.tsx           # Leaflet map (dynamic import)
└── supabase-schema.sql       # DB schema reference (already applied)
```

## Database schema (Supabase)

Tables: `locations`, `tracked_satellites`, `groups`, `group_members`, `alert_subscriptions`, `sent_alerts`, `group_messages`, `group_feed_subscriptions` — all with RLS enabled. Schema is already applied to the live Supabase project.

**Pending migration:** `supabase-migration-alert-days.sql` adds `days_of_week SMALLINT[]` (JS getDay indices, empty = every day) and `timezone TEXT` to `alert_subscriptions` for per-weekday alert filtering. Run it once in the Supabase SQL editor — until then, creating an alert will error (the Set Alert modal surfaces the failure).

## Architecture decisions

- **Next.js App Router only** — no Vite, no separate React SPA. All pages are RSC by default; client components are colocated as `*Client.tsx`.
- **Supabase URL fix** — `NEXT_PUBLIC_SUPABASE_URL` secret has `/rest/v1/` appended; runtime code strips it with `.replace(/\/rest\/v1\/?$/, "")` in all three Supabase client files.
- **PassMap is dynamically imported** — Leaflet requires the DOM, so it's loaded client-side only via `next/dynamic`.
- **Alert pipeline** — `POST /api/alerts` is a cron-safe endpoint. It fetches active subscriptions, checks N2YO for imminent passes, deduplicates via `sent_alerts`, and sends via Resend. Protect it with `ALERT_CRON_SECRET` env var in production.
- **N2YO rate limiting** — each pass prediction call counts against the N2YO API transaction quota. The passes page only fetches on user demand (not on mount).

## Product

- **Locations** — add and manage observing sites by address search or GPS; one can be marked default
- **Satellites** — track satellites by NORAD ID with quick-add for popular ones (ISS, ISS Ham, NOAA series, Hubble, weather sats)
- **Passes** — get pass predictions for any tracked satellite from any saved location; filter by horizon elevation and look-ahead days; live Leaflet map shows real-time satellite position
- **Groups** — create groups (each with one observing location); discover and join any group directly from a Leaflet map (groups shown as dots with a 100 km coverage ring) or the list below it; leave anytime. (Future: request-to-join with admin approval.) Invite codes are still generated but no longer required to join.
- **Alerts** — clicking "Set alert" on a satellite opens a confirm modal (pre-filled from the page's min-elevation/pass-type filters) where you adjust min elevation, pass type, notify-before lead time, and which weekdays the alert may fire on (Mon–Sun); confirming writes the subscription. Alerts fire within the chosen window before the pass starts, and only on the selected weekdays (evaluated in the subscriber's local time zone, stored at creation time).

## User preferences

_Populate as you build._

## Gotchas

- **Auth must be server-side.** Sign-in/sign-up go through `/api/auth/login` and `/api/auth/signup` route handlers, which set the Supabase session via `Set-Cookie` headers. The browser Supabase client's `document.cookie` writes do NOT persist through the Replit proxy/iframe, so client-side `signInWithPassword` silently fails to create a usable session.
- **`/api` routing conflict.** The `api-server` artifact used to claim `/api`, hijacking all of satellite-tracker's Next.js `/api/*` routes (they 404'd from the Express server). It's been repathed to `/_api-server`. Never let another artifact claim `/api` while satellite-tracker is at `/`.
- `NEXT_PUBLIC_SUPABASE_URL` secret includes `/rest/v1/` — the app strips this at runtime. Best to update the secret to just `https://wieadxnlvnnrjpvzjlne.supabase.co`.
- Do not call `pnpm run dev` at the workspace root — run via the workflow or `pnpm --filter`.
- Leaflet CSS must be imported in `globals.css`, not in the component, to avoid SSR flash.
- Supabase Management API requires a PAT (personal access token), not the service role key — keep the PAT out of secrets/env, use it only for one-off admin scripts.
- **Resend only delivers to the account owner until a domain is verified.** The app sends from the shared sandbox sender `onboarding@resend.dev`, which Resend restricts to your own Resend account email — every other recipient is rejected with a 403 `validation_error`. To send alerts/messages to real users: verify a domain at resend.com/domains, then set the `RESEND_FROM_EMAIL` env var (e.g. `SatTrack <alerts@yourdomain.com>`). No code change needed — `lib/resend.ts` reads `RESEND_FROM_EMAIL` with the sandbox sender as fallback. Send failures are now logged (`[resend] …`) instead of silently swallowed.
