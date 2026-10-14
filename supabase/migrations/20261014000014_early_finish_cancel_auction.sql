-- ============================================================================
-- MIGRATION: Early Finish Toggle, Cancel Penalties, Immediate Auction
-- ============================================================================

-- 1. Insert settings for new admin toggles (if not already present)
INSERT INTO public.settings (key, value, description)
VALUES 
  ('allow_early_finish', '{"value": false}'::jsonb, 'When true, customer and provider see a Finish button immediately after posting, regardless of scheduled time')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, description)
VALUES 
  ('immediate_auction', '{"value": false}'::jsonb, 'When true, admin can force-close auction even if min participants/time not met')
ON CONFLICT (key) DO NOTHING;

-- 2. Add finish tracking columns to service_requests
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS customer_marked_finished BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provider_marked_finished BOOLEAN DEFAULT FALSE;

-- 3. RPC: admin_get_allow_early_finish
CREATE OR REPLACE FUNCTION public.admin_get_allow_early_finish()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE
  v_val BOOLEAN;
BEGIN
  SELECT (value->>'value')::boolean INTO v_val
  FROM public.settings
  WHERE key = 'allow_early_finish';
  RETURN jsonb_build_object('enabled', COALESCE(v_val, false));
END;
$func$;

-- 4. RPC: admin_set_allow_early_finish
CREATE OR REPLACE FUNCTION public.admin_set_allow_early_finish(p_enabled BOOLEAN)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
BEGIN
  INSERT INTO public.settings (key, value, description)
  VALUES ('allow_early_finish', jsonb_build_object('value', p_enabled), 'Early finish toggle')
  ON CONFLICT (key) DO UPDATE SET value = jsonb_build_object('value', p_enabled), updated_at = now();
  RETURN jsonb_build_object('success', true, 'enabled', p_enabled);
END;
$func$;

-- 5. RPC: admin_get_immediate_auction
CREATE OR REPLACE FUNCTION public.admin_get_immediate_auction()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE
  v_val BOOLEAN;
BEGIN
  SELECT (value->>'value')::boolean INTO v_val
  FROM public.settings
  WHERE key = 'immediate_auction';
  RETURN jsonb_build_object('enabled', COALESCE(v_val, false));
END;
$func$;

-- 6. RPC: admin_set_immediate_auction
CREATE OR REPLACE FUNCTION public.admin_set_immediate_auction(p_enabled BOOLEAN)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
BEGIN
  INSERT INTO public.settings (key, value, description)
  VALUES ('immediate_auction', jsonb_build_object('value', p_enabled), 'Immediate auction toggle')
  ON CONFLICT (key) DO UPDATE SET value = jsonb_build_object('value', p_enabled), updated_at = now();
  RETURN jsonb_build_object('success', true, 'enabled', p_enabled);
END;
$func$;

