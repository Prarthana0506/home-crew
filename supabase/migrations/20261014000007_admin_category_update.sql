-- ============================================================================
-- Migration 20261014000006: admin category update RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_category(
    p_category_id UUID,
    p_name TEXT DEFAULT NULL,
    p_base_price NUMERIC DEFAULT NULL,
    p_default_image TEXT DEFAULT NULL,
    p_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_admin_id
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin';

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.service_categories
        WHERE id = p_category_id
    ) THEN
        RAISE EXCEPTION 'Category not found';
    END IF;

    UPDATE public.service_categories
    SET
        name = COALESCE(p_name, name),
        base_price = COALESCE(p_base_price, base_price),
        default_image = COALESCE(p_default_image, default_image),
        active = COALESCE(p_active, active)
    WHERE id = p_category_id;

    RETURN jsonb_build_object(
        'success', true,
        'category_id', p_category_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_category(UUID, TEXT, NUMERIC, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_category(UUID, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;
