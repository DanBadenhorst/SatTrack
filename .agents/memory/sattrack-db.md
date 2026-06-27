---
name: SatTrack DB schema management
description: How schema changes reach the live Supabase project for satellite-tracker
---
Schema changes for satellite-tracker must be applied to the live Supabase project manually — either via the Supabase dashboard SQL editor or the Management API (which requires an `sbp_` personal access token, kept OUT of secrets/env, used only for one-off admin runs).

**Why:** There is no reliable in-app DDL path. `SUPABASE_SERVICE_ROLE_KEY` cannot run arbitrary DDL over PostgREST, and the repo's `DATABASE_URL` points at an unrelated Postgres (not Supabase). A former `app/api/setup-db` route tried an undocumented `/pg/query` endpoint and was unreliable + an unauthenticated privileged surface — it was removed.

**How to apply:** Canonical sources are `supabase-schema.sql` (full schema) + `migrations/*.sql` (idempotent, run-once). Hand the migration SQL to the user to run in the Supabase SQL editor, or run it via Management API with a user-supplied PAT.
