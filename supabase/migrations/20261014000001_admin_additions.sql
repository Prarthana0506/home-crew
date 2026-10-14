-- supabase/migrations/20261014000001_admin_additions.sql
-- HomeCrew / UrbanClap: Admin dashboard additions
-- Safe to re-run where practical. Does not delete existing user data.

BEGIN;

-- =========================================================
-- 1. ADMIN SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.settings (key, value)
VALUES ('demo_data_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 2. ADMIN AUDIT LOG
-- Compatible with the existing legacy and current audit columns.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name    text,
    record_id     text,
    action        text NOT NULL,
    performed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    old_data      jsonb,
    new_data      jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 3. DEMO SUPER-ADMIN ALLOWLIST
-- Only explicitly allowlisted accounts can control demo mode.
-- Add the intended super-admin by its verified Auth user ID/email.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.demo_super_admins (
    user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_super_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.demo_super_admins FROM PUBLIC, anon, authenticated;

-- Bootstrap the existing designated admin account if it exists.
INSERT INTO public.demo_super_admins (user_id)
SELECT u.id
FROM auth.users AS u
JOIN public.profiles AS p ON p.id = u.id
WHERE lower(u.email) = lower('prarthanas0506@gmail.com')
  AND p.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- =========================================================
-- 4. DEMO VISIBILITY HELPER
-- Non-demo rows remain visible. Demo rows follow the setting.
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_demo_data_enabled()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT jsonb_build_object(
        'enabled',
        COALESCE(
            (
                SELECT (s.value ->> 'enabled')::boolean
                FROM public.settings AS s
                WHERE s.key = 'demo_data_enabled'
            ),
            true
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.demo_visible(p_is_demo boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        NOT COALESCE(p_is_demo, false)
        OR COALESCE(
            (
                SELECT (s.value ->> 'enabled')::boolean
                FROM public.settings AS s
                WHERE s.key = 'demo_data_enabled'
            ),
            true
        );
$function$;

REVOKE ALL ON FUNCTION public.demo_visible(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demo_visible(boolean)
TO authenticated, anon;

REVOKE ALL ON FUNCTION public.get_demo_data_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_demo_data_enabled()
TO authenticated;

-- =========================================================
-- 5. SET DEMO VISIBILITY
-- Server-side super-admin authorization and audit logging.
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_demo_data_enabled(enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor uuid;
    v_old   jsonb;
    v_new   jsonb;
BEGIN
    v_actor := auth.uid();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.demo_super_admins AS sa
        WHERE sa.user_id = v_actor
    ) THEN
        RAISE EXCEPTION 'Only an allowlisted super-admin can change demo visibility'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.value
    INTO v_old
    FROM public.settings AS s
    WHERE s.key = 'demo_data_enabled'
    FOR UPDATE;

    v_old := COALESCE(v_old, '{"enabled": true}'::jsonb);
    v_new := jsonb_build_object('enabled', enabled);

    INSERT INTO public.settings (key, value, updated_at, updated_by)
    VALUES ('demo_data_enabled', v_new, now(), v_actor)
    ON CONFLICT (key)
    DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now(),
        updated_by = v_actor;

    INSERT INTO public.audit_log (
        table_name,
        record_id,
        action,
        performed_by,
        old_data,
        new_data
    )
    VALUES (
        'settings',
        'demo_data_enabled',
        'DEMO_VISIBILITY_CHANGED',
        v_actor,
        v_old,
        v_new
    );

    RETURN jsonb_build_object(
        'success', true,
        'enabled', enabled
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_demo_data_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_demo_data_enabled(boolean)
TO authenticated;

-- =========================================================
-- 6. VERIFICATION REQUESTS
-- Create the table only if the application does not already
-- have one. Existing objects are preserved.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.verification_requests (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_profile_id uuid NOT NULL
        REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
    document_url        text,
    notes               text,
    reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at         timestamptz,
    is_demo             boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
    ON public.verification_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_requests_provider
    ON public.verification_requests (provider_profile_id);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Existing rows are not automatically converted to demo rows.
-- Demo visibility is enforced by the helper on reads.
DROP POLICY IF EXISTS verification_requests_demo_visibility
    ON public.verification_requests;

CREATE POLICY verification_requests_demo_visibility
ON public.verification_requests
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.demo_visible(is_demo));

DROP POLICY IF EXISTS verification_requests_demo_visibility_anon
    ON public.verification_requests;

CREATE POLICY verification_requests_demo_visibility_anon
ON public.verification_requests
AS RESTRICTIVE
FOR SELECT
TO anon
USING (NOT COALESCE(is_demo, false));

-- Admin access for dashboard reads. Sensitive writes should use
-- server-side authorization or dedicated RPCs.
DROP POLICY IF EXISTS verification_requests_admin_read
    ON public.verification_requests;

CREATE POLICY verification_requests_admin_read
ON public.verification_requests
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
);

-- =========================================================
-- 7. REVENUE BY PERIOD
-- Revenue is derived from completed bookings and paid emergency
-- fees, if those tables and columns are available.
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_is_authorized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    );
$function$;

REVOKE ALL ON FUNCTION public.admin_is_authorized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_is_authorized()
TO authenticated;

-- A function is used instead of assuming a particular booking
-- price/payment column exists. The result always has a stable shape.
CREATE OR REPLACE FUNCTION public.revenue_by_period(period text DEFAULT 'day')
RETURNS TABLE (
    period_start date,
    revenue numeric,
    transaction_count bigint,
    is_demo boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_period text := lower(COALESCE(period, 'day'));
BEGIN
    IF NOT public.admin_is_authorized() THEN
        RAISE EXCEPTION 'Admin access required'
            USING ERRCODE = '42501';
    END IF;

    IF v_period NOT IN ('day', 'week', 'month') THEN
        RAISE EXCEPTION 'Invalid period. Use day, week, or month.';
    END IF;

    /*
      Emergency-fee payments are the explicitly recorded paid
      monetary transactions. Avoid inventing revenue from bookings
      whose payment amounts are not stored in a known schema.

      Dynamic SQL checks optional columns/tables before using them,
      so this migration remains compatible with existing schemas.
    */
    IF to_regclass('public.emergency_fee_payments') IS NOT NULL THEN
        RETURN QUERY EXECUTE format(
            $sql$
            SELECT
                date_trunc(%L, e.created_at)::date AS period_start,
                COALESCE(SUM(e.amount), 0)::numeric AS revenue,
                COUNT(*)::bigint AS transaction_count,
                COALESCE(e.is_demo, false) AS is_demo
            FROM public.emergency_fee_payments e
            WHERE lower(COALESCE(e.status, '')) IN
                ('paid', 'completed', 'success', 'succeeded')
              AND (
                    NOT COALESCE(e.is_demo, false)
                    OR COALESCE(
                        (
                            SELECT (s.value ->> 'enabled')::boolean
                            FROM public.settings s
                            WHERE s.key = 'demo_data_enabled'
                        ),
                        true
                    )
              )
            GROUP BY 1, 4
            ORDER BY 1
            $sql$,
            v_period
        );
    END IF;

    RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.revenue_by_period(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revenue_by_period(text)
TO authenticated;

-- =========================================================
-- 8. ADMIN USER FETCH RPC
-- Returns a JSON array to keep the response shape stable.
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_fetch_users()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    IF NOT public.admin_is_authorized() THEN
        RAISE EXCEPTION 'Admin access required'
            USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'email', u.email,
                'phone', p.phone,
                'role', p.role,
                'status', p.status,
                'is_demo', COALESCE(p.is_demo, false),
                'created_at', p.created_at
            )
            ORDER BY p.created_at DESC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM public.profiles AS p
    LEFT JOIN auth.users AS u ON u.id = p.id
    WHERE public.demo_visible(COALESCE(p.is_demo, false));

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_fetch_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_fetch_users()
TO authenticated;

-- =========================================================
-- 9. SETTINGS ACCESS
-- Do not grant direct client writes to demo controls.
-- =========================================================

REVOKE ALL ON public.settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.settings TO authenticated;

DROP POLICY IF EXISTS settings_admin_read ON public.settings;

CREATE POLICY settings_admin_read
ON public.settings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
);

-- Audit records are admin-readable; writes happen through trusted
-- server-side functions or privileged backend operations.
REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS audit_log_admin_read ON public.audit_log;

CREATE POLICY audit_log_admin_read
ON public.audit_log
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
    )
);

GRANT SELECT ON public.audit_log TO authenticated;

COMMIT;
