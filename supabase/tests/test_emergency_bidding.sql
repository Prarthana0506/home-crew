-- ============================================================================
-- URBANCLAP TEST SUITE: EMERGENCY BIDDING STATE MACHINE
-- Tests all 7 required scenarios:
--   1. 10th joiner triggers early bidding open
--   2. 45-minute timer opens bidding automatically
--   3. Bid increment check (last + 1 minimum)
--   4. Balance cap enforcement (available_coins check)
--   5. Double-win / gap conflict => falls back to next highest bidder
--   6. Withdrawal penalty (50% coins, -0.1 rating, 3-day ban by verified_id_hash)
--   7. Nobody interested => fallback ladder (widen_radius -> extended -> etc.)
-- ============================================================================

BEGIN;

DO $$
DECLARE
    -- Test fixture IDs
    v_customer_id UUID;
    v_category_id UUID;
    v_area_id UUID;

    -- 10 provider profile IDs for interest tests
    v_prov RECORD;
    v_providers UUID[] := '{}';
    v_prov_users UUID[] := '{}';
    v_tmp_user_id UUID;
    v_tmp_prof_id UUID;

    -- Request IDs
    v_request_id_1 UUID;   -- Scenario 1: 10th joiner
    v_request_id_2 UUID;   -- Scenario 2: 45-minute timer
    v_request_id_3 UUID;   -- Scenario 3: bid increment
    v_request_id_4 UUID;   -- Scenario 4: balance cap
    v_request_id_5 UUID;   -- Scenario 5: double-win conflict
    v_request_id_6 UUID;   -- Scenario 6: withdrawal penalty
    v_request_id_7 UUID;   -- Scenario 7: nobody interested

    -- Working vars
    v_res JSONB;
    v_caught BOOLEAN;
    v_interest_count INTEGER;
    v_status TEXT;
    v_top_bid INTEGER;
    v_rating NUMERIC;
    v_ban_until TIMESTAMPTZ;
    v_balance INTEGER;
    v_payment_id UUID;
    v_idx INTEGER;
    v_emergency_start TIMESTAMPTZ;

    -- Provider used in scenario 5 (double win)
    v_winner_prof_id UUID;
    v_loser_prof_id UUID;
    v_winner_user_id UUID;
