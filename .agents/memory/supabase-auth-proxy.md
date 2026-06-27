---
name: Supabase auth in the Replit proxied preview
description: Why client-side Supabase sign-in fails to persist a session in the Replit preview, and the server-side fix.
---

# Symptom
`supabase.auth.signInWithPassword` from the browser client appears to succeed (no error), but navigating to a protected route bounces back to login — the server never sees the session.

# Cause
The browser Supabase client writes the session via `document.cookie`. In the Replit proxied/iframe preview those cookies don't reliably reach the server on the subsequent navigation, so server-side `getUser()` returns null and middleware/page guards redirect to login.

# Fix
Handle auth in Next.js server-side route handlers (`/api/auth/login`, `/api/auth/signup`) using `createServerClient` from `@supabase/ssr` wired to `next/headers` `cookies()`. The session is then written via `Set-Cookie` HTTP response headers, which persist correctly. The login page POSTs credentials via `fetch` and then hard-navigates (`window.location.href`) so middleware sees the cookie.

**Why:** Set-Cookie headers from the server are honored by the proxy/browser where client `document.cookie` writes were being dropped.

**How to apply:** For any Supabase (or cookie-session) auth in a server-rendered app behind the Replit proxy, set the session cookie server-side, not from the browser SDK.
