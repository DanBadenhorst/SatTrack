---
name: SatTrack .next is gitignored
description: The satellite-tracker Next.js build cache is untracked; regenerate it locally
---
The `artifacts/satellite-tracker/.next` build dir is gitignored (it used to be committed, which caused repeated rebase conflicts and stale generated route types failing `tsc --noEmit`).

**Why:** Generated build output is transient; tracking it produced spurious typecheck failures and merge conflicts.
**How to apply:** Never re-add `.next` to git. If a deleted route still fails typecheck via a phantom `.next/types/...` error, `rm -rf .next` and restart the dev workflow to regenerate.
