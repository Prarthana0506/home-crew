-- ============================================================================
-- MIGRATION 20261014000013: Enable Realtime on settings table
-- ============================================================================
-- Allows postgres_changes subscriptions to fire when demo_data_enabled
-- is toggled by admin, so customer and provider apps re-fetch instantly.
-- ============================================================================

BEGIN;

-- Add settings table to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;

COMMIT;
