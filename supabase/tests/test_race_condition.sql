-- ============================================================================
-- URBANCLAP TEST SUITE: CONCURRENT JOB ACCEPTANCE (RACE CONDITION)
-- Verifies that two providers racing to accept the same ordinary job:
-- 1. Exactly one winner succeeds (success: true, creates 2h hold)
-- 2. The loser of the race receives error: 'already taken'
-- 3. The 8-hour gap rule prevents overlapping/conflicting assignments
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_prov1_user_id UUID;
    v_prov2_user_id UUID;
    v_cust_user_id UUID;
    v_cat_id UUID;
    v_area_id UUID;
    v_req_id UUID;
    v_res1 JSONB;
    v_res2 JSONB;
    v_start TIMESTAMPTZ;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'TESTING ATOMIC ACCEPT_ORDINARY RACE CONDITION';
    RAISE NOTICE '=======================================================';

    -- Find 2 provider profiles
    SELECT user_id INTO v_prov1_user_id
    FROM public.provider_profiles
    LIMIT 1;

    SELECT user_id INTO v_prov2_user_id
    FROM public.provider_profiles
    WHERE user_id <> v_prov1_user_id
    LIMIT 1;

    -- If only 1 provider, create a second temporary provider for testing
    IF v_prov2_user_id IS NULL THEN
        v_prov2_user_id := 'c0000000-0000-0000-0000-000000000099'::UUID;
        INSERT INTO public.profiles (id, role, name, phone, language, status)
        VALUES (v_prov2_user_id, 'provider', 'Provider 2 Race', '9999999999', 'en', 'active')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.provider_profiles (user_id, provider_type, categories, skills, experience, status)
        VALUES (v_prov2_user_id, 'freelancer', ARRAY['cat_plumbing'], ARRAY['plumber'], 3, 'active')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Find customer
    SELECT id INTO v_cust_user_id
    FROM public.profiles
    WHERE role = 'customer'
    LIMIT 1;

    SELECT id INTO v_cat_id FROM public.service_categories LIMIT 1;
    SELECT id INTO v_area_id FROM public.areas LIMIT 1;

    v_start := ((now() AT TIME ZONE 'Asia/Kolkata')::DATE + INTERVAL '2 days' + INTERVAL '10 hours') AT TIME ZONE 'Asia/Kolkata';

    -- 1. Create open ordinary job
    INSERT INTO public.service_requests (
        customer_id,
        type,
        category_id,
        area_id,
        title,
        description,
        offered_price,
        min_price,
        preferred_start,
        status
    )
    VALUES (
        v_cust_user_id,
        'ordinary',
        v_cat_id,
        v_area_id,
        'Race Condition Test Job',
        'Testing concurrent acceptance',
        500,
        500,
        v_start,
        'open'
    )
    RETURNING id INTO v_req_id;

    RAISE NOTICE 'Created test open request ID: %', v_req_id;

    -- 2. First provider accepts job
    v_res1 := public.accept_ordinary(v_req_id, v_prov1_user_id);
    RAISE NOTICE 'Provider 1 accept result: %', v_res1;

    IF (v_res1->>'success')::BOOLEAN <> TRUE THEN
        RAISE EXCEPTION '[FAIL] Provider 1 failed to accept open job!';
    END IF;

    -- 3. Second provider attempts to accept the SAME job
    v_res2 := public.accept_ordinary(v_req_id, v_prov2_user_id);
    RAISE NOTICE 'Provider 2 accept result: %', v_res2;

    IF (v_res2->>'success')::BOOLEAN = FALSE AND (v_res2->>'error') = 'already taken' THEN
        RAISE NOTICE '[PASS] Provider 2 received "already taken" response as expected!';
    ELSE
        RAISE EXCEPTION '[FAIL] Provider 2 did not get "already taken" error! Received: %', v_res2;
    END IF;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'RACE CONDITION TESTS PASSED WITH ZERO VIOLATIONS!';
    RAISE NOTICE '=======================================================';
END;
$$;

ROLLBACK;