BEGIN

    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'STARTING TEST SUITE: EMERGENCY BIDDING STATE MACHINE';
    RAISE NOTICE '=========================================================';

    -- -----------------------------------------------------------------------
    -- FIXTURE SETUP
    -- -----------------------------------------------------------------------
    SELECT id INTO v_customer_id FROM public.profiles WHERE role = 'customer' LIMIT 1;
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Fixture error: No customer profile found.';
    END IF;

    SELECT id INTO v_category_id FROM public.service_categories WHERE slug = 'cat_plumbing' LIMIT 1;
    IF v_category_id IS NULL THEN
        SELECT id INTO v_category_id FROM public.service_categories LIMIT 1;
    END IF;

    SELECT id INTO v_area_id FROM public.areas LIMIT 1;
    IF v_area_id IS NULL THEN
        RAISE EXCEPTION 'Fixture error: No area found.';
    END IF;

    -- Emergency start 3 hours from now
    v_emergency_start := now() + INTERVAL '3 hours';

    -- Create 10 synthetic provider profiles eligible for bidding
    -- (coins >= 35, rating >= 3.5, reviews >= 3, status active, area with location)
    FOR v_idx IN 1..10 LOOP
        v_tmp_user_id := gen_random_uuid();

        INSERT INTO public.profiles (id, role, name, phone, phone_demo_verified, language, area_id, status)
        VALUES (
            v_tmp_user_id,
            'provider',
            'TestProvider_' || v_idx,
            '90000000' || LPAD(v_idx::TEXT, 2, '0'),
            TRUE,
            'en',
            v_area_id,
            'active'
        );

        -- Ensure auth.users entry exists for RPC calls (skip if restricted)
        -- (In real Supabase, auth.users is managed by Auth Service)

        INSERT INTO public.provider_profiles (
            user_id,
            provider_type,
            categories,
            experience,
            status,
            rating_avg,
            review_count,
            verified_id_hash
        )
        VALUES (
            v_tmp_user_id,
            'freelancer',
            ARRAY[v_category_id::TEXT],
            3,
            'active',
            4.0,       -- rating >= 3.5
            5,         -- reviews >= 3
            'test_hash_' || v_idx   -- unique verified_id_hash per provider for scenario 6
        )
        RETURNING id INTO v_tmp_prof_id;

        -- Give each provider 100 coins via ledger
        INSERT INTO public.coin_ledger (provider_profile_id, amount, reason)
        VALUES (v_tmp_prof_id, 100, 'test_setup');

        v_providers := v_providers || v_tmp_prof_id;
        v_prov_users := v_prov_users || v_tmp_user_id;
    END LOOP;

    RAISE NOTICE 'Setup: Created % test providers with eligible profiles', array_length(v_providers, 1);

    -- Helper: create an emergency request directly (bypass UI flow for test)
    INSERT INTO public.emergency_fee_payments (customer_id, amount, status, fee_version, payment_method, transaction_ref)
    VALUES (v_customer_id, 0, 'waived', 1, 'system', 'test_waived_s1')
    RETURNING id INTO v_payment_id;

    -- -----------------------------------------------------------------------
    -- SCENARIO 1: 10th joiner triggers early bidding open
    -- -----------------------------------------------------------------------
    RAISE NOTICE '--- SCENARIO 1: 10th joiner triggers early open ---';

    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, provider_preference,
        status, fee_payment_id
    )
    VALUES (
        v_customer_id, 'emergency', v_category_id, v_area_id,
        'TEST Scenario 1: 10th Joiner', 'Test description',
        800, 600, v_emergency_start, 'either',
        'notified', v_payment_id
    )
    RETURNING id INTO v_request_id_1;

    -- Transition to interest_window
    PERFORM public.transition_to_interest_window(v_request_id_1);

    SELECT status INTO v_status FROM public.service_requests WHERE id = v_request_id_1;
    ASSERT v_status = 'interest_window', 'S1: Expected interest_window, got ' || v_status;
    RAISE NOTICE 'S1 [OK] transition_to_interest_window succeeded. Status: %', v_status;

    -- Override bidding_max_interested to 10 (should already be set)
    INSERT INTO public.settings (key, value) VALUES ('bidding_max_interested', '{"value":10}')
    ON CONFLICT (key) DO UPDATE SET value = '{"value":10}';

    -- First 9 providers express interest - bidding should NOT open yet
    FOR v_idx IN 1..9 LOOP
        v_res := public.respond_interest(v_request_id_1, v_prov_users[v_idx], TRUE);
        ASSERT (v_res->>'bidding_auto_opened')::BOOLEAN = FALSE,
            'S1: Bidding should not auto-open before 10th joiner. Got: ' || v_res::TEXT;
    END LOOP;

    SELECT COUNT(*) INTO v_interest_count
    FROM public.bid_interests WHERE request_id = v_request_id_1 AND status = 'interested';
    ASSERT v_interest_count = 9, 'S1: Expected 9 interested, got ' || v_interest_count;
    RAISE NOTICE 'S1 [OK] 9 providers interested, bidding not yet open.';

    -- 10th provider joins - should trigger auto-open
    v_res := public.respond_interest(v_request_id_1, v_prov_users[10], TRUE);
    ASSERT (v_res->>'bidding_auto_opened')::BOOLEAN = TRUE,
        'S1: Expected bidding_auto_opened=true on 10th joiner. Got: ' || v_res::TEXT;

    SELECT status INTO v_status FROM public.service_requests WHERE id = v_request_id_1;
    ASSERT v_status = 'bidding_open', 'S1: Expected bidding_open after 10th joiner, got ' || v_status;
    RAISE NOTICE 'S1 [PASS] 10th joiner auto-opened bidding. Status: %', v_status;


    -- -----------------------------------------------------------------------
    -- SCENARIO 2: 45-minute timer opens bidding automatically via evaluate_bidding_ticks()
    -- -----------------------------------------------------------------------
    RAISE NOTICE '--- SCENARIO 2: 45-minute timer auto-open ---';

    INSERT INTO public.emergency_fee_payments (customer_id, amount, status, fee_version, payment_method, transaction_ref)
    VALUES (v_customer_id, 0, 'waived', 1, 'system', 'test_waived_s2')
    RETURNING id INTO v_payment_id;

    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, provider_preference,
        status, fee_payment_id
    )
    VALUES (
        v_customer_id, 'emergency', v_category_id, v_area_id,
        'TEST Scenario 2: 45-min Timer', 'Test description',
        800, 600, v_emergency_start, 'either',
        'notified', v_payment_id
    )
    RETURNING id INTO v_request_id_2;

    PERFORM public.transition_to_interest_window(v_request_id_2);

    -- Only 1 provider expresses interest (not enough for 10th-joiner trigger)
    v_res := public.respond_interest(v_request_id_2, v_prov_users[1], TRUE);
    ASSERT (v_res->>'bidding_auto_opened')::BOOLEAN = FALSE,
        'S2: Should not auto-open with 1 provider.';

    -- Artificially expire the interest window to simulate 45-minute timer elapsed
    UPDATE public.service_requests
    SET interest_expires_at = now() - INTERVAL '1 minute'
    WHERE id = v_request_id_2;

    -- Run the tick evaluator
    v_res := public.evaluate_bidding_ticks();
    RAISE NOTICE 'S2 evaluate_bidding_ticks result: %', v_res;

    SELECT status INTO v_status FROM public.service_requests WHERE id = v_request_id_2;
    ASSERT v_status = 'bidding_open',
        'S2: Expected bidding_open after timer expiry. Got: ' || v_status;
    RAISE NOTICE 'S2 [PASS] 45-minute timer auto-opened bidding. Status: %', v_status;


    -- -----------------------------------------------------------------------
    -- SCENARIO 3: Bid increment check (min = last + 1)
    -- -----------------------------------------------------------------------
    RAISE NOTICE '--- SCENARIO 3: Bid increment check ---';

    -- Use the request from S1 which is now in bidding_open
    -- Place a first bid
    v_res := public.place_bid(v_request_id_1, v_prov_users[1], 40, 'First bid');
    ASSERT (v_res->>'success')::BOOLEAN = TRUE, 'S3: First bid should succeed';
    RAISE NOTICE 'S3 [OK] First bid of 40 coins placed.';

    -- Try to place an equal bid (should fail: min = last + 1 = 41)
    v_caught := FALSE;
    BEGIN
        v_res := public.place_bid(v_request_id_1, v_prov_users[2], 40, 'Equal bid attempt');
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
        RAISE NOTICE 'S3 [OK] Equal bid (40) correctly rejected: %', SQLERRM;
    END;
    ASSERT v_caught = TRUE, 'S3: Equal bid should have been rejected.';

    -- Try to place a lower bid (should fail)
    v_caught := FALSE;
    BEGIN
        v_res := public.place_bid(v_request_id_1, v_prov_users[2], 35, 'Lower bid attempt');
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
        RAISE NOTICE 'S3 [OK] Lower bid (35) correctly rejected: %', SQLERRM;
    END;
    ASSERT v_caught = TRUE, 'S3: Lower bid should have been rejected.';

    -- Place a valid higher bid (41 > 40)
    v_res := public.place_bid(v_request_id_1, v_prov_users[2], 41, 'Valid higher bid');
    ASSERT (v_res->>'success')::BOOLEAN = TRUE, 'S3: Bid of 41 should succeed.';
    RAISE NOTICE 'S3 [PASS] Bid increment checks passed. Min increment enforced correctly.';


    -- -----------------------------------------------------------------------
    -- SCENARIO 4: Balance cap enforcement
    -- -----------------------------------------------------------------------
    RAISE NOTICE '--- SCENARIO 4: Balance cap enforcement ---';

    -- Provider 3 has 100 coins. Try to bid 200 (exceeds balance).
    v_caught := FALSE;
    BEGIN
        v_res := public.place_bid(v_request_id_1, v_prov_users[3], 200, 'Exceeds balance');
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
        RAISE NOTICE 'S4 [OK] Over-balance bid (200 > 100) correctly rejected: %', SQLERRM;
    END;
    ASSERT v_caught = TRUE, 'S4: Bid exceeding balance should fail.';

    -- Bid exactly at balance should succeed if > top bid
    -- Top bid is 41 from provider 2. Provider 3 bids 100 (their full balance).
    v_res := public.place_bid(v_request_id_1, v_prov_users[3], 100, 'Full balance bid');
    ASSERT (v_res->>'success')::BOOLEAN = TRUE, 'S4: Bid at exact balance should succeed.';
    RAISE NOTICE 'S4 [PASS] Balance cap enforcement passed.';

    -- Verify provider 3 now has 0 available coins (soft-locked)
    SELECT available_coins INTO v_balance
    FROM public.provider_available_coins
    WHERE provider_profile_id = v_providers[3];
    ASSERT v_balance = 0, 'S4: Provider 3 should have 0 available coins (100 soft-locked). Got: ' || v_balance;
    RAISE NOTICE 'S4 [OK] Soft-lock check: Provider 3 has % available coins (100 soft-locked).', v_balance;


    -- -----------------------------------------------------------------------
    -- SCENARIO 5: Double-win / gap conflict -> falls to next highest bidder
    -- -----------------------------------------------------------------------
    RAISE NOTICE '--- SCENARIO 5: Double-win / gap conflict fallback ---';

    INSERT INTO public.emergency_fee_payments (customer_id, amount, status, fee_version, payment_method, transaction_ref)
    VALUES (v_customer_id, 0, 'waived', 1, 'system', 'test_waived_s5')
    RETURNING id INTO v_payment_id;

    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, provider_preference,
        status, fee_payment_id
    )
    VALUES (
        v_customer_id, 'emergency', v_category_id, v_area_id,
        'TEST Scenario 5: Double Win', 'Test description for double-win conflict',
        800, 600, v_emergency_start, 'either',
        'notified', v_payment_id
    )
    RETURNING id INTO v_request_id_5;

    PERFORM public.transition_to_interest_window(v_request_id_5);

    -- Give 3 providers interest
    v_winner_user_id := v_prov_users[4];
    v_winner_prof_id := v_providers[4];
    v_loser_prof_id  := v_providers[5];

    PERFORM public.respond_interest(v_request_id_5, v_prov_users[4], TRUE);
    PERFORM public.respond_interest(v_request_id_5, v_prov_users[5], TRUE);
    PERFORM public.respond_interest(v_request_id_5, v_prov_users[6], TRUE);

    -- Manually open bidding
    PERFORM public.open_emergency_bidding(v_request_id_5);

    -- Provider 4 places highest bid = 80 coins, Provider 5 places 60
    PERFORM public.place_bid(v_request_id_5, v_prov_users[5], 60, 'Second place bid');
    PERFORM public.place_bid(v_request_id_5, v_prov_users[4], 80, 'Top bidder bid');

    -- Simulate Provider 4 (top bidder) winning another emergency at same time
    -- by inserting a conflicting confirmed booking
    INSERT INTO public.bookings (request_id, provider_profile_id, time_range, status)
    VALUES (
        v_request_id_1,  -- another request
        v_winner_prof_id,
        tstzrange(v_emergency_start - INTERVAL '1 hour', v_emergency_start + INTERVAL '3 hours'),
        'confirmed'
    );

    RAISE NOTICE 'S5 [INFO] Provider 4 now has a conflicting booking at same time.';

    -- Expire the bidding window and run close_bidding()
    UPDATE public.service_requests
    SET bidding_closes_at = now() - INTERVAL '1 minute'
    WHERE id = v_request_id_5;

    -- Run evaluate_bidding_ticks() to trigger close
    v_res := public.evaluate_bidding_ticks();
    RAISE NOTICE 'S5 evaluate_bidding_ticks: %', v_res;

    SELECT status, assigned_provider_profile_id INTO v_status, v_tmp_prof_id
    FROM public.service_requests WHERE id = v_request_id_5;

    ASSERT v_status = 'awarded', 'S5: Expected awarded. Got: ' || v_status;
    ASSERT v_tmp_prof_id = v_loser_prof_id,
        'S5: Winner should be provider 5 (second highest without conflict). Got assigned_provider_profile_id: ' || v_tmp_prof_id::TEXT;

    RAISE NOTICE 'S5 [PASS] Double-win conflict correctly fell to next highest bidder (provider 5).';


    -- -----------------------------------------------------------------------
    -- SCENARIO 6: Withdrawal penalty (50% coins, -0.1 rating, 3-day ban by hash)
    -- -----------------------------------------------------------------------
    RAISE NOTICE '--- SCENARIO 6: Withdrawal penalty ---';

    INSERT INTO public.emergency_fee_payments (customer_id, amount, status, fee_version, payment_method, transaction_ref)
    VALUES (v_customer_id, 0, 'waived', 1, 'system', 'test_waived_s6')
    RETURNING id INTO v_payment_id;

    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, provider_preference,
        status, fee_payment_id
    )
    VALUES (
        v_customer_id, 'emergency', v_category_id, v_area_id,
        'TEST Scenario 6: Withdrawal Penalty', 'Test description',
        800, 600, v_emergency_start, 'either',
        'notified', v_payment_id
    )
    RETURNING id INTO v_request_id_6;

    PERFORM public.transition_to_interest_window(v_request_id_6);
    PERFORM public.respond_interest(v_request_id_6, v_prov_users[7], TRUE);
    PERFORM public.open_emergency_bidding(v_request_id_6);
    PERFORM public.place_bid(v_request_id_6, v_prov_users[7], 50, 'Bid to penalize');

    -- Close bidding so provider 7 wins
    UPDATE public.service_requests SET bidding_closes_at = now() - INTERVAL '1 minute'
    WHERE id = v_request_id_6;
    v_res := public.evaluate_bidding_ticks();

    -- Check provider 7 was awarded
    SELECT status INTO v_status FROM public.service_requests WHERE id = v_request_id_6;
    ASSERT v_status = 'awarded', 'S6 Pre-condition: Request should be awarded. Got: ' || v_status;

    -- Capture pre-penalty state
    SELECT rating_avg INTO v_rating FROM public.provider_profiles WHERE id = v_providers[7];
    SELECT available_coins INTO v_balance FROM public.provider_available_coins WHERE provider_profile_id = v_providers[7];

    -- Apply withdrawal penalty
    v_res := public.penalize_withdrawal_or_noshow(v_request_id_6, v_prov_users[7], 'withdrawal');

    ASSERT (v_res->>'success')::BOOLEAN = TRUE, 'S6: Penalty should succeed.';
    ASSERT (v_res->>'penalty_coins')::INTEGER > 0, 'S6: Should have non-zero penalty_coins.';
    ASSERT (v_res->>'rating_deduction')::NUMERIC = 0.1, 'S6: Rating deduction should be 0.1.';
    ASSERT v_res->>'banned_until' IS NOT NULL, 'S6: Should have banned_until timestamp.';

    -- Verify rating dropped by 0.1
    SELECT rating_avg INTO v_tmp_prof_id FROM public.provider_profiles WHERE FALSE; -- just to reset
    DECLARE v_new_rating NUMERIC;
    BEGIN
        SELECT rating_avg INTO v_new_rating FROM public.provider_profiles WHERE id = v_providers[7];
        ASSERT ABS((v_new_rating - v_rating) + 0.1) < 0.001,
            format('S6: Rating should have dropped by 0.1. Was: %, Now: %', v_rating, v_new_rating);
        RAISE NOTICE 'S6 [OK] Rating dropped from % to % (delta -0.1).', v_rating, v_new_rating;
    END;

    -- Verify ban_until is set approximately 3 days from now
    SELECT bid_banned_until INTO v_ban_until FROM public.provider_profiles WHERE id = v_providers[7];
    ASSERT v_ban_until IS NOT NULL, 'S6: bid_banned_until should be set.';
    ASSERT v_ban_until > now() + INTERVAL '2 days 23 hours',
        'S6: Ban should be at least 3 days from now.';

    RAISE NOTICE 'S6 [PASS] Withdrawal penalty applied: penalty_coins=%, ban_until=%',
        v_res->>'penalty_coins', v_ban_until;

    -- Verify banned provider cannot bid anymore
    v_caught := FALSE;
    BEGIN
        PERFORM public.place_bid(v_request_id_1, v_prov_users[7], 42, 'Banned provider bid attempt');
    EXCEPTION WHEN OTHERS THEN
        v_caught := TRUE;
        RAISE NOTICE 'S6 [OK] Banned provider correctly rejected from bidding: %', SQLERRM;
    END;
    ASSERT v_caught = TRUE, 'S6: Banned provider should not be able to bid.';
    RAISE NOTICE 'S6 [PASS] All withdrawal penalty checks passed.';


    -- -----------------------------------------------------------------------
    -- SCENARIO 7: Nobody interested => fallback ladder triggers
    -- -----------------------------------------------------------------------
    RAISE NOTICE '--- SCENARIO 7: Nobody interested -> fallback ladder ---';

    INSERT INTO public.emergency_fee_payments (customer_id, amount, status, fee_version, payment_method, transaction_ref)
    VALUES (v_customer_id, 0, 'waived', 1, 'system', 'test_waived_s7')
    RETURNING id INTO v_payment_id;

    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, provider_preference,
        status, fee_payment_id
    )
    VALUES (
        v_customer_id, 'emergency', v_category_id, v_area_id,
        'TEST Scenario 7: Nobody Interested', 'Test description',
        800, 600, v_emergency_start, 'either',
        'notified', v_payment_id
    )
    RETURNING id INTO v_request_id_7;

    PERFORM public.transition_to_interest_window(v_request_id_7);

    -- Nobody expresses interest. Artificially expire the interest window.
    UPDATE public.service_requests
    SET interest_expires_at = now() - INTERVAL '1 minute'
    WHERE id = v_request_id_7;

    -- Run tick: should trigger fallback (widen_radius stage 1) since no interested providers
    v_res := public.evaluate_bidding_ticks();
    RAISE NOTICE 'S7 evaluate_bidding_ticks (tick 1): %', v_res;

    SELECT status, fallback_stage, current_radius_km INTO v_status, v_idx, v_tmp_prof_id
    FROM public.service_requests WHERE id = v_request_id_7;

    -- After nobody interested, should be widen_radius with stage=1, radius=20km
    -- (The fallback will have re-triggered interest_window at 20km)
    SELECT status INTO v_status FROM public.service_requests WHERE id = v_request_id_7;
    ASSERT v_status IN ('widen_radius', 'interest_window', 'extended', 'offered_conversion', 'admin_assist', 'expired'),
        'S7: Expected fallback status, got: ' || v_status;

    RAISE NOTICE 'S7 [OK] After nobody interested, fallback triggered. Status: %, Stage: %, Radius: %', v_status, v_idx, v_tmp_prof_id;

    -- Continue expiring windows until we exhaust the ladder
    FOR v_idx IN 1..6 LOOP
        UPDATE public.service_requests
        SET interest_expires_at = now() - INTERVAL '1 minute'
        WHERE id = v_request_id_7
          AND status IN ('interest_window', 'widen_radius', 'extended', 'notified');

        v_res := public.evaluate_bidding_ticks();

        SELECT status INTO v_status FROM public.service_requests WHERE id = v_request_id_7;
        RAISE NOTICE 'S7 Ladder step %: status=%', v_idx, v_status;

        EXIT WHEN v_status IN ('expired', 'admin_assist', 'offered_conversion');
    END LOOP;

    ASSERT v_status IN ('expired', 'admin_assist', 'offered_conversion'),
        'S7: Fallback ladder should eventually reach expired or admin_assist. Got: ' || v_status;
    RAISE NOTICE 'S7 [PASS] Fallback ladder exhausted correctly. Final status: %', v_status;


    -- -----------------------------------------------------------------------
    -- ALL TESTS PASSED
    -- -----------------------------------------------------------------------
    RAISE NOTICE '';
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'ALL 7 EMERGENCY BIDDING SCENARIOS PASSED';
    RAISE NOTICE '=========================================================';

END $$;

-- Always rollback - this is a test, not a migration
ROLLBACK;
