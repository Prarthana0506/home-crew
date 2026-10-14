-- ============================================================================
-- MIGRATION: Admin-controlled Demo Mode Toggle
-- Adds settings row and RPCs for toggling demo data visibility.
-- OFF hides all is_demo=true records via RLS policies without deleting them.
-- ON restores visibility. Real data is never affected.
-- ============================================================================

-- 1. Ensure demo_mode setting exists in settings table
INSERT INTO public.settings (key, value, description, updated_at)
VALUES ('demo_mode', '{"enabled": false}', 'Admin-controlled demo data visibility toggle', now())
ON CONFLICT (key) DO NOTHING;

-- 2. RPC: admin_get_demo_mode
CREATE OR REPLACE FUNCTION public.admin_get_demo_mode()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.settings%ROWTYPE;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'admin_get_demo_mode: permission denied (admin only)';
  END IF;

  SELECT * INTO v_row FROM public.settings WHERE key = 'demo_mode';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;
  RETURN v_row.value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_demo_mode() TO authenticated;

-- 3. RPC: admin_set_demo_mode
CREATE OR REPLACE FUNCTION public.admin_set_demo_mode(p_enabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_value JSONB;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'admin_set_demo_mode: permission denied (admin only)';
  END IF;

  SELECT value INTO v_old_value FROM public.settings WHERE key = 'demo_mode';

  INSERT INTO public.settings (key, value, description, updated_by, updated_at)
  VALUES ('demo_mode',
    jsonb_build_object('enabled', p_enabled),
    'Admin-controlled demo data visibility toggle',
    auth.uid(),
    now()
  )
  ON CONFLICT (key) DO UPDATE
    SET value      = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

  -- Audit trail
  INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
  VALUES ('settings', gen_random_uuid()::text, 'UPDATE', auth.uid(),
    jsonb_build_object('key', 'demo_mode', 'old', v_old_value, 'new', p_enabled));

  RETURN jsonb_build_object('success', TRUE, 'enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_demo_mode(BOOLEAN) TO authenticated;

-- 4. Helper function: is_demo_mode_enabled() for use in RLS policies
-- Returns true if demo mode is ON (readable by any authenticated user,
-- since RLS policies need to call this without auth.uid() restriction)
CREATE OR REPLACE FUNCTION public.is_demo_mode_enabled()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean FROM public.settings WHERE key = 'demo_mode'),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_mode_enabled() TO authenticated, anon;

-- 5. Update RLS policies on key tables to hide is_demo rows when demo mode is OFF.
-- Strategy: allow SELECT only if (is_demo = false) OR (is_demo = true AND demo_mode_enabled).
-- We add a DROP + RECREATE approach for each table's existing SELECT policies.

-- ── service_requests ──────────────────────────────────────────────────────────
-- Admin sees all, including demo rows, always
DROP POLICY IF EXISTS demo_filter_service_requests ON public.service_requests;
CREATE POLICY demo_filter_service_requests ON public.service_requests
  FOR SELECT TO authenticated
  USING (
    -- Admin always sees everything
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Non-demo row: always visible
    is_demo = false
    OR
    -- Demo row: only visible when demo mode is ON
    (is_demo = true AND public.is_demo_mode_enabled() = true)
  );

-- ── profiles (demo users hidden when OFF) ─────────────────────────────────────
DROP POLICY IF EXISTS demo_filter_profiles ON public.profiles;
CREATE POLICY demo_filter_profiles ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles p2 WHERE p2.id = auth.uid()) = 'admin'
    OR
    id = auth.uid()           -- always see your own profile
    OR
    is_demo = false
    OR
    (is_demo = true AND public.is_demo_mode_enabled() = true)
  );

-- ── provider_profiles ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS demo_filter_provider_profiles ON public.provider_profiles;
CREATE POLICY demo_filter_provider_profiles ON public.provider_profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    user_id = auth.uid()
    OR
    is_demo = false
    OR
    (is_demo = true AND public.is_demo_mode_enabled() = true)
  );

-- ── bookings ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS demo_filter_bookings ON public.bookings;
CREATE POLICY demo_filter_bookings ON public.bookings
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    is_demo = false
    OR
    (is_demo = true AND public.is_demo_mode_enabled() = true)
  );

-- ── bids ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS demo_filter_bids ON public.bids;
CREATE POLICY demo_filter_bids ON public.bids
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    is_demo = false
    OR
    (is_demo = true AND public.is_demo_mode_enabled() = true)
  );

-- ── reviews ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS demo_filter_reviews ON public.reviews;
CREATE POLICY demo_filter_reviews ON public.reviews
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    is_demo = false
    OR
    (is_demo = true AND public.is_demo_mode_enabled() = true)
  );

-- ── coin_ledger ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS demo_filter_coin_ledger ON public.coin_ledger;
CREATE POLICY demo_filter_coin_ledger ON public.coin_ledger
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    is_demo = false
    OR
    (is_demo = true AND public.is_demo_mode_enabled() = true)
  );

-- ── admin_get_metrics: update to respect demo mode ────────────────────────────
-- Recreate with demo-aware counts (admin always sees total + demo-separated)
CREATE OR REPLACE FUNCTION public.admin_get_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_on BOOLEAN;
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'admin_get_metrics: permission denied (admin only)';
  END IF;

  v_demo_on := public.is_demo_mode_enabled();

  RETURN jsonb_build_object(
    'total_requests',
      (SELECT COUNT(*) FROM public.service_requests
       WHERE (is_demo = false OR (is_demo = true AND v_demo_on))),
    'open_ordinary',
      (SELECT COUNT(*) FROM public.service_requests
       WHERE type = 'ordinary' AND status IN ('open', 'pending')
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'emergency_active',
      (SELECT COUNT(*) FROM public.service_requests
       WHERE type = 'emergency' AND status IN ('interest_window','bidding_open','notified')
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'emergency_awarded',
      (SELECT COUNT(*) FROM public.service_requests
       WHERE type = 'emergency' AND status = 'awarded'
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'emergency_failed',
      (SELECT COUNT(*) FROM public.service_requests
       WHERE type = 'emergency' AND status IN ('cancelled','expired','no_bids')
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'total_providers',
      (SELECT COUNT(*) FROM public.provider_profiles
       WHERE status = 'active'
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'pending_providers',
      (SELECT COUNT(*) FROM public.provider_profiles
       WHERE status = 'pending'
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'banned_providers',
      (SELECT COUNT(*) FROM public.provider_profiles
       WHERE bid_banned_until IS NOT NULL AND bid_banned_until > now()
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'total_coins_issued',
      (SELECT COALESCE(SUM(amount),0) FROM public.coin_ledger
       WHERE amount > 0
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'open_disputes',
      (SELECT COUNT(*) FROM public.disputes
       WHERE status = 'open'),
    'emergency_fee_revenue',
      (SELECT COALESCE(SUM(amount),0) FROM public.emergency_fee_payments
       WHERE status = 'paid'),
    'total_bookings',
      (SELECT COUNT(*) FROM public.bookings
       WHERE status IN ('confirmed','in_progress','completed')
         AND (is_demo = false OR (is_demo = true AND v_demo_on))),
    'demo_mode_enabled', v_demo_on
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_metrics() TO authenticated;
