-- ============================================================================
-- MIGRATION 20261014000008: Retire the old `demo_mode` toggle
--
-- Background:
--   Migration 20261014000003 created a first toggle (settings key `demo_mode`,
--   default OFF) with its own RPCs and permissive demo_filter_* policies.
--   Migrations 04/05/06 created the real one (settings key `demo_data_enabled`,
--   helper public.demo_visible(), RESTRICTIVE policies). Two toggles conflict,
--   and the old audit-log insert used columns that do not exist.
--
-- This migration:
--   1. Makes sure the real toggle row exists.
--   2. Rebuilds admin_get_metrics() so it follows the real toggle
--      (it currently depends on the old is_demo_mode_enabled()).
--   3. Drops the old demo_filter_* policies, RPCs and the `demo_mode` row.
--
-- Safe to run whether or not migration 03 was ever applied (IF EXISTS everywhere).
-- Real (is_demo = false) data is never touched.
-- ============================================================================

BEGIN;

-- 1. REAL TOGGLE MUST EXIST ---------------------------------------------------
INSERT INTO public.settings (key, value)
VALUES ('demo_data_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. ADMIN METRICS: FOLLOW THE REAL TOGGLE -------------------------------------
-- Same output keys as before (including demo_mode_enabled) so the admin
-- dashboard keeps working. Counts now use public.demo_visible(is_demo), which
-- hides demo rows when demo_data_enabled = false. Disputes and fee revenue are
-- filtered too (previously they ignored the toggle).
CREATE OR REPLACE FUNCTION public.admin_get_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_on BOOLEAN;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin_get_metrics: permission denied (admin only)';
  END IF;

  v_demo_on := COALESCE(
    (SELECT (s.value ->> 'enabled')::boolean
       FROM public.settings AS s
      WHERE s.key = 'demo_data_enabled'),
    true
  );

  RETURN jsonb_build_object(
    'total_requests',
      (SELECT COUNT(*) FROM public.service_requests
        WHERE public.demo_visible(is_demo)),
    'open_ordinary',
      (SELECT COUNT(*) FROM public.service_requests
        WHERE type = 'ordinary' AND status IN ('open', 'pending')
          AND public.demo_visible(is_demo)),
    'emergency_active',
      (SELECT COUNT(*) FROM public.service_requests
        WHERE type = 'emergency'
          AND status IN ('interest_window', 'bidding_open', 'notified')
          AND public.demo_visible(is_demo)),
    'emergency_awarded',
      (SELECT COUNT(*) FROM public.service_requests
        WHERE type = 'emergency' AND status = 'awarded'
          AND public.demo_visible(is_demo)),
    'emergency_failed',
      (SELECT COUNT(*) FROM public.service_requests
        WHERE type = 'emergency'
          AND status IN ('cancelled', 'expired', 'no_bids')
          AND public.demo_visible(is_demo)),
    'total_providers',
      (SELECT COUNT(*) FROM public.provider_profiles
        WHERE status = 'active' AND public.demo_visible(is_demo)),
    'pending_providers',
      (SELECT COUNT(*) FROM public.provider_profiles
        WHERE status = 'pending' AND public.demo_visible(is_demo)),
    'banned_providers',
      (SELECT COUNT(*) FROM public.provider_profiles
        WHERE bid_banned_until IS NOT NULL AND bid_banned_until > now()
          AND public.demo_visible(is_demo)),
    'total_coins_issued',
      (SELECT COALESCE(SUM(amount), 0) FROM public.coin_ledger
        WHERE amount > 0 AND public.demo_visible(is_demo)),
    'open_disputes',
      (SELECT COUNT(*) FROM public.disputes
        WHERE status = 'open' AND public.demo_visible(is_demo)),
    'emergency_fee_revenue',
      (SELECT COALESCE(SUM(amount), 0) FROM public.emergency_fee_payments
        WHERE status = 'paid' AND public.demo_visible(is_demo)),
    'total_bookings',
      (SELECT COUNT(*) FROM public.bookings
        WHERE status IN ('confirmed', 'in_progress', 'completed')
          AND public.demo_visible(is_demo)),
    'demo_mode_enabled', v_demo_on
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_metrics() TO authenticated;

-- 3. DROP OLD PERMISSIVE POLICIES ----------------------------------------------
-- Removes every demo_filter_* policy created by migration 03 (service_requests,
-- profiles, provider_profiles, bookings, bids, reviews, coin_ledger).
-- The RESTRICTIVE demo_visibility_* policies from migration 05 stay in place.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'demo\_filter\_%' ESCAPE '\'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- 4. DROP OLD RPCs AND HELPER ----------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_get_demo_mode();
DROP FUNCTION IF EXISTS public.admin_set_demo_mode(BOOLEAN);
DROP FUNCTION IF EXISTS public.is_demo_mode_enabled();

-- 5. REMOVE OLD SETTING ROW --------------------------------------------------------
DELETE FROM public.settings WHERE key = 'demo_mode';

COMMIT;