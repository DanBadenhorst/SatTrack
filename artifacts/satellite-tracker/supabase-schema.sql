-- SatTrack Supabase Schema
-- Run this in your Supabase SQL editor to set up all required tables

-- Locations: where users observe from (their QTH)
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tracked satellites: satellites a user wants pass predictions for
CREATE TABLE IF NOT EXISTS tracked_satellites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  norad_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, norad_id)
);

-- Groups: collections of users coordinating around passes
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT NOT NULL UNIQUE,
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

-- Alert subscriptions: a user wants email alerts for a satellite from a location
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  satellite_norad_id INTEGER NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  min_elevation INTEGER NOT NULL DEFAULT 10,
  notify_minutes_before INTEGER NOT NULL DEFAULT 15,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, satellite_norad_id, location_id)
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
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_satellites ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_alerts ENABLE ROW LEVEL SECURITY;

-- Locations: users can only see and manage their own
CREATE POLICY "locations_own" ON locations FOR ALL USING (auth.uid() = user_id);

-- Tracked satellites: users can only see and manage their own
CREATE POLICY "tracked_satellites_own" ON tracked_satellites FOR ALL USING (auth.uid() = user_id);

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

-- Alert subscriptions: own only
CREATE POLICY "alert_subscriptions_own" ON alert_subscriptions FOR ALL USING (auth.uid() = user_id);

-- Sent alerts: service role only (inserted by the alert cron, not directly by users)
CREATE POLICY "sent_alerts_service" ON sent_alerts FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_satellites_user ON tracked_satellites(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_alerts_sub ON sent_alerts(subscription_id, pass_start_utc);
