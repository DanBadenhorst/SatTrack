import { NextResponse } from "next/server";

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tracked_satellites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    norad_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, norad_id)
  )`,
  `CREATE TABLE IF NOT EXISTS groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(group_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS alert_subscriptions (
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
  )`,
  `CREATE TABLE IF NOT EXISTS sent_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES alert_subscriptions(id) ON DELETE CASCADE NOT NULL,
    satellite_norad_id INTEGER NOT NULL,
    pass_start_utc BIGINT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(subscription_id, pass_start_utc)
  )`,
  `ALTER TABLE locations ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE tracked_satellites ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE groups ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE group_members ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE sent_alerts ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='locations_own') THEN
      CREATE POLICY "locations_own" ON locations FOR ALL USING (auth.uid() = user_id);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tracked_satellites' AND policyname='tracked_satellites_own') THEN
      CREATE POLICY "tracked_satellites_own" ON tracked_satellites FOR ALL USING (auth.uid() = user_id);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='groups' AND policyname='groups_select') THEN
      CREATE POLICY "groups_select" ON groups FOR SELECT USING (
        id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
      );
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='groups' AND policyname='groups_insert') THEN
      CREATE POLICY "groups_insert" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_members' AND policyname='group_members_select') THEN
      CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
        group_id IN (SELECT group_id FROM group_members gm2 WHERE gm2.user_id = auth.uid())
      );
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_members' AND policyname='group_members_insert') THEN
      CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_subscriptions' AND policyname='alert_subscriptions_own') THEN
      CREATE POLICY "alert_subscriptions_own" ON alert_subscriptions FOR ALL USING (auth.uid() = user_id);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sent_alerts' AND policyname='sent_alerts_service') THEN
      CREATE POLICY "sent_alerts_service" ON sent_alerts FOR ALL USING (auth.uid() IS NOT NULL);
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_satellites_user ON tracked_satellites(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alert_subs_user ON alert_subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sent_alerts_sub ON sent_alerts(subscription_id, pass_start_utc)`,
];

export async function POST() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of SCHEMA_SQL) {
    try {
      // Use Supabase's undocumented sql endpoint via service role
      const res = await fetch(`${url}/rest/v1/`, {
        method: "GET",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      // Actually we'll use the pg-meta endpoint
      const pgRes = await fetch(`${url}/pg/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (pgRes.ok) {
        results.push({ sql: sql.slice(0, 60) + "...", ok: true });
      } else {
        const body = await pgRes.json().catch(() => ({}));
        results.push({ sql: sql.slice(0, 60) + "...", ok: false, error: JSON.stringify(body) });
      }
    } catch (e) {
      results.push({ sql: sql.slice(0, 60) + "...", ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}
