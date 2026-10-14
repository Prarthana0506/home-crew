-- Migration: 20261014000015_admin_full_editable.sql
-- Description: Implement complete and robust editable RPCs for Admin Console
--              including Category editing, Setting editing, User editing, and Provider editing.

BEGIN;

-- 1. admin_update_category
CREATE OR REPLACE FUNCTION public.admin_update_category(
    p_category_id UUID,
    p_name TEXT DEFAULT NULL,
    p_base_price NUMERIC DEFAULT NULL,
    p_default_image TEXT DEFAULT NULL,
    p_active BOOLEAN DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_name_ta TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cat RECORD;
BEGIN
    SELECT * INTO v_cat
    FROM public.service_categories
    WHERE id = p_category_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Category not found with id %', p_category_id;
    END IF;

    UPDATE public.service_categories
    SET
        name = COALESCE(NULLIF(TRIM(p_name), ''), name),
        base_price = COALESCE(p_base_price, base_price),
        default_image = COALESCE(NULLIF(TRIM(p_default_image), ''), default_image),
        active = COALESCE(p_active, active),
        description = COALESCE(p_description, description),
        name_ta = COALESCE(p_name_ta, name_ta)
    WHERE id = p_category_id;

    RETURN jsonb_build_object(
        'success', true,
        'category_id', p_category_id,
        'message', 'Category updated successfully'
    );
END;
$$;

-- 2. admin_update_setting
CREATE OR REPLACE FUNCTION public.admin_update_setting(
    p_key TEXT,
    p_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_key IS NULL OR TRIM(p_key) = '' THEN
        RAISE EXCEPTION 'Setting key cannot be empty';
    END IF;

    INSERT INTO public.settings (key, value, updated_at)
    VALUES (p_key, p_value, timezone('utc'::text, now()))
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = timezone('utc'::text, now());

    RETURN jsonb_build_object(
        'success', true,
        'key', p_key,
        'value', p_value,
        'message', 'Setting updated successfully'
    );
END;
$$;

-- 3. admin_update_user
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_user_id UUID,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_rating NUMERIC DEFAULT NULL,
    p_coins INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prov_id UUID;
    v_curr_coins INTEGER;
    v_diff INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User profile not found with id %', p_user_id;
    END IF;

    UPDATE public.profiles
    SET
        name = COALESCE(NULLIF(TRIM(p_name), ''), name),
        phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
        role = COALESCE(NULLIF(TRIM(p_role), ''), role),
        status = COALESCE(NULLIF(TRIM(p_status), ''), status),
        customer_rating_avg = COALESCE(p_rating, customer_rating_avg)
    WHERE id = p_user_id;

    -- If user is a provider or has a provider_profile, update provider fields as well
    SELECT id INTO v_prov_id
    FROM public.provider_profiles
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_prov_id IS NOT NULL THEN
        UPDATE public.provider_profiles
        SET
            rating_avg = COALESCE(p_rating, rating_avg),
            status = COALESCE(NULLIF(TRIM(p_status), ''), status)
        WHERE id = v_prov_id;

        IF p_coins IS NOT NULL THEN
            SELECT COALESCE(SUM(amount), 0)::INTEGER INTO v_curr_coins
            FROM public.coin_ledger
            WHERE provider_profile_id = v_prov_id;

            IF p_coins <> v_curr_coins THEN
                v_diff := p_coins - v_curr_coins;
                INSERT INTO public.coin_ledger (provider_profile_id, amount, reason)
                VALUES (v_prov_id, v_diff, 'admin_manual_adjustment');
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'message', 'User profile updated successfully'
    );
END;
$$;

-- 4. admin_update_provider
CREATE OR REPLACE FUNCTION public.admin_update_provider(
    p_provider_profile_id UUID,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_provider_type TEXT DEFAULT NULL,
    p_experience INTEGER DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_rating NUMERIC DEFAULT NULL,
    p_coins INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_curr_coins INTEGER;
    v_diff INTEGER;
BEGIN
    SELECT user_id INTO v_user_id
    FROM public.provider_profiles
    WHERE id = p_provider_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider profile not found with id %', p_provider_profile_id;
    END IF;

    UPDATE public.provider_profiles
    SET
        provider_type = COALESCE(NULLIF(TRIM(p_provider_type), ''), provider_type),
        experience = COALESCE(p_experience, experience),
        status = COALESCE(NULLIF(TRIM(p_status), ''), status),
        rating_avg = COALESCE(p_rating, rating_avg)
    WHERE id = p_provider_profile_id;

    IF p_coins IS NOT NULL THEN
        SELECT COALESCE(SUM(amount), 0)::INTEGER INTO v_curr_coins
        FROM public.coin_ledger
        WHERE provider_profile_id = p_provider_profile_id;

        IF p_coins <> v_curr_coins THEN
            v_diff := p_coins - v_curr_coins;
            INSERT INTO public.coin_ledger (provider_profile_id, amount, reason)
            VALUES (p_provider_profile_id, v_diff, 'admin_manual_adjustment');
        END IF;
    END IF;

    IF v_user_id IS NOT NULL AND (p_name IS NOT NULL OR p_phone IS NOT NULL OR p_status IS NOT NULL) THEN
        UPDATE public.profiles
        SET
            name = COALESCE(NULLIF(TRIM(p_name), ''), name),
            phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
            status = COALESCE(NULLIF(TRIM(p_status), ''), status)
        WHERE id = v_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'provider_id', p_provider_profile_id,
        'message', 'Provider updated successfully'
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.admin_update_category(UUID, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_provider(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, NUMERIC, INTEGER) TO authenticated, anon;

COMMIT;
