BEGIN;

CREATE OR REPLACE FUNCTION public.delete_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor uuid;
    v_demo_enabled boolean;
BEGIN
    v_actor := auth.uid();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.demo_super_admins AS sa
        WHERE sa.user_id = v_actor
    ) THEN
        RAISE EXCEPTION 'Only an allowlisted super-admin can permanently delete sample data'
            USING ERRCODE = '42501';
    END IF;

    v_demo_enabled := COALESCE(
        (SELECT (s.value ->> 'enabled')::boolean
         FROM public.settings AS s
         WHERE s.key = 'demo_data_enabled'),
        true
    );

    IF v_demo_enabled = true THEN
        RAISE EXCEPTION 'Sample activity must be switched off before permanent deletion' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.chat_messages WHERE is_demo = true;
    DELETE FROM public.disputes WHERE is_demo = true;
    DELETE FROM public.messages WHERE is_demo = true;
    DELETE FROM public.notifications WHERE is_demo = true;
    DELETE FROM public.reviews WHERE is_demo = true;
    DELETE FROM public.bid_interests WHERE is_demo = true;
    DELETE FROM public.bids WHERE is_demo = true;
    DELETE FROM public.bookings WHERE is_demo = true;
    DELETE FROM public.coin_ledger WHERE is_demo = true;
    DELETE FROM public.service_requests WHERE is_demo = true;
    DELETE FROM public.provider_profiles WHERE is_demo = true;
    DELETE FROM public.organizations WHERE is_demo = true;
    DELETE FROM public.profiles WHERE is_demo = true;

    DELETE FROM auth.users
    WHERE id IN (
        SELECT au.id
        FROM auth.users AS au
        WHERE au.raw_user_meta_data ->> 'is_demo' = 'true'
           OR au.raw_user_meta_data ->> 'demo_seed' = 'homecrew-v1'
    );

    INSERT INTO public.audit_log (
        table_name,
        record_id,
        action,
        performed_by,
        old_data,
        new_data
    )
    VALUES (
        'demo_data',
        'demo_data',
        'DELETE_DEMO_DATA',
        v_actor,
        jsonb_build_object('demo_enabled', v_demo_enabled),
        jsonb_build_object('deleted', true)
    );

    RETURN jsonb_build_object('success', true, 'demo_data_present', false);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_demo_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_demo_data() TO authenticated;

COMMIT;
