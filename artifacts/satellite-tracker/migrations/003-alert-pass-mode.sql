-- Adds pass_mode to alert_subscriptions so each alert remembers whether it was
-- set for "visible" passes (naked-eye, via N2YO visualpasses) or "all" passes
-- (day or night, via N2YO radiopasses). Idempotent.

ALTER TABLE alert_subscriptions
  ADD COLUMN IF NOT EXISTS pass_mode TEXT NOT NULL DEFAULT 'visible';

ALTER TABLE alert_subscriptions
  DROP CONSTRAINT IF EXISTS alert_subscriptions_pass_mode_check;

ALTER TABLE alert_subscriptions
  ADD CONSTRAINT alert_subscriptions_pass_mode_check
  CHECK (pass_mode IN ('visible', 'all'));
