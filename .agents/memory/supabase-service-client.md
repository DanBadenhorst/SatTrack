---
name: Supabase service-role client inherits caller session
description: Why a cookie-wired service-role client can still be blocked by RLS in authenticated requests
---

In `lib/supabase/server.ts`, a service-role client built with `createServerClient(url, SERVICE_ROLE_KEY, { cookies })` will read the caller's auth cookie and execute as that **user**, so RLS still applies. It only behaves as true service-role when there is no session cookie (e.g. a cron endpoint hit with a bearer secret).

**Why:** A route that fans out to other users (e.g. notifying group members on a new post) needs to read rows it doesn't own. With the cookie-wired client, `auth.uid()`-based RLS returns zero rows → the fan-out silently sends nothing.

**How to apply:** For server-side fan-out inside an authenticated request, use a **cookieless** service client (`cookies.getAll() => []`, `setAll` no-op) so the service-role key is used unconditionally. Reserve the cookie-wired admin client for unauthenticated contexts (cron) where inheriting "no session" is fine.
