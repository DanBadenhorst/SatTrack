import type { NextRequest } from "next/server";

// Resolves the app's PUBLIC origin (scheme + host, no trailing slash) for use in
// outbound emails and redirects. `request.nextUrl.origin` can't be trusted here:
// behind the Replit / Vercel reverse proxy the Next.js server sees the internal
// `localhost:PORT`, so links built from it point at localhost. We derive the
// real host instead, in priority order:
//
//   1. APP_URL / NEXT_PUBLIC_APP_URL — explicit override (custom domains, or any
//      deployment behind extra proxies). Set this to be 100% certain.
//   2. x-forwarded-host (+ x-forwarded-proto) — the host the user actually hit,
//      set by both the Replit and Vercel proxies.
//   3. REPLIT_DOMAINS / REPLIT_DEV_DOMAIN — Replit dev + deployment.
//   4. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL — Vercel.
//   5. request.nextUrl.origin — last resort (may be localhost behind a proxy).
export function getAppOrigin(request: NextRequest): string {
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const fwdHost = request.headers.get("x-forwarded-host");
  if (fwdHost) {
    const host = fwdHost.split(",")[0].trim();
    const proto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
    if (host) return `${proto}://${host}`;
  }

  const replitDomain =
    process.env.REPLIT_DOMAINS?.split(",")[0].trim() || process.env.REPLIT_DEV_DOMAIN;
  if (replitDomain) return `https://${replitDomain}`;

  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelDomain) return `https://${vercelDomain}`;

  return request.nextUrl.origin;
}
