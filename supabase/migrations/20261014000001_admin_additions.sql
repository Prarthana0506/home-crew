-- ============================================================================
-- Migration 9 (Admin Additions):
--   1. Admin sub-roles (super / support / finance) stored in profiles.admin_role
--   2. Verification queue for providers & technicians
--   3. Revenue view from emergency_fee_payments (day / week / month)
--   4. RPC: set_emergency_fee (affects only future posts)
--   5. RPC: admin_update_category (edit name, base_price, image_url, active)
--   6. RPC: admin_fetch_users (full user list with coins & ban info)
--   7. RPC: admin_fetch_coin_ledger (per-provider coin ledger for admin)
--   8. Dispute chat table (admin can post messages with images)
--   9. RLS for every new table / function
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1.  Admin sub-role column on profiles
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'admin_role'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN admin_role TEXT
            CHECK (admin_role IN ('super', 'support', 'finance'));
    END IF;
END;
$$;

-- -----------------------------------------------------------------------
-- 2.  Verification queue
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_profile_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
    doc_type            TEXT NOT NULL CHECK (doc_type IN ('id_proof', 'selfie')),
    document_url        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id         UUID REFERENCES public.profiles(id),
    reviewer_note       TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Admin sees all; provider sees their own requests
CREATE POLICY verif_admin ON public.verification_requests
    FOR ALL TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY verif_own ON public.verification_requests
    FOR SELECT TO authenticated
    USING (
        provider_profile_id IN (
            SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY verif_insert ON public.verification_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        provider_profile_id IN (
            SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------
-- 3.  Revenue view from emergency_fee_payments
-- -----------------------------------------------------------------------
CREATE OR REPLACE VIEW public.revenue_by_period AS
SELECT
    'day'                                        AS period,
    date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS period_start,
    date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day' AS period_end,
    COUNT(*)::INT                                 AS job_count,
    COALESCE(SUM(amount), 0)                      AS total_fee
FROM public.emergency_fee_payments
WHERE status = 'paid'
GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')

UNION ALL

SELECT
    'week',
    date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata'),
    date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata') + INTERVAL '7 days',
    COUNT(*)::INT,
    COALESCE(SUM(amount), 0)
FROM public.emergency_fee_payments
WHERE status = 'paid'
GROUP BY date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata')

UNION ALL

SELECT
    'month',
    date_trunc('month', created_at AT TIME ZONE 'Asia/Kolkata'),
    date_trunc('month', created_at AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 month',
    COUNT(*)::INT,
    COALESCE(SUM(amount), 0)
FROM public.emergency_fee_payments
WHERE status = 'paid'
GROUP BY date_trunc('month', created_at AT TIME ZONE 'Asia/Kolkata');

-- Admin-only access on the view
CREATE POLICY rev_admin ON public.emergency_fee_payments
    FOR SELECT TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- -----------------------------------------------------------------------
-- 4.  RPC: set_emergency_fee
--     Inserts a new settings row with effective_from = now().
--     Old emergency posts keep the fee baked into their emergency_fee_payments rows.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_emergency_fee(p_fee NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_value JSONB;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'set_emergency_fee: permission denied (admin only)';
    END IF;

    IF p_fee <= 0 THEN
        RAISE EXCEPTION 'Emergency fee must be positive, got %', p_fee;
    END IF;

    SELECT value INTO v_old_value FROM public.settings WHERE key = 'emergency_fee';

    -- Insert a new versioned row
    INSERT INTO public.settings (key, value, updated_by, updated_at)
    VALUES ('emergency_fee', jsonb_build_object('value', p_fee), auth.uid(), now())
    ON CONFLICT (key) DO UPDATE
        SET value      = EXCLUDED.value,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at;

    -- Audit
    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('settings', gen_random_uuid(), 'set_emergency_fee', auth.uid(),
        jsonb_build_object('old', v_old_value, 'new', p_fee));

    RETURN jsonb_build_object('success', TRUE, 'fee', p_fee);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_emergency_fee(NUMERIC) TO authenticated;

-- -----------------------------------------------------------------------
-- 5.  RPC: admin_update_category
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_category(
    p_category_id   UUID,
    p_name          TEXT     DEFAULT NULL,
    p_base_price    NUMERIC  DEFAULT NULL,
    p_image_url     TEXT     DEFAULT NULL,
    p_active        BOOLEAN  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_update_category: permission denied';
    END IF;

    UPDATE public.service_categories SET
        name       = COALESCE(p_name,       name),
        base_price = COALESCE(p_base_price, base_price),
        image_url  = COALESCE(p_image_url,  image_url),
        active     = COALESCE(p_active,     active),
        updated_at = now()
    WHERE id = p_category_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Category not found: %', p_category_id;
    END IF;

    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('service_categories', p_category_id, 'admin_update_category', auth.uid(),
        jsonb_build_object('name', p_name, 'base_price', p_base_price, 'image_url', p_image_url, 'active', p_active));

    RETURN jsonb_build_object('success', TRUE, 'category_id', p_category_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_category(UUID, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------
-- 6.  RPC: admin_fetch_users  (combined customer + provider view)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_fetch_users()
RETURNS TABLE (
    user_id         UUID,
    name            TEXT,
    email           TEXT,
    phone           TEXT,
    role            TEXT,
    status          TEXT,
    created_at      TIMESTAMPTZ,
    -- provider extras (NULL for plain customers)
    provider_profile_id  UUID,
    provider_type        TEXT,
    provider_status      TEXT,
    coins                BIGINT,
    rating_avg           NUMERIC,
    review_count         INT,
    bid_banned_until     TIMESTAMPTZ,
    verified_id_hash     TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id            AS user_id,
        p.name,
        au.email,
        p.phone,
        p.role,
        p.status,
        p.created_at,
        pp.id           AS provider_profile_id,
        pp.provider_type,
        pp.status       AS provider_status,
        COALESCE((SELECT SUM(cl.amount) FROM coin_ledger cl WHERE cl.provider_profile_id = pp.id), 0) AS coins,
        pp.rating_avg,
        pp.review_count,
        pp.bid_banned_until,
        pp.verified_id_hash
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    LEFT JOIN public.provider_profiles pp ON pp.user_id = p.id AND pp.status != 'left'
    WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_fetch_users() TO authenticated;

-- -----------------------------------------------------------------------
-- 7.  RPC: admin_fetch_coin_ledger
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_fetch_coin_ledger(p_provider_profile_id UUID)
RETURNS TABLE (
    id          UUID,
    amount      INT,
    reason      TEXT,
    reference_id UUID,
    created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT cl.id, cl.amount, cl.reason, cl.reference_id, cl.created_at
    FROM public.coin_ledger cl
    WHERE cl.provider_profile_id = p_provider_profile_id
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    ORDER BY cl.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_fetch_coin_ledger(UUID) TO authenticated;

-- -----------------------------------------------------------------------
-- 8.  Dispute chat table (admin ↔ parties)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id  UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES public.profiles(id),
    content     TEXT NOT NULL,
    image_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- Admin can do anything; parties can read and insert on their own dispute
CREATE POLICY disp_msg_admin ON public.dispute_messages
    FOR ALL TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY disp_msg_read ON public.dispute_messages
    FOR SELECT TO authenticated
    USING (
        dispute_id IN (
            SELECT id FROM public.disputes
            WHERE raised_by = auth.uid()
               OR request_id IN (
                   SELECT request_id FROM public.bookings b
                   JOIN public.provider_profiles pp ON pp.id = b.provider_profile_id
                   WHERE pp.user_id = auth.uid()
               )
        )
    );

CREATE POLICY disp_msg_insert ON public.dispute_messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid());

-- Enable Realtime on dispute_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;

-- -----------------------------------------------------------------------
-- 9.  RPC: admin_approve_verification
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_verification(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req verification_requests%ROWTYPE;
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_approve_verification: permission denied';
    END IF;

    SELECT * INTO v_req FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Verification request not found: %', p_request_id; END IF;

    UPDATE public.verification_requests SET
        status      = 'approved',
        reviewer_id = auth.uid(),
        reviewed_at = now()
    WHERE id = p_request_id;

    -- Mark field on provider_profile
    IF v_req.doc_type = 'id_proof' THEN
        UPDATE public.provider_profiles SET id_proof_url = v_req.document_url, updated_at = now()
        WHERE id = v_req.provider_profile_id;
    ELSIF v_req.doc_type = 'selfie' THEN
        UPDATE public.provider_profiles SET photo_url = v_req.document_url, updated_at = now()
        WHERE id = v_req.provider_profile_id;
    END IF;

    INSERT INTO public.audit_log (table_name, record_id, operation, actor_id, changes)
    VALUES ('verification_requests', p_request_id, 'admin_approve_verification', auth.uid(),
        jsonb_build_object('doc_type', v_req.doc_type));

    RETURN jsonb_build_object('success', TRUE, 'doc_type', v_req.doc_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_verification(UUID) TO authenticated;

-- -----------------------------------------------------------------------
-- 10. RPC: admin_reject_verification
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reject_verification(
    p_request_id UUID,
    p_reason     TEXT DEFAULT 'Document could not be verified'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'admin_reject_verification: permission denied';
    END IF;

    UPDATE public.verification_requests SET
        status        = 'rejected',
        reviewer_id   = auth.uid(),
        reviewer_note = p_reason,
        reviewed_at   = now()
    WHERE id = p_request_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Verification request not found: %', p_request_id; END IF;

    RETURN jsonb_build_object('success', TRUE, 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_verification(UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------
-- 11. Add image_url to service_categories if missing
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE public.service_categories ADD COLUMN image_url TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.service_categories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END;
$$;