-- 7. RPC: admin_finish_auction_now
-- Forces completion of bidding round even if min participants or time not met.
-- Highest bidder wins immediately.
CREATE OR REPLACE FUNCTION public.admin_finish_auction_now(p_request_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE
  v_top_bid RECORD;
  v_req RECORD;
  v_booking_id UUID;
BEGIN
  SELECT * INTO v_req
  FROM public.service_requests
  WHERE id = p_request_id;

  IF v_req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.status NOT IN ('interest_window', 'bidding_open', 'notified', 'widen_radius', 'extended', 'bidding_active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not in a biddable state: ' || v_req.status);
  END IF;

  -- Select top active bid by highest coins
  SELECT b.* INTO v_top_bid
  FROM public.bids b
  WHERE b.request_id = p_request_id
    AND b.status = 'active'
  ORDER BY b.coins DESC
  LIMIT 1;

  IF v_top_bid IS NULL THEN
    UPDATE public.service_requests
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'message', 'No active bids found; auction cancelled');
  END IF;

  -- Award request to the highest bidder
  UPDATE public.service_requests
  SET status = 'assigned',
      assigned_provider_profile_id = v_top_bid.provider_profile_id,
      bidding_closes_at = now(),
      top_bid_coins = v_top_bid.coins,
      top_bid_provider_profile_id = v_top_bid.provider_profile_id,
      updated_at = now()
  WHERE id = p_request_id;

  -- Mark winning and losing bids
  UPDATE public.bids SET status = 'won' WHERE id = v_top_bid.id;
  UPDATE public.bids SET status = 'lost' WHERE request_id = p_request_id AND id <> v_top_bid.id;

  -- Deduct/lock winning bid coins in ledger
  INSERT INTO public.coin_ledger (provider_profile_id, amount, reason, request_id)
  VALUES (
    v_top_bid.provider_profile_id,
    -v_top_bid.coins,
    'Won emergency auction: ' || v_top_bid.coins || ' coins locked',
    p_request_id
  );

  -- Create confirmed booking for the winning provider
  INSERT INTO public.bookings (request_id, provider_profile_id, time_range, status)
  VALUES (
    p_request_id,
    v_top_bid.provider_profile_id,
    tstzrange(
      COALESCE(v_req.preferred_start, now()),
      COALESCE(v_req.preferred_start, now()) + interval '2 hours'
    ),
    'confirmed'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_booking_id;

  -- Notify winning provider
  INSERT INTO public.notifications (user_id, title, body, type, data)
  SELECT user_id,
         'Auction Won: ' || v_req.title,
         'Congratulations! You won the emergency auction with ' || v_top_bid.coins || ' coins. This job is now assigned to you.',
         'bidding_won',
         jsonb_build_object('request_id', p_request_id, 'coins', v_top_bid.coins)
  FROM public.provider_profiles WHERE id = v_top_bid.provider_profile_id;

  -- Notify customer
  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    v_req.customer_id,
    'Technician Assigned: ' || v_req.title,
    'Auction concluded! A qualified technician has been assigned to your emergency request.',
    'auction_awarded',
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'awarded_to', v_top_bid.provider_profile_id,
    'winning_coins', v_top_bid.coins,
    'booking_id', v_booking_id,
    'message', 'Auction finished! Awarded to highest bidder with ' || v_top_bid.coins || ' coins.'
  );
END;
$func$;

