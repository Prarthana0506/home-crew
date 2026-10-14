
-- supabase/migrations/20261014000005_demo_visibility_rls.sql
-- HomeCrew / UrbanClap
-- Enforce demo visibility at the database RLS layer.
--
-- Demo rows remain stored when demo mode is OFF.
-- This migration applies restrictive SELECT policies to tables
-- containing an is_demo column.
--
-- IMPORTANT:
-- RLS applies to authenticated/anon clients subject to their
-- existing grants and policies. Service-role operations and
-- SECURITY DEFINER functions must apply demo_visible() explicitly.

BEGIN;

-- =========================================================
-- 1. ENSURE VISIBILITY HELPER EXISTS
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
-- 2. APPLY VISIBILITY POLICIES TO DEMO-BEARING TABLES
-- =========================================================

DO $block$
DECLARE
    v_table record;
BEGIN
    FOR v_table IN
        SELECT
            n.nspname AS schema_name,
            c.relname AS table_name
        FROM pg_class AS c
        JOIN pg_namespace AS n
          ON n.oid = c.relnamespace
        JOIN pg_attribute AS a
          ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND a.attname = 'is_demo'
          AND a.attnum > 0
          AND NOT a.attisdropped
    LOOP
        -- RLS is required for the table to enforce these policies.
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            v_table.schema_name,
            v_table.table_name
        );

        -- Restrictive policies combine with the table's existing
        -- permissive policies and prevent them bypassing visibility.
        EXECUTE format(
            'DROP POLICY IF EXISTS demo_visibility_authenticated ON %I.%I',
            v_table.schema_name,
            v_table.table_name
        );

        EXECUTE format(
            'CREATE POLICY demo_visibility_authenticated
             ON %I.%I
             AS RESTRICTIVE
             FOR SELECT
             TO authenticated
             USING (public.demo_visible(is_demo))',
            v_table.schema_name,
            v_table.table_name
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS demo_visibility_anon ON %I.%I',
            v_table.schema_name,
            v_table.table_name
        );

        EXECUTE format(
            'CREATE POLICY demo_visibility_anon
             ON %I.%I
             AS RESTRICTIVE
             FOR SELECT
             TO anon
             USING (NOT COALESCE(is_demo, false))',
            v_table.schema_name,
            v_table.table_name
        );
    END LOOP;
END;
$block$;

-- =========================================================
-- 3. EXPLICITLY COVER KNOWN DEMO-BEARING TABLES
-- Add is_demo where it is missing so visibility can be enforced.
-- Existing real records default to false.
-- =========================================================

ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.provider_profiles
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.service_requests
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.bids
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.bid_interests
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.bookings
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.messages
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.reviews
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.coin_ledger
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.notifications
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.disputes
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.emergency_fee_payments
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.verification_requests
    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- =========================================================
-- 4. REAPPLY POLICIES AFTER ENSURING KNOWN COLUMNS EXIST
-- =========================================================

DO $block$
DECLARE
    v_table record;
BEGIN
    FOR v_table IN
        SELECT
            n.nspname AS schema_name,
            c.relname AS table_name
        FROM pg_class AS c
        JOIN pg_namespace AS n
          ON n.oid = c.relnamespace
        JOIN pg_attribute AS a
          ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND a.attname = 'is_demo'
          AND a.attnum > 0
          AND NOT a.attisdropped
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            v_table.schema_name,
            v_table.table_name
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS demo_visibility_authenticated ON %I.%I',
            v_table.schema_name,
            v_table.table_name
        );

        EXECUTE format(
            'CREATE POLICY demo_visibility_authenticated
             ON %I.%I
             AS RESTRICTIVE
             FOR SELECT
             TO authenticated
             USING (public.demo_visible(is_demo))',
            v_table.schema_name,
            v_table.table_name
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS demo_visibility_anon ON %I.%I',
            v_table.schema_name,
            v_table.table_name
        );

        EXECUTE format(
            'CREATE POLICY demo_visibility_anon
             ON %I.%I
             AS RESTRICTIVE
             FOR SELECT
             TO anon
             USING (NOT COALESCE(is_demo, false))',
            v_table.schema_name,
            v_table.table_name
        );
    END LOOP;
END;
$block$;

COMMIT;
