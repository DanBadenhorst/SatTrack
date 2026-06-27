-- Migration 002: pivot from per-user tracking to GROUP-scoped tracking.
--
-- Each group now owns a single observing location. Satellites and alert
-- subscriptions are tied to a group instead of an individual user, and the
-- standalone `locations` table is removed.
--
-- NOTE: existing per-user tracked_satellites and alert_subscriptions rows do
-- not map cleanly onto groups, so they are cleared as part of the pivot.
-- Run this once against the live Supabase project.

BEGIN;

-- 1. Add the observing location to groups
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS altitude INTEGER DEFAULT 0;

-- 2. Re-scope tracked_satellites from user_id -> group_id
DROP POLICY IF EXISTS "tracked_satellites_own" ON tracked_satellites;
TRUNCATE tracked_satellites CASCADE;
ALTER TABLE tracked_satellites DROP CONSTRAINT IF EXISTS tracked_satellites_user_id_norad_id_key;
ALTER TABLE tracked_satellites DROP COLUMN IF EXISTS user_id;
ALTER TABLE tracked_satellites
  ADD COLUMN IF NOT EXISTS group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE tracked_satellites DROP CONSTRAINT IF EXISTS tracked_satellites_group_id_norad_id_key;
ALTER TABLE tracked_satellites ADD CONSTRAINT tracked_satellites_group_id_norad_id_key UNIQUE (group_id, norad_id);
DROP INDEX IF EXISTS idx_satellites_user;
CREATE INDEX IF NOT EXISTS idx_satellites_group ON tracked_satellites(group_id);
CREATE POLICY "tracked_satellites_group" ON tracked_satellites FOR ALL
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

-- 3. Re-scope alert_subscriptions from location_id -> group_id (group_id NOT NULL, CASCADE)
DROP POLICY IF EXISTS "alert_subscriptions_own" ON alert_subscriptions;
TRUNCATE alert_subscriptions CASCADE; -- also clears sent_alerts via FK cascade
ALTER TABLE alert_subscriptions DROP CONSTRAINT IF EXISTS alert_subscriptions_user_id_satellite_norad_id_location_id_key;
ALTER TABLE alert_subscriptions DROP COLUMN IF EXISTS location_id;
ALTER TABLE alert_subscriptions DROP CONSTRAINT IF EXISTS alert_subscriptions_group_id_fkey;
ALTER TABLE alert_subscriptions ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE alert_subscriptions
  ADD CONSTRAINT alert_subscriptions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE alert_subscriptions DROP CONSTRAINT IF EXISTS alert_subscriptions_user_id_satellite_norad_id_group_id_key;
ALTER TABLE alert_subscriptions
  ADD CONSTRAINT alert_subscriptions_user_id_satellite_norad_id_group_id_key UNIQUE (user_id, satellite_norad_id, group_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_group ON alert_subscriptions(group_id);
CREATE POLICY "alert_subscriptions_own" ON alert_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id));

-- 4. Drop the standalone locations table
DROP TABLE IF EXISTS locations CASCADE;

COMMIT;
