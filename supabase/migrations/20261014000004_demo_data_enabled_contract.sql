
-- supabase/migrations/20261014000004_demo_data_enabled_contract.sql
-- HomeCrew / UrbanClap
-- Persistent demo visibility contract.
--
-- Uses:
--   public.settings(key, value, updated_at, updated_by)
--   public.demo_super_admins(user_id)
--   public.audit_log(table_name, record_id, action,
--                    performed_by, old_data, new_data)
--
-- Demo rows are hidden when the setting is OFF, not deleted.
-- Only explicitly allowlisted super-admins can toggle visibility.

BEGIN;

-- =========================================================
-- 1. ENSURE SETTINGS TABLE AND DEFAULT
-- =========================================================

CREATE TABLE IF NOT EXISTS public.settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS updated_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

INSERT INTO public.settings (key, value)
VALUES ('demo_data_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 2. ENSURE SUPER-ADMIN ALLOWLIST
-- =========================================================

CREATE TABLE IF NOT EXISTS public.demo_super_admins (
    user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_super_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.demo_super_admins FROM PUBLIC, anon, authenticated;

-- Bootstrap the designated admin only if the account exists.
-- This does not grant access to every user with role = admin.
INSERT INTO public.demo_super_admins (user_id)
SELECT u.id
FROM auth.users AS u
JOIN public.profiles AS p ON p.id = u.id
WHERE lower(u.email) = lower('prarthanas0506@gmail.com')
  AND p.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- =========================================================
-- 3. DEMO VISIBILITY HELPER
-- =========================================================

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

-- =========================================================
-- 4. READ CURRENT DEMO VISIBILITY
-- Returns {"enabled": true|false}
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_demo_data_enabled()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor uuid;
    v_enabled boolean;
BEGIN
    v_actor := auth.uid();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = v_actor
          AND p.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Admin access required'
            USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE((s.value ->> 'enabled')::boolean, true)
    INTO v_enabled
    FROM public.settings AS s
    WHERE s.key = 'demo_data_enabled';

    IF NOT FOUND THEN
        v_enabled := true;
    END IF;

    RETURN jsonb_build_object('enabled', v_enabled);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_demo_data_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_demo_data_enabled()
TO authenticated;

-- =========================================================
-- 5. SET DEMO VISIBILITY
-- Checks the allowlist inside the database.
-- Every toggle is audited, including repeated values.
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_demo_data_enabled(enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor uuid;
    v_old jsonb;
    v_new jsonb;
BEGIN
    v_actor := auth.uid();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.demo_super_admins AS sa
        WHERE sa.user_id = v_actor
    ) THEN
        RAISE EXCEPTION
            'Only an allowlisted super-admin can change demo visibility'
            USING ERRCODE = '42501';
    END IF;

    -- Lock the current setting to serialize concurrent changes.
    SELECT s.value
    INTO v_old
    FROM public.settings AS s
    WHERE s.key = 'demo_data_enabled'
    FOR UPDATE;

    IF NOT FOUND THEN
        v_old := '{"enabled": true}'::jsonb;
    END IF;

    v_new := jsonb_build_object('enabled', enabled);

    INSERT INTO public.settings (
        key,
        value,
        updated_at,
        updated_by
    )
    VALUES (
        'demo_data_enabled',
        v_new,
        now(),
        v_actor
    )
    ON CONFLICT (key)
    DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now(),
        updated_by = v_actor;

    -- Audit logging uses the existing audit table.
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

REVOKE ALL ON FUNCTION public.set_demo_data_enabled(boolean)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_demo_data_enabled(boolean)
TO authenticated;

-- =========================================================
-- 6. PROTECT DIRECT SETTING WRITES
-- The setting must be changed through the authorized RPC.
-- =========================================================

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE
ON public.settings
FROM PUBLIC, anon, authenticated;

-- Admins can read settings through authenticated RLS.
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

-- =========================================================
-- 7. PROTECT AUDIT LOG
-- Clients cannot directly insert, update, or delete audit rows.
-- =========================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE
ON public.audit_log
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.audit_log TO authenticated;

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

COMMIT;


