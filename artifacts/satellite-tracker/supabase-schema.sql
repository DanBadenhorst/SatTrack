-- SatTrack Supabase Schema
-- Run this in your Supabase SQL editor to set up all required tables.
-- Tracking is GROUP-SCOPED: each group has one observing location, and
-- satellites + alerts are tied to a group, not an individual user.

-- Tracked satellites: satellites a group wants pass predictions for
CREATE TABLE IF NOT EXISTS tracked_satellites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  norad_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_id, norad_id)
);

-- Groups: collections of users coordinating around passes.
-- Each group carries its single observing location (set by an admin).
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT NOT NULL UNIQUE,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Group members: which users belong to which groups
CREATE TABLE IF NOT EXISTS group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Alert subscriptions: a user wants email alerts for a satellite from a group
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  satellite_norad_id INTEGER NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  min_elevation INTEGER NOT NULL DEFAULT 10,
  notify_minutes_before INTEGER NOT NULL DEFAULT 15,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, satellite_norad_id, group_id)
);

-- Sent alerts: de-duplication log so we don't send the same alert twice
CREATE TABLE IF NOT EXISTS sent_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES alert_subscriptions(id) ON DELETE CASCADE NOT NULL,
  satellite_norad_id INTEGER NOT NULL,
  pass_start_utc BIGINT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(subscription_id, pass_start_utc)
);

-- Row Level Security policies
ALTER TABLE tracked_satellites ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_alerts ENABLE ROW LEVEL SECURITY;

-- Membership checks run as SECURITY DEFINER so they bypass RLS on group_members.
-- This is REQUIRED: referencing group_members inside a group_members (or groups)
-- policy directly causes "infinite recursion detected in policy" errors.
CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Tracked satellites: any member of the group can see and manage them
CREATE POLICY "tracked_satellites_group" ON tracked_satellites FOR ALL
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

-- Groups: visible to members + creator; anyone can insert (to create); admins/creator can update
CREATE POLICY "groups_select" ON groups FOR SELECT USING (
  created_by = auth.uid() OR public.is_group_member(id)
);
CREATE POLICY "groups_insert" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "groups_update" ON groups FOR UPDATE USING (
  created_by = auth.uid() OR public.is_group_admin(id)
);
CREATE POLICY "groups_delete" ON groups FOR DELETE USING (created_by = auth.uid());

-- Group members: members can see fellow members; anyone can join (insert self); only leave yourself
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  user_id = auth.uid() OR public.is_group_member(group_id)
);
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_delete" ON group_members FOR DELETE USING (auth.uid() = user_id);

-- Alert subscriptions: a user manages their own, but only for groups they belong to
CREATE POLICY "alert_subscriptions_own" ON alert_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id));

-- Sent alerts: service role only (inserted by the alert cron, not directly by users)
CREATE POLICY "sent_alerts_service" ON sent_alerts FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_satellites_group ON tracked_satellites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_group ON alert_subscriptions(group_id);
CREATE INDEX IF NOT EXISTS idx_sent_alerts_sub ON sent_alerts(subscription_id, pass_start_utc);
