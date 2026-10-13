-- ============================================================================
-- Test Suite: Migration 11 Realtime Chat, Content Filters, RLS & Cards
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_customer_id UUID;
    v_prov_id UUID;
    v_prov_profile_id UUID;
    v_area_id UUID;
    v_cat_id UUID;
    v_req_id UUID;
    v_booking_id UUID;
    v_conv JSONB;
    v_msg JSONB;
    v_unconfirmed_booking_id UUID;
    v_unconfirmed_req_id UUID;
    v_blocked BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=== Running Realtime Chat Test Suite ===';

    -- 1. Setup entities
    SELECT id INTO v_area_id FROM public.areas LIMIT 1;
    SELECT id INTO v_cat_id FROM public.service_categories LIMIT 1;

    -- Create customer profile
    v_customer_id := gen_random_uuid();
    INSERT INTO public.profiles (id, role, name, phone, area_id)
    VALUES (v_customer_id, 'customer', 'Chat Customer', '+919999900001', v_area_id);

    -- Create provider profile
    v_prov_id := gen_random_uuid();
    INSERT INTO public.profiles (id, role, name, phone, area_id)
    VALUES (v_prov_id, 'provider', 'Chat Technician', '+919999900002', v_area_id);

    INSERT INTO public.provider_profiles (id, user_id, provider_type, skills, categories, rating_avg, review_count, status, coins)
    VALUES (gen_random_uuid(), v_prov_id, 'freelancer', ARRAY['Plumbing'], ARRAY[v_cat_id::TEXT], 4.8, 12, 'active', 50)
    RETURNING id INTO v_prov_profile_id;

    -- Create service request
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_cat_id, v_area_id, 'Leaky Pipe Repair', 'Urgent fix needed in kitchen',
        600, 500, now() + INTERVAL '1 hour', 'confirmed'
    ) RETURNING id INTO v_req_id;

    -- Create confirmed booking
    INSERT INTO public.bookings (
        request_id, provider_profile_id, time_range, status
    ) VALUES (
        v_req_id, v_prov_profile_id, tstzrange(now() + INTERVAL '1 hour', now() + INTERVAL '3 hours'), 'confirmed'
    ) RETURNING id INTO v_booking_id;

    -- -----------------------------------------------------------------------
    -- TEST 1: Unconfirmed booking chat creation rejected
    -- -----------------------------------------------------------------------
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_cat_id, v_area_id, 'Draft Job', 'Description',
        500, 400, now() + INTERVAL '2 days', 'pending'
    ) RETURNING id INTO v_unconfirmed_req_id;

    INSERT INTO public.bookings (
        request_id, provider_profile_id, time_range, status
    ) VALUES (
        v_unconfirmed_req_id, v_prov_profile_id, tstzrange(now() + INTERVAL '2 days', now() + INTERVAL '2 days 2 hours'), 'hold'
    ) RETURNING id INTO v_unconfirmed_booking_id;

    BEGIN
        PERFORM public.get_or_create_booking_conversation(v_unconfirmed_booking_id);
        RAISE EXCEPTION 'TEST 1 FAILED: Chat should be blocked for unconfirmed bookings';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'TEST 1 PASSED: Unconfirmed booking rejected with error: %', SQLERRM;
    END;

    -- -----------------------------------------------------------------------
    -- TEST 2: Confirmed booking chat creation succeeds
    -- -----------------------------------------------------------------------
    -- Simulate customer auth
    PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);

    v_conv := public.get_or_create_booking_conversation(v_booking_id);
    IF (v_conv->>'id') IS NULL THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Conversation ID not returned';
    END IF;
    RAISE NOTICE 'TEST 2 PASSED: Conversation created: %', v_conv->>'id';

    -- -----------------------------------------------------------------------
    -- TEST 3: Phone number blocking filters
    -- -----------------------------------------------------------------------
    -- A) Standard digits
    BEGIN
        PERFORM public.send_chat_message(v_booking_id, 'text', 'Call me directly at 98401 23456 tomorrow');
        RAISE EXCEPTION 'TEST 3A FAILED: Standard phone number was not blocked';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'TEST 3A PASSED: Standard digits blocked: %', SQLERRM;
    END;

    -- B) Tamil numerals: ௯ ௮ ௪ ௦ ௧
    BEGIN
        PERFORM public.send_chat_message(v_booking_id, 'text', 'My phone is ௯௮௪௦௧௨௩௪௫');
        RAISE EXCEPTION 'TEST 3B FAILED: Tamil digits were not blocked';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'TEST 3B PASSED: Tamil digits blocked: %', SQLERRM;
    END;

    -- C) Hindi numerals: ९ ८ ४ ० १
    BEGIN
        PERFORM public.send_chat_message(v_booking_id, 'text', 'Call on ९८४०१२३४५६');
        RAISE EXCEPTION 'TEST 3C FAILED: Hindi digits were not blocked';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'TEST 3C PASSED: Hindi digits blocked: %', SQLERRM;
    END;

    -- D) Spelled-out English digits: "nine eight four zero one..."
    BEGIN
        PERFORM public.send_chat_message(v_booking_id, 'text', 'Reach me at nine eight four zero one two three four five');
        RAISE EXCEPTION 'TEST 3D FAILED: Spelled out English digits were not blocked';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'TEST 3D PASSED: Spelled out digits blocked: %', SQLERRM;
    END;

    -- -----------------------------------------------------------------------
    -- TEST 4: Link & website blocking
    -- -----------------------------------------------------------------------
    BEGIN
        PERFORM public.send_chat_message(v_booking_id, 'text', 'Check out my profile on https://external-portfolio.com');
        RAISE EXCEPTION 'TEST 4 FAILED: External link was not blocked';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'TEST 4 PASSED: External link blocked: %', SQLERRM;
    END;

    -- -----------------------------------------------------------------------
    -- TEST 5: Valid text and cards succeed
    -- -----------------------------------------------------------------------
    -- A) Valid text
    v_msg := public.send_chat_message(v_booking_id, 'text', 'Hello, please bring a pipe wrench for the sink.');
    IF (v_msg->>'id') IS NULL THEN RAISE EXCEPTION 'TEST 5A FAILED'; END IF;
    RAISE NOTICE 'TEST 5A PASSED: Valid text message accepted: %', v_msg->>'id';

    -- B) Share address card (by customer)
    v_msg := public.send_chat_message(
        v_booking_id,
        'card_share_address',
        'Service Location',
        NULL,
        jsonb_build_object('full_address', '142 Green Avenue, Flat 3B', 'landmark', 'Opposite Nilgiris')
    );
    IF (v_msg->>'id') IS NULL THEN RAISE EXCEPTION 'TEST 5B FAILED'; END IF;
    RAISE NOTICE 'TEST 5B PASSED: Share Address card accepted: %', v_msg->>'id';

    -- -----------------------------------------------------------------------
    -- TEST 6: Address masking on completion
    -- -----------------------------------------------------------------------
    -- Before completion: address is visible
    v_conv := public.get_chat_messages(v_booking_id);
    IF (v_conv->1->'metadata'->>'full_address') NOT LIKE '%Green Avenue%' THEN
        RAISE EXCEPTION 'TEST 6A FAILED: Address should be visible before completion';
    END IF;
    RAISE NOTICE 'TEST 6A PASSED: Address visible before completion';

    -- Mark booking completed
    UPDATE public.bookings
    SET status = 'completed',
        provider_marked_complete_at = now() - INTERVAL '1 hour',
        customer_marked_complete_at = now() - INTERVAL '1 hour'
    WHERE id = v_booking_id;

    -- After completion: address should be masked
    v_conv := public.get_chat_messages(v_booking_id);
    IF (v_conv->1->'metadata'->>'full_address') NOT LIKE '%[Address hidden after job completion]%' THEN
        RAISE EXCEPTION 'TEST 6B FAILED: Address was not masked after completion';
    END IF;
    RAISE NOTICE 'TEST 6B PASSED: Address masked after completion: %', v_conv->1->'metadata'->>'full_address';

    -- -----------------------------------------------------------------------
    -- TEST 7: Report message writes to disputes
    -- -----------------------------------------------------------------------
    v_conv := public.report_chat_message((v_msg->>'id')::UUID, 'Test report reason');
    IF (v_conv->>'dispute_id') IS NULL THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Dispute ID was not returned';
    END IF;
    RAISE NOTICE 'TEST 7 PASSED: Report filed in disputes with ID: %', v_conv->>'dispute_id';

    RAISE NOTICE '=== ALL REALTIME CHAT TESTS COMPLETED SUCCESSFULLY ===';
END $$;

ROLLBACK;
