-- Migration: add per-weekday alert filtering to alert_subscriptions.
-- Run this once in the Supabase SQL editor against the live database.
--
-- days_of_week: weekdays the alert may fire on, as JS getDay() indices
--   (0=Sun, 1=Mon, … 6=Sat). Empty array = every day (backward compatible
--   with existing rows).
-- timezone: the observer's IANA time zone (e.g. 'Africa/Johannesburg'),
--   captured from the browser when the alert is created, so the weekday is
--   evaluated in the user's local time rather than UTC.

ALTER TABLE alert_subscriptions
  ADD COLUMN IF NOT EXISTS days_of_week SMALLINT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone TEXT;
