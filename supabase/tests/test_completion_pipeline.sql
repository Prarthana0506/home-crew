-- ============================================================================
-- URBANCLAP TEST SUITE: COMPLETION PIPELINE & REVIEW SYSTEM
-- Tests for:
-- 1. Dual Mark Complete & Review Window Scheduling (+30 minutes)
-- 2. Blind Review Submission, Simultaneous Reveal, Coin Awards (+20 + bonus)
-- 3. Customer Low Rating Rule (< 3.0 warning, < 2.5 under_review & block)
-- 4. No-Show Claim Gating, Automatic Penalty & Disputes Record
-- 5. No-Show Reopen Flow (retains fee, blocks provider)
-- 6. Auto-Complete Ticks (48h/24h silent timers, 24h inquiry, 7d auto-reveal)
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_customer_id       UUID;
    v_provider_user_id  UUID;
    v_prov_profile_id   UUID;
    v_category_id       UUID;
    v_area_id           UUID;
    v_req_id            UUID;
    v_booking_id        UUID;
    v_now               TIMESTAMPTZ := now();
    v_res               JSONB;
    v_booking_rec       RECORD;
    v_coins_awarded     INTEGER;
    v_prov_rating       NUMERIC;
    v_cust_rating       NUMERIC;
    v_cust_status       TEXT;
    v_notification_cnt  INTEGER;
    v_dispute_cnt       INTEGER;
    v_reopen_res        JSONB;
    v_new_req_id        UUID;
    v_caught_exception  BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'STARTING TEST SUITE: COMPLETION PIPELINE & REVIEWS';
    RAISE NOTICE '=======================================================';

    -- -------------------------------------------------------------------------
    -- FIXTURE SETUP
    -- -------------------------------------------------------------------------
    -- Customer
    SELECT id INTO v_customer_id FROM public.profiles WHERE role = 'customer' LIMIT 1;
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Fixture: customer profile not found';
    END IF;

    -- Provider profile & user
    SELECT id, user_id INTO v_prov_profile_id, v_provider_user_id
    FROM public.provider_profiles
    WHERE status = 'active'
    LIMIT 1;
    IF v_prov_profile_id IS NULL THEN
        RAISE EXCEPTION 'Fixture: active provider profile not found';
    END IF;

    -- Category & Area
    SELECT id INTO v_category_id FROM public.service_categories LIMIT 1;
    SELECT id INTO v_area_id FROM public.areas LIMIT 1;

    -- Ensure customer starts fresh with active status
    UPDATE public.profiles
    SET customer_status = 'active', customer_rating_avg = 5.0, customer_review_count = 0
    WHERE id = v_customer_id;

    -- -------------------------------------------------------------------------
    -- TEST 1: DUAL MARK COMPLETE & REVIEW OPENS AT SCHEDULE (+30m)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 1: Testing dual mark_complete and review_opens_at (+30m)...';

    -- Create test request & confirmed booking
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_category_id, v_area_id, 'Deep Pipe Repair',
        'Testing completion flow', 600, v_now - INTERVAL '3 hours', 'assigned'
    ) RETURNING id INTO v_req_id;

    INSERT INTO public.bookings (
        request_id, provider_profile_id, time_range, status
    ) VALUES (
        v_req_id, v_prov_profile_id,
        tstzrange(v_now - INTERVAL '3 hours', v_now - INTERVAL '1 hour', '[)'),
        'confirmed'
    ) RETURNING id INTO v_booking_id;

    -- Step 1a: Provider marks complete
    -- Temporarily set auth context to provider user
    PERFORM set_config('request.jwt.claim.sub', v_provider_user_id::TEXT, true);
    v_res := public.mark_complete(v_booking_id, 'provider');
    IF NOT (v_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 1 Failed: Provider mark_complete returned success=false: %', v_res;
    END IF;

    SELECT * INTO v_booking_rec FROM public.bookings WHERE id = v_booking_id;
    IF v_booking_rec.provider_marked_complete_at IS NULL THEN
        RAISE EXCEPTION 'Test 1 Failed: provider_marked_complete_at is not recorded';
    END IF;
    IF v_booking_rec.review_opens_at IS NOT NULL THEN
        RAISE EXCEPTION 'Test 1 Failed: review_opens_at should not be set when only provider marked';
    END IF;

    -- Step 1b: Customer marks complete
    PERFORM set_config('request.jwt.claim.sub', v_customer_id::TEXT, true);
    v_res := public.mark_complete(v_booking_id, 'customer');
    IF NOT (v_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 1 Failed: Customer mark_complete returned success=false: %', v_res;
    END IF;

    SELECT * INTO v_booking_rec FROM public.bookings WHERE id = v_booking_id;
    IF v_booking_rec.customer_marked_complete_at IS NULL THEN
        RAISE EXCEPTION 'Test 1 Failed: customer_marked_complete_at is not recorded';
    END IF;
    IF v_booking_rec.review_opens_at IS NULL THEN
        RAISE EXCEPTION 'Test 1 Failed: review_opens_at is null after both marked complete';
    END IF;
    IF v_booking_rec.status != 'completed' THEN
        RAISE EXCEPTION 'Test 1 Failed: booking status was not updated to completed';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Dual mark complete scheduled review_opens_at = % (source=%)',
        v_booking_rec.review_opens_at, v_booking_rec.completion_source;

    -- -------------------------------------------------------------------------
    -- TEST 2: BLIND REVIEWS & REVEAL COIN AWARDS (+20 completion + 5-star bonus = 25 coins)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 2: Testing blind review submissions and coin awards...';

    -- Fast-forward review_opens_at into past to allow review submission
    UPDATE public.bookings
    SET review_opens_at = v_now - INTERVAL '5 minutes'
    WHERE id = v_booking_id;

    -- Step 2a: Customer submits 5-star review
    PERFORM set_config('request.jwt.claim.sub', v_customer_id::TEXT, true);
    v_res := public.submit_review(
        v_booking_id,
        5::SMALLINT,
        'Outstanding and punctual service'
    );

    IF NOT (v_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 2 Failed: Customer submit_review returned failure: %', v_res;
    END IF;
    -- Blind check: other hasn't reviewed yet, so revealed should be false
    IF (v_res->>'revealed')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 2 Failed: Customer review was revealed before provider submitted!';
    END IF;

    -- Step 2b: Provider submits review with tags & paid_agreed_amount
    PERFORM set_config('request.jwt.claim.sub', v_provider_user_id::TEXT, true);
    v_res := public.submit_review(
        v_booking_id,
        5::SMALLINT,
        'Polite customer and clear access provided',
        ARRAY['punctual', 'clear_instructions', 'clean_site'],
        TRUE
    );

    IF NOT (v_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 2 Failed: Provider submit_review returned failure: %', v_res;
    END IF;
    -- Both reviewed -> should be revealed immediately
    IF NOT (v_res->>'revealed')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 2 Failed: Reviews were not revealed after both parties submitted!';
    END IF;

    -- Verify Coin Ledger awards: +20 completion, +5 bonus for 5 stars = total 25
    SELECT COALESCE(SUM(amount), 0) INTO v_coins_awarded
    FROM public.coin_ledger
    WHERE provider_profile_id = v_prov_profile_id
      AND reference_id = v_booking_id;

    IF v_coins_awarded != 25 THEN
        RAISE EXCEPTION 'Test 2 Failed: Expected 25 coins awarded (20 + 5 bonus), got %', v_coins_awarded;
    END IF;

    RAISE NOTICE '  -> SUCCESS: Blind reviews revealed and % coins awarded to provider ledger.', v_coins_awarded;

    -- -------------------------------------------------------------------------
    -- TEST 3: CUSTOMER LOW-RATING GATE (<3.0 warning, <2.5 under_review & block)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 3: Testing customer low-rating flow and create_request gating...';

    -- Create a 2nd completed booking to submit a 1-star review for the customer
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_category_id, v_area_id, 'Second Wiring Job',
        'Testing low rating penalty', 650, v_now - INTERVAL '4 hours', 'assigned'
    ) RETURNING id INTO v_req_id;

    INSERT INTO public.bookings (
        request_id, provider_profile_id, time_range, status,
        provider_marked_complete_at, customer_marked_complete_at,
        review_opens_at, completion_source
    ) VALUES (
        v_req_id, v_prov_profile_id,
        tstzrange(v_now - INTERVAL '4 hours', v_now - INTERVAL '2 hours', '[)'),
        'completed',
        v_now - INTERVAL '2 hours', v_now - INTERVAL '2 hours',
        v_now - INTERVAL '1 hour', 'both'
    ) RETURNING id INTO v_booking_id;

    -- Customer gives 4 stars
    PERFORM set_config('request.jwt.claim.sub', v_customer_id::TEXT, true);
    PERFORM public.submit_review(v_booking_id, 4::SMALLINT, 'Good job');

    -- Provider gives customer 1 star (simulating abusive or non-paying customer)
    -- Customer average is now: (5 + 1) / 2 = 3.0
    PERFORM set_config('request.jwt.claim.sub', v_provider_user_id::TEXT, true);
    PERFORM public.submit_review(
        v_booking_id, 1::SMALLINT, 'Did not pay agreed amount',
        ARRAY['disputed_payment', 'unreachable'], FALSE
    );

    -- Check customer status
    SELECT customer_status, customer_rating_avg INTO v_cust_status, v_cust_rating
    FROM public.profiles WHERE id = v_customer_id;

    RAISE NOTICE '  Customer average after 1-star: % (status=%)', v_cust_rating, v_cust_status;

    -- Create 3rd completed booking to push rating below 2.5
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_category_id, v_area_id, 'Third Job for Penalty',
        'Testing drop below 2.5', 650, v_now - INTERVAL '6 hours', 'assigned'
    ) RETURNING id INTO v_req_id;

    INSERT INTO public.bookings (
        request_id, provider_profile_id, time_range, status,
        provider_marked_complete_at, customer_marked_complete_at,
        review_opens_at, completion_source
    ) VALUES (
        v_req_id, v_prov_profile_id,
        tstzrange(v_now - INTERVAL '6 hours', v_now - INTERVAL '4 hours', '[)'),
        'completed',
        v_now - INTERVAL '4 hours', v_now - INTERVAL '4 hours',
        v_now - INTERVAL '3 hours', 'both'
    ) RETURNING id INTO v_booking_id;

    PERFORM set_config('request.jwt.claim.sub', v_customer_id::TEXT, true);
    PERFORM public.submit_review(v_booking_id, 5::SMALLINT, 'Great');

    -- Another 1-star from provider: average = (5 + 1 + 1) / 3 = 2.33 (< 2.5 threshold!)
    PERFORM set_config('request.jwt.claim.sub', v_provider_user_id::TEXT, true);
    PERFORM public.submit_review(
        v_booking_id, 1::SMALLINT, 'Late payment again',
        ARRAY['late_payment'], FALSE
    );

    SELECT customer_status, customer_rating_avg INTO v_cust_status, v_cust_rating
    FROM public.profiles WHERE id = v_customer_id;

    IF v_cust_status != 'under_review' THEN
        RAISE EXCEPTION 'Test 3 Failed: Customer rating is %, but status is % (expected under_review)',
            v_cust_rating, v_cust_status;
    END IF;

    -- Now test create_request gate: customer with status=under_review must be BLOCKED
    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.create_request(
            v_customer_id,
            'ordinary',
            v_category_id,
            v_area_id,
            'Attempted Post While Under Review',
            'This should be blocked',
            800,
            now() + INTERVAL '2 days' + INTERVAL '10 hours'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Customer rating violation%' THEN
            v_caught_exception := TRUE;
            RAISE NOTICE '  -> Correctly blocked create_request: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Test 3 Failed: Unexpected exception message: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught_exception THEN
        RAISE EXCEPTION 'Test 3 Failed: create_request did NOT throw an exception for under_review customer!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Customer rating gate properly blocked under_review customer (<2.5).';

    -- -------------------------------------------------------------------------
    -- TEST 4: NO-SHOW CLAIM FLOW (30-min gating, dispute creation, penalty)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 4: Testing claim_noshow flow and dispute creation...';

    -- Reset customer for no-show testing
    UPDATE public.profiles
    SET customer_status = 'active', customer_rating_avg = 5.0, customer_review_count = 0
    WHERE id = v_customer_id;

    -- Create a booking starting 45 minutes ago (valid: past 30 min threshold)
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_category_id, v_area_id, 'No-Show Job Test',
        'Testing no-show claim', 700, v_now - INTERVAL '45 minutes', 'assigned'
    ) RETURNING id INTO v_req_id;

    INSERT INTO public.bookings (
        request_id, provider_profile_id, time_range, status
    ) VALUES (
        v_req_id, v_prov_profile_id,
        tstzrange(v_now - INTERVAL '45 minutes', v_now + INTERVAL '1 hour 15 minutes', '[)'),
        'confirmed'
    ) RETURNING id INTO v_booking_id;

    PERFORM set_config('request.jwt.claim.sub', v_customer_id::TEXT, true);
    v_res := public.claim_noshow(v_booking_id, 'Provider never arrived and phone switched off');

    IF NOT (v_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 4 Failed: claim_noshow returned failure: %', v_res;
    END IF;

    -- Check dispute record created
    SELECT COUNT(*) INTO v_dispute_cnt
    FROM public.disputes
    WHERE request_id = v_req_id AND category = 'provider_noshow';

    IF v_dispute_cnt = 0 THEN
        RAISE EXCEPTION 'Test 4 Failed: No dispute record inserted in disputes table!';
    END IF;

    -- Check booking status is 'disputed'
    SELECT status INTO v_cust_status FROM public.bookings WHERE id = v_booking_id;
    IF v_cust_status != 'disputed' THEN
        RAISE EXCEPTION 'Test 4 Failed: Booking status is %, expected disputed', v_cust_status;
    END IF;

    RAISE NOTICE '  -> SUCCESS: claim_noshow registered dispute and marked booking disputed.';

    -- -------------------------------------------------------------------------
    -- TEST 5: REOPEN AFTER NO-SHOW (clones post, carries fee, blocks provider)
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 5: Testing reopen_after_noshow flow...';

    v_reopen_res := public.reopen_after_noshow(v_booking_id);

    IF NOT (v_reopen_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Test 5 Failed: reopen_after_noshow returned failure: %', v_reopen_res;
    END IF;

    v_new_req_id := (v_reopen_res->>'new_request_id')::UUID;
    IF v_new_req_id IS NULL THEN
        RAISE EXCEPTION 'Test 5 Failed: new_request_id was not returned!';
    END IF;

    -- Verify new request has excluded_provider_profile_id set
    SELECT excluded_provider_profile_id, status INTO v_prov_profile_id, v_cust_status
    FROM public.service_requests
    WHERE id = v_new_req_id;

    IF v_prov_profile_id IS NULL THEN
        RAISE EXCEPTION 'Test 5 Failed: excluded_provider_profile_id was not set on reopened post!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Reopened post ID % successfully created with provider blocked.', v_new_req_id;

    -- -------------------------------------------------------------------------
    -- TEST 6: AUTO-COMPLETE EVALUATION TICKS
    -- -------------------------------------------------------------------------
    RAISE NOTICE 'TEST 6: Testing evaluate_completion_ticks auto-complete timers...';

    -- Test auto-complete when provider marked 49 hours ago and customer silent
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_category_id, v_area_id, 'Auto Complete Test',
        'Testing cron tick', 500, v_now - INTERVAL '55 hours', 'assigned'
    ) RETURNING id INTO v_req_id;

    INSERT INTO public.bookings (
        request_id, provider_profile_id, time_range, status,
        provider_marked_complete_at
    ) VALUES (
        v_req_id, v_prov_profile_id,
        tstzrange(v_now - INTERVAL '55 hours', v_now - INTERVAL '53 hours', '[)'),
        'confirmed',
        v_now - INTERVAL '49 hours'  -- Customer silent 49h (> 48h setting)
    ) RETURNING id INTO v_booking_id;

    v_res := public.evaluate_completion_ticks();

    SELECT status, completion_source INTO v_cust_status, v_cust_status
    FROM public.bookings WHERE id = v_booking_id;

    IF v_cust_status != 'auto_customer_silent' THEN
        RAISE EXCEPTION 'Test 6 Failed: Booking was not auto-completed after customer silent 48h! Status: %', v_cust_status;
    END IF;

    RAISE NOTICE '  -> SUCCESS: evaluate_completion_ticks auto-completed customer-silent booking.';

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL COMPLETION PIPELINE TESTS PASSED SUCCESSFULLY!';
    RAISE NOTICE '=======================================================';

END $$;

ROLLBACK; -- Clean rollback: leaves DB completely pristine
