---
name: satellite.js version for SatTrack
description: Which satellite.js major version works in the Next.js client bundle and why.
---
# satellite.js must be v5 in the Next.js client bundle

Use `satellite.js@^5` for any browser-side SGP4 propagation in the satellite-tracker app.

**Why:** v7 (and the v7 wasm runtime) `import`s from `node:module` to load its WASM build. Next.js/webpack cannot bundle the `node:` scheme for the client, so any client component importing v7 fails the build with `UnhandledSchemeError: Reading from "node:module"`. v5 is pure JS with no `node:` imports and bundles its own TypeScript types (`declare module 'satellite.js'`), so `@types/satellite.js` is unnecessary (and is not in the Replit registry anyway).

**How to apply:** In v5, `propagate(satrec, date).position` is typed `EciVec3 | boolean` — guard with `typeof position === "boolean"` before reading `.x/.y/.z`. Globe widget computes positions client-side each frame from hourly-cached TLEs (`/api/satellite-tle`), never the rate-limited `/positions/` endpoint.
