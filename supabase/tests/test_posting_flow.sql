-- ============================================================================
-- URBANCLAP TEST SUITE: CUSTOMER POSTING FLOW SERVER-SIDE VALIDATION
-- Tests for:
-- 1. Minimum Price Enforcement (Ordinary & Emergency)
-- 2. Image Count Limitation (0 to 4 allowed, >4 rejected)
-- 3. Review Gate Enforcement (Refuses unreviewed completed job)
-- 4. Emergency Fee Gating (Refuses without paid/waived payment)
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_test_customer_id UUID;
    v_test_category_id UUID;
    v_test_area_id UUID;
    v_test_provider_id UUID;
    v_valid_start TIMESTAMPTZ;
    v_emergency_start TIMESTAMPTZ;
    v_res JSONB;
    v_payment_id UUID;
    v_completed_req_id UUID;
    v_caught_exception BOOLEAN;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'STARTING TEST SUITE: CUSTOMER POSTING FLOW VALIDATION';
    RAISE NOTICE '=======================================================';

    -- -------------------------------------------------------------------------
    -- FIXTURE SETUP
    -- -------------------------------------------------------------------------
    -- Retrieve a test customer profile
    SELECT id INTO v_test_customer_id
    FROM public.profiles
    WHERE role = 'customer'
    LIMIT 1;

    IF v_test_customer_id IS NULL THEN
        RAISE EXCEPTION 'Fixture error: No customer profile found in database.';
    END IF;

    -- Retrieve Plumbing category (base price 500)
    SELECT id INTO v_test_category_id
    FROM public.service_categories
    WHERE slug = 'cat_plumbing'
    LIMIT 1;

    -- Retrieve RS Puram area
    SELECT id INTO v_test_area_id
    FROM public.areas
    LIMIT 1;

    -- Valid ordinary start time: 2 days ahead at 10:00 AM IST
    v_valid_start := ((now() AT TIME ZONE 'Asia/Kolkata')::DATE + INTERVAL '2 days' + INTERVAL '10 hours') AT TIME ZONE 'Asia/Kolkata';

    -- Valid emergency start time: 3 hours ahead of now
    v_emergency_start := now() + INTERVAL '3 hours';

    -- -------------------------------------------------------------------------
    -- TEST 1: MINIMUM PRICE ENFORCEMENT
    -- -------------------------------------------------------------------------
    RAISE NOTICE '--- Test 1.1: Ordinary request below base price (Rs 400 < Rs 500) ---';
    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.create_request(
            p_customer_id => v_test_customer_id,
            p_type => 'ordinary',
            p_category_id => v_test_category_id,
            p_area_id => v_test_area_id,
            p_title => 'Test Low Price Ordinary',
            p_description => 'Should fail due to price below minimum',
            p_offered_price => 400,
            p_preferred_start => v_valid_start
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Minimum price violation%' THEN
            v_caught_exception := TRUE;
            RAISE NOTICE '[PASS] Ordinary min price violation caught: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught_exception THEN
        RAISE EXCEPTION '[FAIL] Test 1.1: Ordinary request below min price was not rejected!';
    END IF;

    RAISE NOTICE '--- Test 1.2: Emergency request below multiplier floor (Rs 550 < Rs 650) ---';
    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.create_request(
            p_customer_id => v_test_customer_id,
            p_type => 'emergency',
            p_category_id => v_test_category_id,
            p_area_id => v_test_area_id,
            p_title => 'Test Low Price Emergency',
            p_description => 'Should fail due to emergency multiplier minimum',
            p_offered_price => 550,
            p_preferred_start => v_emergency_start
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Minimum price violation%' THEN
            v_caught_exception := TRUE;
            RAISE NOTICE '[PASS] Emergency min price violation caught: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught_exception THEN
        RAISE EXCEPTION '[FAIL] Test 1.2: Emergency request below multiplier floor was not rejected!';
    END IF;

    -- -------------------------------------------------------------------------
    -- TEST 2: IMAGE COUNT VALIDATION
    -- -------------------------------------------------------------------------
    RAISE NOTICE '--- Test 2.1: Image count > 4 (5 images provided) ---';
    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.create_request(
            p_customer_id => v_test_customer_id,
            p_type => 'ordinary',
            p_category_id => v_test_category_id,
            p_area_id => v_test_area_id,
            p_title => 'Test Too Many Images',
            p_description => 'Should fail due to 5 images attached',
            p_offered_price => 500,
            p_preferred_start => v_valid_start,
            p_images => ARRAY['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg']
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Image count violation%' THEN
            v_caught_exception := TRUE;
            RAISE NOTICE '[PASS] Image count violation caught: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught_exception THEN
        RAISE EXCEPTION '[FAIL] Test 2.1: Image count exceeding 4 was not rejected!';
    END IF;

    RAISE NOTICE '--- Test 2.2: Image count <= 4 (3 images provided) succeeds ---';
    v_res := public.create_request(
        p_customer_id => v_test_customer_id,
        p_type => 'ordinary',
        p_category_id => v_test_category_id,
        p_area_id => v_test_area_id,
        p_title => 'Test Valid Ordinary Request',
        p_description => 'Valid schedule, price, and 3 images',
        p_offered_price => 500,
        p_preferred_start => v_valid_start,
        p_images => ARRAY['img1.webp', 'img2.webp', 'img3.webp']
    );

    IF (v_res->>'success')::BOOLEAN = TRUE THEN
        RAISE NOTICE '[PASS] Valid ordinary request created with ID %', v_res->>'request_id';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 2.2: Valid ordinary request failed!';
    END IF;

    -- -------------------------------------------------------------------------
    -- TEST 3: EMERGENCY FEE GATING
    -- -------------------------------------------------------------------------
    RAISE NOTICE '--- Test 3.1: Emergency request without payment reference ---';
    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.create_request(
            p_customer_id => v_test_customer_id,
            p_type => 'emergency',
            p_category_id => v_test_category_id,
            p_area_id => v_test_area_id,
            p_title => 'Test Unpaid Emergency',
            p_description => 'Should fail because emergency fee is not paid',
            p_offered_price => 700,
            p_preferred_start => v_emergency_start,
            p_fee_payment_id => NULL
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Emergency fee gating%' THEN
            v_caught_exception := TRUE;
            RAISE NOTICE '[PASS] Emergency fee gating caught: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught_exception THEN
        RAISE EXCEPTION '[FAIL] Test 3.1: Unpaid emergency request was not rejected!';
    END IF;

    RAISE NOTICE '--- Test 3.2: Emergency request with recorded fee payment succeeds into bidding_active ---';
    v_payment_id := public.record_emergency_fee_payment(
        p_customer_id => v_test_customer_id,
        p_amount => 50.0,
        p_status => 'paid',
        p_payment_method => 'UPI',
        p_transaction_ref => 'TXN-TEST-9988'
    );

    v_res := public.create_request(
        p_customer_id => v_test_customer_id,
        p_type => 'emergency',
        p_category_id => v_test_category_id,
        p_area_id => v_test_area_id,
        p_title => 'Test Paid Emergency Request',
        p_description => 'Valid emergency with verified fee payment',
        p_offered_price => 700,
        p_preferred_start => v_emergency_start,
        p_fee_payment_id => v_payment_id
    );

    IF (v_res->>'status') = 'bidding_active' THEN
        RAISE NOTICE '[PASS] Paid emergency request successfully activated into bidding_active (ID: %)', v_res->>'request_id';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 3.2: Status is % instead of bidding_active!', v_res->>'status';
    END IF;

    -- -------------------------------------------------------------------------
    -- TEST 4: REVIEW GATE ENFORCEMENT
    -- -------------------------------------------------------------------------
    RAISE NOTICE '--- Test 4.1: Customer has an unreviewed completed job ---';
    -- Create a completed request for this customer without any customer_to_provider review
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
        v_test_customer_id,
        'ordinary',
        v_test_category_id,
        v_test_area_id,
        'Unreviewed Completed Job',
        'Customer finished this work but did not review',
        500,
        500,
        v_valid_start,
        'completed'
    )
    RETURNING id INTO v_completed_req_id;

    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.create_request(
            p_customer_id => v_test_customer_id,
            p_type => 'ordinary',
            p_category_id => v_test_category_id,
            p_area_id => v_test_area_id,
            p_title => 'Attempt While Unreviewed',
            p_description => 'Should be blocked by review gate',
            p_offered_price => 500,
            p_preferred_start => v_valid_start
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Review gate violation%' THEN
            v_caught_exception := TRUE;
            RAISE NOTICE '[PASS] Review gate successfully blocked posting: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught_exception THEN
        RAISE EXCEPTION '[FAIL] Test 4.1: Customer was allowed to post despite unreviewed completed job!';
    END IF;

    RAISE NOTICE '--- Test 4.2: Customer submits review, unlocking posting ---';
    -- Insert the missing review
    INSERT INTO public.reviews (
        request_id,
        reviewer_id,
        reviewee_id,
        direction,
        rating,
        feedback
    )
    VALUES (
        v_completed_req_id,
        v_test_customer_id,
        v_test_customer_id, -- test placeholder for reviewee
        'customer_to_provider',
        5,
        'Great work!'
    );

    v_res := public.create_request(
        p_customer_id => v_test_customer_id,
        p_type => 'ordinary',
        p_category_id => v_test_category_id,
        p_area_id => v_test_area_id,
        p_title => 'Post After Review Submitted',
        p_description => 'Should succeed now that review gate is satisfied',
        p_offered_price => 500,
        p_preferred_start => v_valid_start
    );

    IF (v_res->>'success')::BOOLEAN = TRUE THEN
        RAISE NOTICE '[PASS] Review gate cleared after review submission (ID: %)', v_res->>'request_id';
    ELSE
        RAISE EXCEPTION '[FAIL] Test 4.2: Request failed even after review was submitted!';
    END IF;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL TESTS PASSED WITH ZERO VIOLATIONS!';
    RAISE NOTICE '=======================================================';
END;
$$;

ROLLBACK;