-- 8. RPC: customer_cancel_request
-- Cancel a service request as a customer.
-- Penalty: if provider had already taken the job, deduct 0.1 from customer's rating.
-- If cancelled before provider takes it: no deduction.
CREATE OR REPLACE FUNCTION public.customer_cancel_request(p_request_id UUID, p_customer_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req
  FROM public.service_requests
  WHERE id = p_request_id AND customer_id = p_customer_id;

  IF v_req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not owned by customer');
  END IF;

  IF v_req.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is already ' || v_req.status);
  END IF;

  -- Mark request as cancelled
  UPDATE public.service_requests SET status = 'cancelled', updated_at = now() WHERE id = p_request_id;
  UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE request_id = p_request_id;
  UPDATE public.bids SET status = 'cancelled' WHERE request_id = p_request_id AND status = 'active';

  -- Penalty check: Has a provider already taken the job?
  IF v_req.assigned_provider_profile_id IS NOT NULL THEN
    -- Deduct 0.1 from customer rating
    UPDATE public.profiles
    SET customer_rating_avg = ROUND(GREATEST(0, COALESCE(customer_rating_avg, 5.0) - 0.1), 2),
        updated_at = now()
    WHERE id = p_customer_id;

    INSERT INTO public.audit_log (table_name, record_id, action, performed_by, new_data)
    VALUES ('profiles', p_customer_id::text, 'UPDATE', p_customer_id,
      jsonb_build_object('reason', 'cancel_after_provider_assigned', 'rating_deduction', 0.1));

    -- Notify provider that customer cancelled
    INSERT INTO public.notifications (user_id, title, body, type, data)
    SELECT user_id,
           'Job Cancelled by Customer: ' || v_req.title,
           'The customer cancelled the assigned booking.',
           'booking_cancelled',
           jsonb_build_object('request_id', p_request_id)
    FROM public.provider_profiles WHERE id = v_req.assigned_provider_profile_id;

    RETURN jsonb_build_object('success', true, 'penalty_applied', true,
      'message', 'Booking cancelled. 0.1 rating deducted for cancelling after provider acceptance.');
  END IF;

  RETURN jsonb_build_object('success', true, 'penalty_applied', false,
    'message', 'Request cancelled successfully. No penalty applied.');
END;
$func$;

-- 9. RPC: provider_cancel_booking
-- Cancel a booking as a provider.
-- Penalty: deduct 3 coins + 0.1 from provider rating.
CREATE OR REPLACE FUNCTION public.provider_cancel_booking(p_request_id UUID, p_provider_profile_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req
  FROM public.service_requests
  WHERE id = p_request_id AND assigned_provider_profile_id = p_provider_profile_id;

  IF v_req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not assigned to this provider');
  END IF;

  IF v_req.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is already ' || v_req.status);
  END IF;

  -- Cancel the request and booking
  UPDATE public.service_requests
  SET status = 'cancelled', assigned_provider_profile_id = NULL, updated_at = now()
  WHERE id = p_request_id;

  UPDATE public.bookings SET status = 'cancelled', updated_at = now()
  WHERE request_id = p_request_id AND provider_profile_id = p_provider_profile_id;

  -- Deduct 3 coins penalty from coin_ledger
  INSERT INTO public.coin_ledger (provider_profile_id, amount, reason, request_id)
  VALUES (p_provider_profile_id, -3, 'Provider cancellation penalty: 3 coins deducted', p_request_id);

  -- Deduct 0.1 from provider's rating
  UPDATE public.provider_profiles
  SET rating_avg = ROUND(GREATEST(0, COALESCE(rating_avg, 5.0) - 0.1), 2), updated_at = now()
  WHERE id = p_provider_profile_id;

  -- Notify customer that provider cancelled
  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    v_req.customer_id,
    'Technician Cancelled: ' || v_req.title,
    'The assigned technician had to cancel this booking. Your request is now cancelled.',
    'booking_cancelled',
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object('success', true, 'coins_deducted', 3, 'rating_deducted', 0.1,
    'message', 'Booking cancelled. 3 coins and 0.1 rating deducted from your account.');
END;
$func$;

-- 10. RPC: mark_job_finished_by_role
-- Customer or Provider clicks "Finish".
-- When BOTH sides click Finish, job completes and feedback/review modal appears immediately.
CREATE OR REPLACE FUNCTION public.mark_job_finished_by_role(p_request_id UUID, p_user_id UUID, p_role TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $func$
DECLARE
  v_req RECORD;
  v_both_finished BOOLEAN := FALSE;
  v_provider_profile_id UUID;
  v_booking RECORD;
BEGIN
  SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;

  IF v_req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request already ' || v_req.status);
  END IF;

  IF p_role = 'customer' THEN
    IF v_req.customer_id <> p_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not the customer for this request');
    END IF;
    UPDATE public.service_requests SET customer_marked_finished = TRUE, updated_at = now() WHERE id = p_request_id;
    v_both_finished := COALESCE(v_req.provider_marked_finished, false);
  ELSIF p_role = 'provider' THEN
    SELECT id INTO v_provider_profile_id FROM public.provider_profiles WHERE user_id = p_user_id LIMIT 1;
    IF v_provider_profile_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Provider profile not found');
    END IF;
    IF v_req.assigned_provider_profile_id IS NOT NULL AND v_req.assigned_provider_profile_id <> v_provider_profile_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not the assigned provider for this request');
    END IF;
    UPDATE public.service_requests SET provider_marked_finished = TRUE, updated_at = now() WHERE id = p_request_id;
    v_both_finished := COALESCE(v_req.customer_marked_finished, false);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

  IF v_both_finished THEN
    -- Both have confirmed completion!
    UPDATE public.service_requests
    SET status = 'completed', customer_marked_finished = TRUE, provider_marked_finished = TRUE, updated_at = now()
    WHERE id = p_request_id;

    -- Update booking review_opens_at to now() so feedback appears immediately
    UPDATE public.bookings
    SET status = 'completed',
        customer_marked_complete_at = COALESCE(customer_marked_complete_at, now()),
        provider_marked_complete_at = COALESCE(provider_marked_complete_at, now()),
        review_opens_at = now(),
        updated_at = now()
    WHERE request_id = p_request_id
    RETURNING * INTO v_booking;

    -- Reward provider with completion coins if not already rewarded
    IF v_req.assigned_provider_profile_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.coin_ledger 
        WHERE request_id = p_request_id AND amount > 0 AND reason LIKE '%completion reward%'
      ) THEN
        INSERT INTO public.coin_ledger (provider_profile_id, amount, reason, request_id)
        VALUES (v_req.assigned_provider_profile_id, 20, 'Job completion reward (both parties confirmed)', p_request_id);
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'both_finished', true,
      'booking_id', v_booking.id,
      'message', 'Both parties marked the job as finished! Review & feedback is now open immediately.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'both_finished', false,
    'message', 'Your finish mark was recorded. Waiting for the other party to confirm.'
  );
END;
$func$;

-- 11. Bidding Starts Immediately After Posting:
-- Upgrade create_request to set status='bidding_open' immediately for emergency requests
CREATE OR REPLACE FUNCTION public.create_request(
    p_customer_id UUID,
    p_type TEXT,
    p_category_id UUID,
    p_area_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_offered_price NUMERIC,
    p_preferred_start TIMESTAMPTZ,
    p_images TEXT[] DEFAULT '{}',
    p_provider_preference TEXT DEFAULT 'either',
    p_address_confidential TEXT DEFAULT NULL,
    p_fee_payment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cust_prof RECORD;
    v_unreviewed_id UUID;
    v_category RECORD;
    v_min_price NUMERIC;
    v_multiplier NUMERIC;
    v_emergency_fee NUMERIC;
    v_lead_hours NUMERIC;
    v_local_start TIMESTAMPTZ;
    v_local_date DATE;
    v_local_time TIME;
    v_today DATE;
    v_days_ahead INTEGER;
    v_earliest TIME;
    v_latest TIME;
    v_payment_status TEXT;
    v_final_status TEXT;
    v_request_id UUID;
    v_bidding_opened_at TIMESTAMPTZ := NULL;
    v_bidding_closes_at TIMESTAMPTZ := NULL;
BEGIN
    -- Customer Low Rating Check
    SELECT customer_status, customer_rating_avg, customer_review_count
    INTO v_cust_prof
    FROM public.profiles
    WHERE id = p_customer_id;

    IF v_cust_prof.customer_status = 'under_review' OR (v_cust_prof.customer_review_count > 0 AND v_cust_prof.customer_rating_avg < 2.5) THEN
        RAISE EXCEPTION 'Customer rating violation: Your customer rating (%.2f) is below 2.5. New requests are suspended pending administrative approval.', COALESCE(v_cust_prof.customer_rating_avg, 0.0);
    END IF;

    -- Review Gate
    SELECT sr.id INTO v_unreviewed_id
    FROM public.service_requests sr
    LEFT JOIN public.reviews r ON r.request_id = sr.id AND r.reviewer_role = 'customer'
    WHERE sr.customer_id = p_customer_id
      AND sr.status = 'completed'
      AND r.id IS NULL
    LIMIT 1;

    IF v_unreviewed_id IS NOT NULL THEN
        RAISE EXCEPTION 'Review gate violation: You cannot post a new service request until you submit a review for your previously completed job (Request ID: %).', v_unreviewed_id;
    END IF;

    -- Image count check
    IF p_images IS NOT NULL AND cardinality(p_images) > 4 THEN
        RAISE EXCEPTION 'Image count violation: Maximum 4 images allowed (provided %).', cardinality(p_images);
    END IF;

    -- Service type & category
    IF p_type NOT IN ('ordinary', 'emergency') THEN
        RAISE EXCEPTION 'Invalid service type: %. Must be ordinary or emergency.', p_type;
    END IF;

    SELECT * INTO v_category
    FROM public.service_categories
    WHERE id = p_category_id AND active = true;

    IF v_category IS NULL THEN
        RAISE EXCEPTION 'Invalid service category or category is inactive.';
    END IF;

    IF p_type = 'ordinary' THEN
        v_min_price := v_category.base_price;
    ELSE
        SELECT COALESCE(
            (value->>'value')::NUMERIC,
            CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 1.3 END,
            1.3
        ) INTO v_multiplier
        FROM public.settings WHERE key = 'emergency_multiplier';

        IF v_multiplier IS NULL THEN v_multiplier := 1.3; END IF;
        v_min_price := ROUND(v_category.base_price * v_multiplier);
    END IF;

    IF p_offered_price < v_min_price THEN
        RAISE EXCEPTION 'Minimum price violation: Offered price (Rs %) is below the minimum allowed price of Rs % for this % service.', p_offered_price, v_min_price, p_type;
    END IF;

    -- Schedule Validation
    v_local_start := p_preferred_start AT TIME ZONE 'Asia/Kolkata';
    v_local_date := v_local_start::DATE;
    v_local_time := v_local_start::TIME;
    v_today := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;

    IF p_type = 'ordinary' THEN
        v_days_ahead := v_local_date - v_today;
        IF v_days_ahead < 2 OR v_days_ahead > 3 THEN
            RAISE EXCEPTION 'Ordinary schedule violation: Ordinary home services must be booked 2 to 3 days in advance (attempted % days).', v_days_ahead;
        END IF;

        SELECT COALESCE((value->>'value')::TIME, '08:00:00'::TIME) INTO v_earliest
        FROM public.settings WHERE key = 'ordinary_start_time_earliest';
        IF v_earliest IS NULL THEN v_earliest := '08:00:00'::TIME; END IF;

        SELECT COALESCE((value->>'value')::TIME, '19:00:00'::TIME) INTO v_latest
        FROM public.settings WHERE key = 'ordinary_start_time_latest';
        IF v_latest IS NULL THEN v_latest := '19:00:00'::TIME; END IF;

        IF v_local_time < v_earliest OR v_local_time > v_latest THEN
            RAISE EXCEPTION 'Ordinary operating hours violation: Ordinary home services can only start between % and % IST.', v_earliest, v_latest;
        END IF;

        v_final_status := 'pending';
    ELSE
        -- Emergency Service: Bidding starts IMMEDIATELY after posting!
        SELECT COALESCE(
            (value->>'value')::NUMERIC,
            CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 2.0 END,
            2.0
        ) INTO v_lead_hours
        FROM public.settings WHERE key = 'emergency_min_lead_hours';

        IF v_lead_hours IS NULL THEN v_lead_hours := 2.0; END IF;

        IF p_preferred_start < (now() + (v_lead_hours || ' hours')::INTERVAL) THEN
            RAISE EXCEPTION 'Emergency lead time violation: Emergency service requires at least % hours advance lead time.', v_lead_hours;
        END IF;

        -- Emergency Fee Gating
        SELECT COALESCE(
            (value->>'value')::NUMERIC,
            CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 50.0 END,
            50.0
        ) INTO v_emergency_fee
        FROM public.settings WHERE key = 'emergency_fee';

        IF v_emergency_fee IS NULL THEN v_emergency_fee := 0.0; END IF;

        IF v_emergency_fee > 0.0 THEN
            IF p_fee_payment_id IS NULL THEN
                RAISE EXCEPTION 'Emergency fee gating: Payment reference required. Fee of Rs % must be paid or waived before job goes live.', v_emergency_fee;
            END IF;

            SELECT status INTO v_payment_status
            FROM public.emergency_fee_payments
            WHERE id = p_fee_payment_id AND customer_id = p_customer_id;

            IF v_payment_status IS NULL THEN
                RAISE EXCEPTION 'Emergency fee gating: Payment record % not found for customer.', p_fee_payment_id;
            END IF;

            IF v_payment_status NOT IN ('paid', 'waived') THEN
                RAISE EXCEPTION 'Emergency fee gating: Payment status is %, but must be paid or waived for job to go live.', v_payment_status;
            END IF;
        END IF;

        -- BIDDING STARTS IMMEDIATELY:
        v_final_status := 'bidding_open';
        v_bidding_opened_at := now();
        v_bidding_closes_at := LEAST(
            now() + INTERVAL '45 minutes',
            p_preferred_start - INTERVAL '1 hour'
        );
        IF v_bidding_closes_at <= now() THEN
            v_bidding_closes_at := now() + INTERVAL '15 minutes';
        END IF;
    END IF;

    -- INSERT Service Request
    INSERT INTO public.service_requests (
        customer_id,
        type,
        category_id,
        area_id,
        title,
        description,
        offered_price,
        preferred_start,
        images,
        provider_preference,
        address_confidential,
        fee_payment_id,
        status,
        bidding_opened_at,
        bidding_closes_at
    ) VALUES (
        p_customer_id,
        p_type,
        p_category_id,
        p_area_id,
        p_title,
        p_description,
        p_offered_price,
        p_preferred_start,
        COALESCE(p_images, '{}'),
        COALESCE(p_provider_preference, 'either'),
        p_address_confidential,
        p_fee_payment_id,
        v_final_status,
        v_bidding_opened_at,
        v_bidding_closes_at
    )
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'status', v_final_status,
        'bidding_closes_at', v_bidding_closes_at
    );
END;
$$;

-- 12. Upgrade place_bid so providers can bid immediately without separate interest registration
CREATE OR REPLACE FUNCTION public.place_bid(
    p_request_id UUID,
    p_provider_user_id UUID,
    p_coins INTEGER,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_provider_profile_id UUID;
    v_available_coins INTEGER;
    v_min_bid INTEGER;
    v_prev_top_bid RECORD;
    v_new_bid_id UUID;
    v_banned_until TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
    IF v_req IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    IF v_req.status NOT IN ('bidding_open', 'bidding_active') THEN
        RAISE EXCEPTION 'Bidding is not open for this request (current status: %)', v_req.status;
    END IF;

    IF v_req.bidding_closes_at IS NOT NULL AND v_req.bidding_closes_at < now() THEN
        RAISE EXCEPTION 'Bidding window has closed for this request.';
    END IF;

    -- Resolve provider profile
    SELECT id, bid_banned_until INTO v_provider_profile_id, v_banned_until
    FROM public.provider_profiles
    WHERE user_id = p_provider_user_id;

    IF v_provider_profile_id IS NULL THEN
        RAISE EXCEPTION 'Provider profile not found';
    END IF;

    IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
        RAISE EXCEPTION 'You are suspended from emergency bidding until %.', to_char(v_banned_until AT TIME ZONE 'Asia/Kolkata', 'Dy, DD Mon HH12:MI AM');
    END IF;

    -- Auto-register interest if not present (since bidding starts immediately)
    INSERT INTO public.bid_interests (request_id, provider_profile_id, status)
    VALUES (p_request_id, v_provider_profile_id, 'interested')
    ON CONFLICT (request_id, provider_profile_id) DO NOTHING;

    -- Check provider coin balance
    SELECT COALESCE(SUM(amount), 0) INTO v_available_coins
    FROM public.coin_ledger
    WHERE provider_profile_id = v_provider_profile_id;

    IF v_available_coins < p_coins THEN
        RAISE EXCEPTION 'Insufficient coins. You have % coins, but attempted to bid %.', v_available_coins, p_coins;
    END IF;

    -- Get current top bid
    SELECT * INTO v_prev_top_bid
    FROM public.bids
    WHERE request_id = p_request_id AND status = 'active'
    ORDER BY coins DESC, created_at ASC
    LIMIT 1;

    IF v_prev_top_bid IS NOT NULL THEN
        v_min_bid := v_prev_top_bid.coins + 1;
    ELSE
        v_min_bid := 1;
    END IF;

    IF p_coins < v_min_bid THEN
        RAISE EXCEPTION 'Bid must be at least % coins (current top bid: %)', v_min_bid, COALESCE(v_prev_top_bid.coins, 0);
    END IF;

    -- Demote previous top bid
    IF v_prev_top_bid IS NOT NULL THEN
        UPDATE public.bids SET status = 'outbid' WHERE id = v_prev_top_bid.id;
    END IF;

    -- Insert new bid
    INSERT INTO public.bids (
        request_id,
        provider_profile_id,
        coins,
        note,
        status
    )
    VALUES (
        p_request_id,
        v_provider_profile_id,
        p_coins,
        p_note,
        'active'
    )
    RETURNING id INTO v_new_bid_id;

    -- Update request top bid cache
    UPDATE public.service_requests
    SET top_bid_coins = p_coins,
        top_bid_provider_profile_id = v_provider_profile_id,
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'bid_id', v_new_bid_id,
        'coins', p_coins,
        'status', 'active'
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.admin_get_allow_early_finish() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_allow_early_finish(BOOLEAN) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_immediate_auction() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_immediate_auction(BOOLEAN) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_finish_auction_now(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_request(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.provider_cancel_booking(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mark_job_finished_by_role(UUID, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_request(UUID, TEXT, UUID, UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT[], TEXT, TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.place_bid(UUID, UUID, INTEGER, TEXT) TO authenticated, anon;
