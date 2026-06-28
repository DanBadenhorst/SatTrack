---
name: SatTrack Resend send-result handling
description: Resend resolves its promise even when the API rejects an email, so "fulfilled" != delivered
---

Resend's `resend.emails.send()` resolves its promise even when the API rejects
the message — the rejection comes back as a non-null `.error` on the resolved
value, NOT as a thrown error. The most common rejection is the sandbox 403
(`onboarding@resend.dev` only delivers to the Resend account owner until a domain
is verified).

**Rule:** treat a send as successful only when both (a) the promise did not throw
AND (b) the resolved value has no `.error`. Counting all resolved promises as
"sent" silently overcounts and hides delivery failures.

**Why:** "none of the emails work" was reported even though counts showed sends
succeeding, because failed (403'd) sends were counted as sent and swallowed.

**How to apply:**
- `lib/resend.ts` exposes `isSendOk(result)` and `tallySendResults()` for this.
- The alert cron (`app/api/alerts/route.ts`) must insert into `sent_alerts`
  ONLY after `isSendOk` confirms delivery, otherwise a failed send is
  permanently deduped and never retried. Do not revert to marking sent before
  the send.
