-- Migration: add per-alert look-ahead window to alert_subscriptions.
--
-- look_ahead_days: how many days ahead each digest (the immediate confirmation
-- email and the daily 13:00 digest) lists the satellite's upcoming passes.
-- Range 1–10; defaults to 1 (next 24h) for any existing rows.
--
-- Idempotent: safe to run multiple times.

ALTER TABLE alert_subscriptions
  ADD COLUMN IF NOT EXISTS look_ahead_days SMALLINT NOT NULL DEFAULT 1;
