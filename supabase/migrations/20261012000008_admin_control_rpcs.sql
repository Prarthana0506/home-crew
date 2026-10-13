-- ============================================================================
-- Migration 8: Admin Control Panel RPCs + Provider Management
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. admin_start_bidding: Force-open bidding on any emergency request
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_start_bidding(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req service_requests%ROWTYPE;
    v_bidding_window_minutes INTEGER;
    v_closes_at TIMESTAMPTZ;
    v_cutoff TIMESTAMPTZ;
BEGIN
    -- Admin-only guard
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_start_bidding: permission denied (admin only)';
    END IF;

    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found: %', p_request_id;
    END IF;

    IF v_req.status = 'bidding_open' THEN
        RETURN jsonb_build_object('success', TRUE, 'status', 'bidding_open', 'message', 'already_open');
    END IF;

    -- Bidding must close at least 1 hour before job start
    v_cutoff := v_req.preferred_start - INTERVAL '1 hour';
    IF v_cutoff <= now() THEN
        RAISE EXCEPTION 'Cannot start bidding: preferred_start is less than 1 hour away';
    END IF;

    SELECT COALESCE((value->'bidding_window_minutes')::INTEGER, 60)
    INTO v_bidding_window_minutes
    FROM public.settings WHERE key = 'bidding_window_minutes';

    v_closes_at := LEAST(
        now() + (v_bidding_window_minutes || ' minutes')::INTERVAL,
        v_cutoff
    );

    UPDATE public.service_requests SET
        status            = 'bidding_open',
        bidding_opened_at = now(),
        bidding_closes_at = v_closes_at,
        updated_at        = now()
    WHERE id = p_request_id;

    -- Insert audit log entry
    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('service_requests', p_request_id, 'admin_start_bidding', auth.uid(),
        jsonb_build_object('previous_status', v_req.status, 'new_status', 'bidding_open', 'closes_at', v_closes_at));

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'bidding_open',
        'closes_at', v_closes_at
    );
END;
$$;

