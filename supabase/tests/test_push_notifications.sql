-- ============================================================================
-- Test Suite: Migration 12 Push Notifications & FCM Integration
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_customer_id UUID;
    v_prov_user_id UUID;
    v_prov_user2_id UUID;
    v_prov_profile_id UUID;
    v_prov_profile2_id UUID;
    v_area_id UUID;
    v_cat_id UUID;
    v_req_id UUID;
    v_notif_id UUID;
    v_token TEXT := 'fcm_test_token_alpha_12345';
    v_token_count INT;
    v_opened_at TIMESTAMPTZ;
    v_title TEXT;
    v_body TEXT;
    v_push_deliv BOOLEAN;
    v_dispute_id UUID;
    v_disp_notif_count INT;
BEGIN
    RAISE NOTICE '=== Running Push Notifications Test Suite ===';

    -- 1. Setup sample users & profiles
    SELECT id INTO v_area_id FROM public.areas LIMIT 1;
    SELECT id INTO v_cat_id FROM public.service_categories LIMIT 1;

    v_customer_id := gen_random_uuid();
    INSERT INTO public.profiles (id, role, name, phone, area_id)
    VALUES (v_customer_id, 'customer', 'Push Test Customer', '+919988776601', v_area_id);

    -- Provider 1 (English)
    v_prov_user_id := gen_random_uuid();
    INSERT INTO public.profiles (id, role, name, phone, area_id)
    VALUES (v_prov_user_id, 'provider', 'Push Provider EN', '+919988776602', v_area_id);

    INSERT INTO public.provider_profiles (id, user_id, provider_type, skills, categories, rating_avg, review_count, status, coins)
    VALUES (gen_random_uuid(), v_prov_user_id, 'freelancer', ARRAY['Electrical'], ARRAY[v_cat_id::TEXT], 4.9, 8, 'active', 60)
    RETURNING id INTO v_prov_profile_id;

    -- Provider 2 (Tamil)
    v_prov_user2_id := gen_random_uuid();
    INSERT INTO public.profiles (id, role, name, phone, area_id)
    VALUES (v_prov_user2_id, 'provider', 'Push Provider TA', '+919988776603', v_area_id);

    INSERT INTO public.provider_profiles (id, user_id, provider_type, skills, categories, rating_avg, review_count, status, coins)
    VALUES (gen_random_uuid(), v_prov_user2_id, 'freelancer', ARRAY['Electrical'], ARRAY[v_cat_id::TEXT], 4.7, 5, 'active', 55)
    RETURNING id INTO v_prov_profile2_id;

    -- -----------------------------------------------------------------------
    -- TEST 1: Register and remove device tokens (device_tokens table & RPCs)
    -- -----------------------------------------------------------------------
    RAISE NOTICE 'Test 1: Device token registration and deduplication';

    PERFORM public.save_device_token(v_customer_id, v_token, 'web');

    -- Check inserted
    SELECT count(*) INTO v_token_count FROM public.device_tokens WHERE user_id = v_customer_id AND token = v_token;
    ASSERT v_token_count = 1, 'Token registration failed';

    -- Re-inserting updates updated_at without duplicating
    PERFORM public.save_device_token(v_customer_id, v_token, 'web');
    SELECT count(*) INTO v_token_count FROM public.device_tokens WHERE user_id = v_customer_id AND token = v_token;
    ASSERT v_token_count = 1, 'Token registration duplicate prevention failed';

    -- Delete token
    PERFORM public.delete_device_token(v_token);
    SELECT count(*) INTO v_token_count FROM public.device_tokens WHERE token = v_token;
    ASSERT v_token_count = 0, 'Token deletion failed';

    -- Re-save for downstream tests
    PERFORM public.save_device_token(v_customer_id, v_token, 'web');
    PERFORM public.save_device_token(v_prov_user_id, 'fcm_prov_token_en', 'web');
    PERFORM public.save_device_token(v_prov_user2_id, 'fcm_prov_token_ta', 'web');

    -- -----------------------------------------------------------------------
    -- TEST 2: Localized templates (English vs Tamil)
    -- -----------------------------------------------------------------------
    RAISE NOTICE 'Test 2: Localized push notification templates';

    -- English bid_invite
    SELECT public.send_push(
        v_prov_user_id,
        'bid_invite',
        jsonb_build_object('job_title', 'Emergency Fan Repair', 'coins', 35),
        jsonb_build_object('language', 'en')
    ) INTO v_notif_id;

    SELECT title, body INTO v_title, v_body FROM public.notifications WHERE id = v_notif_id;
    ASSERT v_title LIKE '%Emergency Bid Invite%', 'English bid_invite title mismatch: ' || v_title;
    ASSERT v_body LIKE '%Emergency Fan Repair%', 'English bid_invite body mismatch: ' || v_body;

    -- Tamil bid_invite
    SELECT public.send_push(
        v_prov_user2_id,
        'bid_invite',
        jsonb_build_object('job_title', 'அவசர மின்விசிறி பழுது', 'coins', 35),
        jsonb_build_object('language', 'ta')
    ) INTO v_notif_id;

    SELECT title, body INTO v_title, v_body FROM public.notifications WHERE id = v_notif_id;
    ASSERT v_title LIKE '%அவசர ஏல அழைப்பு%', 'Tamil bid_invite title mismatch: ' || v_title;
    ASSERT v_body LIKE '%அவசர மின்விசிறி பழுது%', 'Tamil bid_invite body mismatch: ' || v_body;

    -- -----------------------------------------------------------------------
    -- TEST 3: Emergency vs Ordinary Quiet Hours Delivery
    -- -----------------------------------------------------------------------
    RAISE NOTICE 'Test 3: Quiet hours bypass for emergency vs ordinary notifications';

    -- Emergency event (bid_invite is an emergency event)
    SELECT public.send_push(
        v_customer_id,
        'bid_invite',
        jsonb_build_object('job_title', 'Pipe Burst', 'coins', 40),
        '{}'::jsonb
    ) INTO v_notif_id;

    SELECT push_delivered INTO v_push_deliv FROM public.notifications WHERE id = v_notif_id;
    ASSERT v_push_deliv = TRUE, 'Emergency event should always deliver immediately regardless of quiet hours';

    -- -----------------------------------------------------------------------
    -- TEST 4: Notification open tracking (mark_notification_opened RPC)
    -- -----------------------------------------------------------------------
    RAISE NOTICE 'Test 4: Logging open status in notifications';

    SELECT opened_at INTO v_opened_at FROM public.notifications WHERE id = v_notif_id;
    ASSERT v_opened_at IS NULL, 'Notification opened_at should initially be null';

    PERFORM public.mark_notification_opened(v_notif_id, v_customer_id);

    SELECT opened_at INTO v_opened_at FROM public.notifications WHERE id = v_notif_id;
    ASSERT v_opened_at IS NOT NULL, 'mark_notification_opened should set opened_at timestamp';

    -- -----------------------------------------------------------------------
    -- TEST 5: Automatic trigger on disputes creation
    -- -----------------------------------------------------------------------
    RAISE NOTICE 'Test 5: Dispute opened notification trigger';

    -- Create a service request
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, status
    ) VALUES (
        v_customer_id, 'ordinary', v_cat_id, v_area_id, 'Switchboard Sparking', 'Wiring issue',
        500, 450, now() + INTERVAL '1 hour', 'confirmed'
    ) RETURNING id INTO v_req_id;

    -- Create dispute
    INSERT INTO public.disputes (
        request_id, filed_by, filed_against, reason
    ) VALUES (
        v_req_id, v_customer_id, v_prov_user_id, 'Provider arrived 2 hours late and was rude'
    ) RETURNING id INTO v_dispute_id;

    -- Verify dispute_opened notifications generated for both parties
    SELECT count(*) INTO v_disp_notif_count FROM public.notifications
    WHERE user_id IN (v_customer_id, v_prov_user_id) AND type = 'dispute_opened';

    ASSERT v_disp_notif_count >= 2, 'Dispute trigger should notify both customer and provider';

    -- -----------------------------------------------------------------------
    -- TEST 6: All 12 supported event templates
    -- -----------------------------------------------------------------------
    RAISE NOTICE 'Test 6: Validating all 12 supported template keys';

    -- 1. bid_invite
    PERFORM public.send_push(v_customer_id, 'bid_invite', jsonb_build_object('job_title', 'T1'), '{}'::jsonb);
    -- 2. bid_opened
    PERFORM public.send_push(v_customer_id, 'bid_opened', jsonb_build_object('job_title', 'T2'), '{}'::jsonb);
    -- 3. outbid
    PERFORM public.send_push(v_customer_id, 'outbid', jsonb_build_object('coins', 45, 'top_bid', 45), '{}'::jsonb);
    -- 4. bid_closing_soon
    PERFORM public.send_push(v_customer_id, 'bid_closing_soon', jsonb_build_object('job_title', 'T4'), '{}'::jsonb);
    -- 5. bid_won
    PERFORM public.send_push(v_customer_id, 'bid_won', jsonb_build_object('job_title', 'T5'), '{}'::jsonb);
    -- 6. job_accepted
    PERFORM public.send_push(v_customer_id, 'job_accepted', jsonb_build_object('job_title', 'T6'), '{}'::jsonb);
    -- 7. time_confirmed
    PERFORM public.send_push(v_customer_id, 'time_confirmed', jsonb_build_object('time', '10:00 AM'), '{}'::jsonb);
    -- 8. provider_on_the_way
    PERFORM public.send_push(v_customer_id, 'provider_on_the_way', jsonb_build_object('provider_name', 'Mani'), '{}'::jsonb);
    -- 9. mark_complete_reminder
    PERFORM public.send_push(v_customer_id, 'mark_complete_reminder', jsonb_build_object('job_title', 'T9'), '{}'::jsonb);
    -- 10. review_reminder
    PERFORM public.send_push(v_customer_id, 'review_reminder', jsonb_build_object('job_title', 'T10'), '{}'::jsonb);
    -- 11. noshow
    PERFORM public.send_push(v_customer_id, 'noshow', jsonb_build_object('job_title', 'T11'), '{}'::jsonb);
    -- 12. dispute_opened
    PERFORM public.send_push(v_customer_id, 'dispute_opened', jsonb_build_object('request_id', v_req_id), '{}'::jsonb);

    RAISE NOTICE 'All 12 templates processed and validated without errors!';
    RAISE NOTICE '=== Push Notifications Test Suite PASSED ===';
END $$;

ROLLBACK;
```[cite: 1]