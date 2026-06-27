-- Migration 004: group message feed + per-user feed email notifications.
--
-- `group_messages` holds the coordination feed posted by group members.
-- `group_feed_subscriptions` records which members want an email whenever a
-- new message is posted to a group they belong to.
-- Run this once against the live Supabase project.

BEGIN;

-- 1. Message feed
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at DESC);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_messages_select" ON group_messages;
CREATE POLICY "group_messages_select" ON group_messages FOR SELECT
  USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "group_messages_insert" ON group_messages;
CREATE POLICY "group_messages_insert" ON group_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id));

-- 2. Per-user feed email notification preference (one row per user per group)
CREATE TABLE IF NOT EXISTS group_feed_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_feed_subs_group ON group_feed_subscriptions(group_id);

ALTER TABLE group_feed_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_feed_subs_own" ON group_feed_subscriptions;
CREATE POLICY "group_feed_subs_own" ON group_feed_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id));

COMMIT;
