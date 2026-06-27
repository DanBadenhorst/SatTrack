---
name: SatTrack .next is git-tracked
description: Stale Next.js generated types can break typecheck after deleting routes
---
The `artifacts/satellite-tracker/.next` build dir is committed to git. After deleting a page/route, `.next/types/app/<route>/page.ts` can linger and fail `tsc --noEmit` with "Cannot find module".

**Why:** Generated route validator types reference source files that no longer exist.
**How to apply:** After removing routes, delete `.next` (rm -rf) and restart the dev workflow to regenerate; don't chase the phantom type error in source.