-- -----------------------------------------------------------------------
-- 2. admin_cancel_bidding: Cancel an active emergency with a reason
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cancel_bidding(
    p_request_id UUID,
    p_reason TEXT DEFAULT 'Admin cancellation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req service_requests%ROWTYPE;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_cancel_bidding: permission denied (admin only)';
    END IF;

    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found: %', p_request_id;
    END IF;

    -- Cancel all active bids (release soft-locks)
    UPDATE public.bids SET status = 'cancelled', updated_at = now()
    WHERE request_id = p_request_id AND status = 'active';

    -- Cancel the request
    UPDATE public.service_requests SET
        status     = 'cancelled',
        updated_at = now()
    WHERE id = p_request_id;

    -- Audit
    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('service_requests', p_request_id, 'admin_cancel_bidding', auth.uid(),
        jsonb_build_object('previous_status', v_req.status, 'reason', p_reason));

    RETURN jsonb_build_object('success', TRUE, 'status', 'cancelled', 'reason', p_reason);
END;
$$;

-- -----------------------------------------------------------------------
-- 3. admin_approve_provider: Approve a pending provider application
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_provider(
    p_provider_profile_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prof provider_profiles%ROWTYPE;
    v_user_id UUID;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_approve_provider: permission denied';
    END IF;

    SELECT * INTO v_prof FROM public.provider_profiles WHERE id = p_provider_profile_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider profile not found: %', p_provider_profile_id;
    END IF;

    IF v_prof.status NOT IN ('pending', 'rejected') THEN
        RAISE EXCEPTION 'Cannot approve provider in status: %', v_prof.status;
    END IF;

    v_user_id := v_prof.user_id;

    UPDATE public.provider_profiles SET
        status     = 'active',
        updated_at = now()
    WHERE id = p_provider_profile_id;

    -- Grant 35 onboarding coins so the provider can participate in bidding immediately
    INSERT INTO public.coin_ledger (provider_profile_id, amount, reason)
    VALUES (p_provider_profile_id, 35, 'onboarding_grant');

    -- Notify provider
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_user_id,
        'Application Approved!',
        'Your provider application has been approved. You are now eligible to receive job requests.',
        'provider_approved',
        jsonb_build_object('provider_profile_id', p_provider_profile_id, 'notes', p_notes)
    );

    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('provider_profiles', p_provider_profile_id, 'admin_approve_provider', auth.uid(),
        jsonb_build_object('previous_status', v_prof.status, 'notes', p_notes, 'coins_granted', 35));

    RETURN jsonb_build_object('success', TRUE, 'status', 'active', 'coins_granted', 35);
END;
$$;

-- -----------------------------------------------------------------------
-- 4. admin_reject_provider: Reject a pending provider application
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reject_provider(
    p_provider_profile_id UUID,
    p_reason TEXT DEFAULT 'Application did not meet requirements'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prof provider_profiles%ROWTYPE;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_reject_provider: permission denied';
    END IF;

    SELECT * INTO v_prof FROM public.provider_profiles WHERE id = p_provider_profile_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider profile not found: %', p_provider_profile_id;
    END IF;

    UPDATE public.provider_profiles SET
        status     = 'rejected',
        updated_at = now()
    WHERE id = p_provider_profile_id;

    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_prof.user_id,
        'Application Update',
        'Your provider application could not be approved at this time: ' || p_reason,
        'provider_rejected',
        jsonb_build_object('provider_profile_id', p_provider_profile_id, 'reason', p_reason)
    );

    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('provider_profiles', p_provider_profile_id, 'admin_reject_provider', auth.uid(),
        jsonb_build_object('previous_status', v_prof.status, 'reason', p_reason));

    RETURN jsonb_build_object('success', TRUE, 'status', 'rejected', 'reason', p_reason);
END;
$$;

-- -----------------------------------------------------------------------
-- 5. admin_lift_bid_ban: Remove a ban imposed via verified_id_hash
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_lift_bid_ban(
    p_verified_id_hash TEXT,
    p_reason TEXT DEFAULT 'Admin review'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_lift_bid_ban: permission denied';
    END IF;

    UPDATE public.provider_profiles SET
        bid_banned_until = NULL,
        updated_at       = now()
    WHERE verified_id_hash = p_verified_id_hash
      AND bid_banned_until IS NOT NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('provider_profiles', gen_random_uuid(), 'admin_lift_bid_ban', auth.uid(),
        jsonb_build_object('verified_id_hash', p_verified_id_hash, 'profiles_updated', v_count, 'reason', p_reason));

    RETURN jsonb_build_object('success', TRUE, 'profiles_unbanned', v_count, 'reason', p_reason);
END;
$$;

-- -----------------------------------------------------------------------
-- 6. admin_resolve_dispute: Close a dispute with a resolution
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
    p_dispute_id UUID,
    p_resolution TEXT,
    p_favor TEXT DEFAULT 'neutral'   -- 'customer', 'provider', 'neutral'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_disp RECORD;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_resolve_dispute: permission denied';
    END IF;

    SELECT * INTO v_disp FROM public.disputes WHERE id = p_dispute_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dispute not found: %', p_dispute_id;
    END IF;

    IF v_disp.status = 'resolved' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'already_resolved');
    END IF;

    UPDATE public.disputes SET
        status      = 'resolved',
        resolution  = p_resolution,
        resolved_by = auth.uid(),
        resolved_at = now(),
        updated_at  = now()
    WHERE id = p_dispute_id;

    -- Update the linked request status if still in disputed
    UPDATE public.service_requests SET
        status     = CASE WHEN p_favor = 'neutral' THEN 'completed' ELSE 'completed' END,
        updated_at = now()
    WHERE id = v_disp.request_id AND status = 'disputed';

    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('disputes', p_dispute_id, 'admin_resolve_dispute', auth.uid(),
        jsonb_build_object('resolution', p_resolution, 'favor', p_favor));

    RETURN jsonb_build_object('success', TRUE, 'status', 'resolved', 'favor', p_favor);
END;
$$;

-- -----------------------------------------------------------------------
-- 7. admin_get_metrics: Aggregate platform metrics for admin dashboard
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_get_metrics: permission denied';
    END IF;

    SELECT jsonb_build_object(
        'total_requests',         (SELECT COUNT(*) FROM public.service_requests),
        'open_ordinary',          (SELECT COUNT(*) FROM public.service_requests WHERE status = 'open' AND type = 'ordinary'),
        'emergency_active',       (SELECT COUNT(*) FROM public.service_requests WHERE type = 'emergency' AND status IN ('notified', 'interest_window', 'bidding_open')),
        'emergency_awarded',      (SELECT COUNT(*) FROM public.service_requests WHERE type = 'emergency' AND status = 'awarded'),
        'emergency_failed',       (SELECT COUNT(*) FROM public.service_requests WHERE type = 'emergency' AND status IN ('expired', 'admin_assist')),
        'total_providers',        (SELECT COUNT(*) FROM public.provider_profiles WHERE status = 'active'),
        'pending_providers',      (SELECT COUNT(*) FROM public.provider_profiles WHERE status = 'pending'),
        'banned_providers',       (SELECT COUNT(*) FROM public.provider_profiles WHERE bid_banned_until > now()),
        'total_coins_issued',     COALESCE((SELECT SUM(amount) FROM public.coin_ledger WHERE amount > 0), 0),
        'total_coins_deducted',   COALESCE((SELECT ABS(SUM(amount)) FROM public.coin_ledger WHERE amount < 0), 0),
        'open_disputes',          (SELECT COUNT(*) FROM public.disputes WHERE status = 'open'),
        'resolved_disputes',      (SELECT COUNT(*) FROM public.disputes WHERE status = 'resolved'),
        'avg_rating',             (SELECT ROUND(AVG(rating_avg)::NUMERIC, 2) FROM public.provider_profiles WHERE status = 'active' AND review_count > 0),
        'total_reviews',          (SELECT COUNT(*) FROM public.reviews),
        'total_bookings',         (SELECT COUNT(*) FROM public.bookings WHERE status = 'confirmed'),
        'emergency_fee_revenue',  COALESCE((SELECT SUM(amount) FROM public.emergency_fee_payments WHERE status = 'paid'), 0)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------
-- 8. Grant execute on admin functions to authenticated users (RLS guards internally)
-- -----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_start_bidding(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_bidding(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_provider(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_provider(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lift_bid_ban(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_metrics() TO authenticated;

-- -----------------------------------------------------------------------
-- 9. disputes table - create if missing (may not be in migration 1)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    raised_by   UUID NOT NULL REFERENCES public.profiles(id),
    category    TEXT NOT NULL DEFAULT 'general',
    description TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolution  TEXT,
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: admins see all disputes; customers see their own; providers see requests they're assigned to
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY disputes_admin ON public.disputes
    FOR ALL TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY disputes_customer ON public.disputes
    FOR SELECT TO authenticated
    USING (raised_by = auth.uid());

CREATE POLICY disputes_insert ON public.disputes
    FOR INSERT TO authenticated
    WITH CHECK (raised_by = auth.uid());

-- -----------------------------------------------------------------------
-- 10. audit_log additions column if missing
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'operation'
    ) THEN
        ALTER TABLE public.audit_log ADD COLUMN operation TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'actor_id'
    ) THEN
        ALTER TABLE public.audit_log ADD COLUMN actor_id UUID;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'changes'
    ) THEN
        ALTER TABLE public.audit_log ADD COLUMN changes JSONB;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------
-- 11. push_subscriptions table for future Web Push
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subs_own ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subs_service ON public.push_subscriptions
    FOR SELECT TO service_role
    USING (TRUE);

-- -----------------------------------------------------------------------
-- 12. notifications table add push_delivered column
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'push_delivered'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN push_delivered BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END;
$$;
