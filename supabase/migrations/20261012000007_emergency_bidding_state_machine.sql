-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 7: EMERGENCY BIDDING STATE MACHINE
-- States: draft_fee -> notified -> interest_window -> bidding_open -> closed -> awarded
-- Fallbacks: widen_radius -> extended -> offered_conversion -> admin_assist -> expired
-- All business rules: 13km PostGIS, rating >= 3.5, reviews >= 3, coins >= 35,
-- gap rule, not banned, org preference, 10th joiner auto-open, 45min timer,
-- bid increment, soft-lock balance check, double-win fallback, withdrawal penalty
-- ============================================================================

-- 1. EXTEND SERVICE REQUESTS STATUS CONSTRAINT & ADD BIDDING METADATA COLUMNS
DO $$
BEGIN
    ALTER TABLE public.service_requests
    DROP CONSTRAINT IF EXISTS service_requests_status_check;

    ALTER TABLE public.service_requests
    ADD CONSTRAINT service_requests_status_check
    CHECK (status IN (
        'draft_fee',
        'notified',
        'interest_window',
        'bidding_open',
        'closed',
        'awarded',
        'widen_radius',
        'extended',
        'offered_conversion',
        'admin_assist',
        'expired',
        'bidding_active',
        'pending',
        'open',
        'assigned',
        'in_progress',
        'completed',
        'cancelled',
        'disputed'
    ));

    -- Add metadata columns if they do not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='notified_at') THEN
        ALTER TABLE public.service_requests ADD COLUMN notified_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='interest_expires_at') THEN
        ALTER TABLE public.service_requests ADD COLUMN interest_expires_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='bidding_opened_at') THEN
        ALTER TABLE public.service_requests ADD COLUMN bidding_opened_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='bidding_closes_at') THEN
        ALTER TABLE public.service_requests ADD COLUMN bidding_closes_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='current_radius_km') THEN
        ALTER TABLE public.service_requests ADD COLUMN current_radius_km NUMERIC DEFAULT 13.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='top_bid_coins') THEN
        ALTER TABLE public.service_requests ADD COLUMN top_bid_coins INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='top_bid_provider_profile_id') THEN
        ALTER TABLE public.service_requests ADD COLUMN top_bid_provider_profile_id UUID REFERENCES public.provider_profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='fallback_stage') THEN
        ALTER TABLE public.service_requests ADD COLUMN fallback_stage INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. HELPER VIEW: PROVIDER AVAILABLE COINS (MINUS SOFT-LOCKED COINS ON ACTIVE TOP BIDS)
CREATE OR REPLACE VIEW public.provider_available_coins AS
WITH ledger_totals AS (
    SELECT
        pp.id AS provider_profile_id,
        COALESCE(SUM(cl.amount), 0)::INTEGER AS balance
    FROM public.provider_profiles pp
    LEFT JOIN public.coin_ledger cl ON cl.provider_profile_id = pp.id
    GROUP BY pp.id
),
locked_coins AS (
    -- Coins currently soft-locked as top bid in active emergency auctions
    SELECT
        b.provider_profile_id,
        COALESCE(SUM(b.coins), 0)::INTEGER AS locked
    FROM public.bids b
    JOIN public.service_requests sr ON sr.id = b.request_id
    WHERE b.status = 'active'
      AND sr.status = 'bidding_open'
      AND sr.top_bid_provider_profile_id = b.provider_profile_id
    GROUP BY b.provider_profile_id
)
SELECT
    lt.provider_profile_id,
    lt.balance AS total_balance,
    COALESCE(lc.locked, 0) AS locked_coins,
    (lt.balance - COALESCE(lc.locked, 0)) AS available_coins
FROM ledger_totals lt
LEFT JOIN locked_coins lc ON lc.provider_profile_id = lt.provider_profile_id;

-- 3. FUNCTION: FIND ELIGIBLE PROVIDERS FOR AN EMERGENCY REQUEST
CREATE OR REPLACE FUNCTION public.get_eligible_emergency_providers(
    p_request_id UUID,
    p_radius_km NUMERIC DEFAULT 13.0
)
RETURNS TABLE (
    provider_profile_id UUID,
    user_id UUID,
    name TEXT,
    phone TEXT,
    distance_km NUMERIC,
    provider_type TEXT,
    coins INTEGER,
    rating_avg NUMERIC,
    review_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_req RECORD;
    v_req_loc GEOGRAPHY;
    v_req_lat NUMERIC;
    v_req_lng NUMERIC;
    v_min_rating NUMERIC;
    v_min_reviews INTEGER;
    v_min_coins INTEGER;
    v_gap_hours NUMERIC;
    v_gap_interval INTERVAL;
    v_proposed_range TSTZRANGE;
BEGIN
    -- Read request details
    SELECT
        sr.*,
        a.location AS area_location,
        a.latitude AS area_latitude,
        a.longitude AS area_longitude
    INTO v_req
    FROM public.service_requests sr
    JOIN public.areas a ON a.id = sr.area_id
    WHERE sr.id = p_request_id;

    IF v_req IS NULL THEN RETURN; END IF;

    v_req_loc := v_req.area_location;
    v_req_lat := v_req.area_latitude;
    v_req_lng := v_req.area_longitude;

    v_proposed_range := tstzrange(
        v_req.preferred_start,
        v_req.preferred_start + (COALESCE(v_req.estimated_duration_hours, 2.0) || ' hours')::INTERVAL
    );

    -- Read business rule settings
    SELECT COALESCE((value->>'value')::NUMERIC, 3.5) INTO v_min_rating
    FROM public.settings WHERE key = 'bidding_min_rating';
    IF v_min_rating IS NULL THEN v_min_rating := 3.5; END IF;

    SELECT COALESCE((value->>'value')::INTEGER, 3) INTO v_min_reviews
    FROM public.settings WHERE key = 'bidding_min_reviews';
    IF v_min_reviews IS NULL THEN v_min_reviews := 3; END IF;

    SELECT COALESCE((value->>'value')::INTEGER, 35) INTO v_min_coins
    FROM public.settings WHERE key = 'bidding_min_coins';
    IF v_min_coins IS NULL THEN v_min_coins := 35; END IF;

    SELECT COALESCE((value->>'value')::NUMERIC, 8.0) INTO v_gap_hours
    FROM public.settings WHERE key = 'min_gap_hours';
    IF v_gap_hours IS NULL THEN v_gap_hours := 8.0; END IF;
    v_gap_interval := (v_gap_hours || ' hours')::INTERVAL;

    RETURN QUERY
    WITH candidate_providers AS (
        SELECT
            pp.id AS pp_id,
            pp.user_id AS pp_user_id,
            p.name AS pp_name,
            p.phone AS pp_phone,
            pp.provider_type AS pp_type,
            pp.rating_avg AS pp_rating,
            pp.review_count AS pp_reviews,
            COALESCE(bal.available_coins, 0) AS pp_coins,
            pp.bid_banned_until AS pp_banned_until,
            ROUND(
                (COALESCE(
                    ST_Distance(v_req_loc, pa.location),
                    6371000 * 2 * asin(sqrt(
                        sin(radians(pa.latitude - v_req_lat)/2)^2 +
                        cos(radians(v_req_lat)) * cos(radians(pa.latitude)) *
                        sin(radians(pa.longitude - v_req_lng)/2)^2
                    ))
                ) / 1000.0)::NUMERIC,
                1
            ) AS dist_km
        FROM public.provider_profiles pp
        JOIN public.profiles p ON p.id = pp.user_id
        LEFT JOIN public.areas pa ON pa.id = p.area_id
        LEFT JOIN public.provider_available_coins bal ON bal.provider_profile_id = pp.id
        WHERE pp.status = 'active'
          AND p.status = 'active'
          -- Category match
          AND (v_req.category_id::TEXT = ANY(pp.categories) OR cardinality(pp.categories) = 0)
    )
    SELECT
        cp.pp_id,
        cp.pp_user_id,
        cp.pp_name,
        cp.pp_phone,
        cp.dist_km,
        cp.pp_type,
        cp.pp_coins,
        cp.pp_rating,
        cp.pp_reviews
    FROM candidate_providers cp
    WHERE
        -- 1. PostGIS distance within radius
        cp.dist_km <= p_radius_km
        -- 2. Rating >= 3.5
        AND cp.pp_rating >= v_min_rating
        -- 3. Completed reviews >= 3
        AND cp.pp_reviews >= v_min_reviews
        -- 4. Coins >= 35
        AND cp.pp_coins >= v_min_coins
        -- 5. Not banned
        AND (cp.pp_banned_until IS NULL OR cp.pp_banned_until < now())
        -- 6. Provider preference filter (freelancer vs organization with active passing tech)
        AND (
            v_req.provider_preference = 'either'
            OR (v_req.provider_preference = 'freelancer' AND cp.pp_type = 'freelancer')
            OR (v_req.provider_preference = 'organization' AND cp.pp_type IN ('organization_owner', 'technician'))
        )
        -- 7. Calendar 8-hour gap rule check against existing bookings
        AND NOT EXISTS (
            SELECT 1
            FROM public.bookings b
            WHERE b.provider_profile_id = cp.pp_id
              AND b.status IN ('confirmed', 'in_progress', 'hold')
              AND (
                  b.time_range && v_proposed_range
                  OR
                  (upper(b.time_range) <= lower(v_proposed_range) AND lower(v_proposed_range) < upper(b.time_range) + v_gap_interval)
                  OR
                  (upper(v_proposed_range) <= lower(b.time_range) AND lower(b.time_range) < upper(v_proposed_range) + v_gap_interval)
              )
        );
END;
$$;

-- 4. TRANSITION TO INTEREST WINDOW & BROADCAST NOTIFICATIONS
CREATE OR REPLACE FUNCTION public.transition_to_interest_window(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_wait_minutes INTEGER;
    v_prov RECORD;
    v_notified_count INTEGER := 0;
    v_radius NUMERIC := 13.0;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
    IF v_req IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    SELECT COALESCE((value->>'value')::INTEGER, 45) INTO v_wait_minutes
    FROM public.settings WHERE key = 'bidding_open_wait_minutes';
    IF v_wait_minutes IS NULL THEN v_wait_minutes := 45; END IF;

    v_radius := COALESCE(v_req.current_radius_km, 13.0);

    -- Find eligible providers and notify them
    FOR v_prov IN SELECT * FROM public.get_eligible_emergency_providers(p_request_id, v_radius) LOOP
        INSERT INTO public.notifications (
            user_id,
            title,
            body,
            type,
            data
        )
        VALUES (
            v_prov.user_id,
            'Emergency Request: ' || v_req.title,
            'New emergency job in ' || (SELECT name FROM public.areas WHERE id = v_req.area_id) || ' (' || v_prov.distance_km || ' km). Tap to express interest.',
            'emergency_broadcast',
            jsonb_build_object(
                'request_id', p_request_id,
                'distance_km', v_prov.distance_km,
                'offered_price', v_req.offered_price,
                'preferred_start', v_req.preferred_start
            )
        );
        v_notified_count := v_notified_count + 1;
    END LOOP;

    -- Update request status to interest_window
    UPDATE public.service_requests
    SET status = 'interest_window',
        notified_at = timezone('utc'::text, now()),
        interest_expires_at = timezone('utc'::text, now()) + (v_wait_minutes || ' minutes')::INTERVAL,
        current_radius_km = v_radius,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'interest_window',
        'notified_count', v_notified_count,
        'radius_km', v_radius,
        'wait_minutes', v_wait_minutes
    );
END;
$$;

-- 5. FUNCTION: OPEN EMERGENCY BIDDING ROOM
CREATE OR REPLACE FUNCTION public.open_emergency_bidding(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_cutoff_hours NUMERIC;
    v_duration_minutes INTEGER := 15;
    v_closes_at TIMESTAMPTZ;
    v_interest RECORD;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
    IF v_req IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    -- Bidding close cutoff: at least 1 hour before job start
    SELECT COALESCE((value->>'value')::NUMERIC, 1.0) INTO v_cutoff_hours
    FROM public.settings WHERE key = 'bidding_close_cutoff_hours';
    IF v_cutoff_hours IS NULL THEN v_cutoff_hours := 1.0; END IF;

    -- Closes at LEAST 1 hour before start
    v_closes_at := LEAST(
        now() + (v_duration_minutes || ' minutes')::INTERVAL,
        v_req.preferred_start - (v_cutoff_hours || ' hours')::INTERVAL
    );

    IF v_closes_at <= now() THEN
        -- Cutoff already breached: extend or fallback
        v_closes_at := now() + INTERVAL '10 minutes';
    END IF;

    UPDATE public.service_requests
    SET status = 'bidding_open',
        bidding_opened_at = timezone('utc'::text, now()),
        bidding_closes_at = v_closes_at,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    -- Notify all interested providers
    FOR v_interest IN
        SELECT bi.provider_profile_id, pp.user_id
        FROM public.bid_interests bi
        JOIN public.provider_profiles pp ON pp.id = bi.provider_profile_id
        WHERE bi.request_id = p_request_id AND bi.status = 'interested'
    LOOP
        INSERT INTO public.notifications (
            user_id,
            title,
            body,
            type,
            data
        )
        VALUES (
            v_interest.user_id,
            'Live Bidding OPEN: ' || v_req.title,
            'The emergency bidding room is now live! Place your coin bid before ' || to_char(v_closes_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') || '.',
            'bidding_open',
            jsonb_build_object('request_id', p_request_id, 'closes_at', v_closes_at)
        );
    END LOOP;

    -- Notify customer
    INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        data
    )
    VALUES (
        v_req.customer_id,
        'Live Bidding Arena Active',
        'Providers are entering the arena. Watch incoming bids live in real-time.',
        'customer_bidding_active',
        jsonb_build_object('request_id', p_request_id, 'closes_at', v_closes_at)
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'bidding_open',
        'closes_at', v_closes_at
    );
END;
$$;

-- 6. RESPOND INTEREST (First 10 YES; 10th opens bidding at once; otherwise opens at 45 min)
CREATE OR REPLACE FUNCTION public.respond_interest(
    p_request_id UUID,
    p_provider_user_id UUID,
    p_interested BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_provider_profile_id UUID;
    v_req RECORD;
    v_max_interested INTEGER;
    v_current_count INTEGER;
    v_auto_opened BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
    IF v_req IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    IF v_req.status NOT IN ('notified', 'interest_window', 'widen_radius') THEN
        RAISE EXCEPTION 'Request % is not accepting interest responses (status: %)', p_request_id, v_req.status;
    END IF;

    SELECT id INTO v_provider_profile_id
    FROM public.provider_profiles
    WHERE user_id = p_provider_user_id;

    IF v_provider_profile_id IS NULL THEN
        RAISE EXCEPTION 'Provider profile not found for user %', p_provider_user_id;
    END IF;

    SELECT COALESCE((value->>'value')::INTEGER, 10) INTO v_max_interested
    FROM public.settings WHERE key = 'bidding_max_interested';
    IF v_max_interested IS NULL THEN v_max_interested := 10; END IF;

    IF NOT p_interested THEN
        INSERT INTO public.bid_interests (request_id, provider_profile_id, status)
        VALUES (p_request_id, v_provider_profile_id, 'not_interested')
        ON CONFLICT (request_id, provider_profile_id)
        DO UPDATE SET status = 'not_interested', created_at = timezone('utc'::text, now());

        RETURN jsonb_build_object(
            'success', true,
            'status', 'not_interested'
        );
    END IF;

    -- Count existing interested
    SELECT COUNT(*) INTO v_current_count
    FROM public.bid_interests
    WHERE request_id = p_request_id AND status = 'interested';

    IF v_current_count >= v_max_interested THEN
        RAISE EXCEPTION 'Bidding room is full. Maximum % interested providers reached.', v_max_interested;
    END IF;

    -- Insert interest
    INSERT INTO public.bid_interests (request_id, provider_profile_id, status)
    VALUES (p_request_id, v_provider_profile_id, 'interested')
    ON CONFLICT (request_id, provider_profile_id)
    DO UPDATE SET status = 'interested', created_at = timezone('utc'::text, now());

    v_current_count := v_current_count + 1;

    -- THE 10th YES OPENS BIDDING AT ONCE!
    IF v_current_count >= v_max_interested THEN
        PERFORM public.open_emergency_bidding(p_request_id);
        v_auto_opened := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'interested',
        'current_interested_count', v_current_count,
        'max_interested', v_max_interested,
        'bidding_auto_opened', v_auto_opened
    );
END;
$$;

-- 7. PLACE BID (Server-side checks of balance, min = last + 1, still eligible, soft-lock)
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

    IF v_req.status <> 'bidding_open' THEN
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

    -- Check interest registration
    IF NOT EXISTS (
        SELECT 1 FROM public.bid_interests
        WHERE request_id = p_request_id
          AND provider_profile_id = v_provider_profile_id
          AND status = 'interested'
    ) THEN
        RAISE EXCEPTION 'You must express interest in the job before placing a bid.';
    END IF;

    -- Check coin balance (with soft lock deduction)
    SELECT available_coins INTO v_available_coins
    FROM public.provider_available_coins
    WHERE provider_profile_id = v_provider_profile_id;

    IF v_available_coins IS NULL OR v_available_coins < p_coins THEN
        RAISE EXCEPTION 'Insufficient coins balance. You have % available coins (attempted to bid % coins).', COALESCE(v_available_coins, 0), p_coins;
    END IF;

    -- Check minimum bid: must be >= last + 1
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
        RAISE EXCEPTION 'Bid increment violation: Minimum bid allowed is % coins (last top bid was % coins).', v_min_bid, COALESCE(v_prev_top_bid.coins, 0);
    END IF;

    -- Release previous top bidder's soft lock by marking outbid
    IF v_prev_top_bid IS NOT NULL THEN
        UPDATE public.bids
        SET status = 'outbid'
        WHERE id = v_prev_top_bid.id;

        -- Notify outbid provider
        INSERT INTO public.notifications (
            user_id,
            title,
            body,
            type,
            data
        )
        VALUES (
            (SELECT user_id FROM public.provider_profiles WHERE id = v_prev_top_bid.provider_profile_id),
            'Outbid on ' || v_req.title,
            'Another technician placed a higher bid of ' || p_coins || ' coins. Your coins have been released.',
            'outbid',
            jsonb_build_object('request_id', p_request_id, 'new_top_bid', p_coins)
        );
    END IF;

    -- Insert new active top bid (coins are soft-locked via provider_available_coins view)
    INSERT INTO public.bids (
        request_id,
        provider_profile_id,
        coins,
        status,
        note
    )
    VALUES (
        p_request_id,
        v_provider_profile_id,
        p_coins,
        'active',
        p_note
    )
    RETURNING id INTO v_new_bid_id;

    -- Update denormalized top bid on service_requests for Realtime broadcast
    UPDATE public.service_requests
    SET top_bid_coins = p_coins,
        top_bid_provider_profile_id = v_provider_profile_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'bid_id', v_new_bid_id,
        'coins', p_coins,
        'request_id', p_request_id,
        'top_bid', p_coins
    );
END;
$$;

-- 8. CLOSE BIDDING (Winner = highest bid; gap rule rechecked; fallback to next highest; deduct coins)
CREATE OR REPLACE FUNCTION public.close_bidding(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_bid RECORD;
    v_winner RECORD := NULL;
    v_proposed_range TSTZRANGE;
    v_gap_hours NUMERIC;
    v_gap_interval INTERVAL;
    v_conflict_count INTEGER;
    v_booking_id UUID;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
    IF v_req IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    SELECT COALESCE((value->>'value')::NUMERIC, 8.0) INTO v_gap_hours
    FROM public.settings WHERE key = 'min_gap_hours';
    IF v_gap_hours IS NULL THEN v_gap_hours := 8.0; END IF;
    v_gap_interval := (v_gap_hours || ' hours')::INTERVAL;

    v_proposed_range := tstzrange(
        v_req.preferred_start,
        v_req.preferred_start + (COALESCE(v_req.estimated_duration_hours, 2.0) || ' hours')::INTERVAL
    );

    -- Loop through active bids ordered by highest coins
    FOR v_bid IN
        SELECT b.*, pp.user_id AS provider_user_id
        FROM public.bids b
        JOIN public.provider_profiles pp ON pp.id = b.provider_profile_id
        WHERE b.request_id = p_request_id
          AND b.status IN ('active', 'outbid')
          AND b.status <> 'withdrawn'
        ORDER BY b.coins DESC, b.created_at ASC
    LOOP
        -- Recheck 8-hour gap rule against provider's bookings
        SELECT COUNT(*) INTO v_conflict_count
        FROM public.bookings bk
        WHERE bk.provider_profile_id = v_bid.provider_profile_id
          AND bk.status IN ('confirmed', 'in_progress', 'hold')
          AND (
              bk.time_range && v_proposed_range
              OR
              (upper(bk.time_range) <= lower(v_proposed_range) AND lower(v_proposed_range) < upper(bk.time_range) + v_gap_interval)
              OR
              (upper(v_proposed_range) <= lower(bk.time_range) AND lower(bk.time_range) < upper(v_proposed_range) + v_gap_interval)
          );

        IF v_conflict_count = 0 THEN
            v_winner := v_bid;
            EXIT; -- Found valid non-conflicting highest bidder
        ELSE
            -- Top bidder holds conflicting emergency job! Mark cancelled and fall to next highest
            UPDATE public.bids SET status = 'cancelled' WHERE id = v_bid.id;
        END IF;
    END LOOP;

    -- If no valid winner found (nobody bid or all conflicted)
    IF v_winner IS NULL THEN
        RETURN public.trigger_fallback_ladder(p_request_id, 'no_bids_or_conflicts');
    END IF;

    -- 1. Deduct only winner's coins from ledger
    INSERT INTO public.coin_ledger (
        provider_profile_id,
        amount,
        reason,
        request_id
    )
    VALUES (
        v_winner.provider_profile_id,
        -v_winner.coins,
        'bid_won',
        p_request_id
    );

    -- 2. Mark winning bid
    UPDATE public.bids SET status = 'won' WHERE id = v_winner.id;

    -- 3. Write confirmed booking row (tstzrange)
    INSERT INTO public.bookings (
        request_id,
        provider_profile_id,
        time_range,
        status
    )
    VALUES (
        p_request_id,
        v_winner.provider_profile_id,
        v_proposed_range,
        'confirmed'
    )
    RETURNING id INTO v_booking_id;

    -- 4. Update request status to awarded
    UPDATE public.service_requests
    SET status = 'awarded',
        assigned_provider_profile_id = v_winner.provider_profile_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    -- 5. Notify winner and customer
    INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        data
    )
    VALUES (
        v_winner.provider_user_id,
        'Congratulations! You won the bid for ' || v_req.title,
        'Your bid of ' || v_winner.coins || ' coins won. Dispatch confirmed for ' || to_char(v_req.preferred_start AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') || '.',
        'bid_won',
        jsonb_build_object('request_id', p_request_id, 'booking_id', v_booking_id)
    );

    INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        data
    )
    VALUES (
        v_req.customer_id,
        'Technician Assigned for ' || v_req.title,
        'Emergency bidding ended. Technician has been assigned and dispatched.',
        'customer_technician_assigned',
        jsonb_build_object('request_id', p_request_id, 'provider_profile_id', v_winner.provider_profile_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'awarded',
        'winner_provider_profile_id', v_winner.provider_profile_id,
        'winning_coins', v_winner.coins,
        'booking_id', v_booking_id
    );
END;
$$;

-- 9. WITHDRAWAL AND NO-SHOW PENALTY (50% coins, rating -0.1, 3-day ban keyed by verified_id_hash)
CREATE OR REPLACE FUNCTION public.penalize_withdrawal_or_noshow(
    p_request_id UUID,
    p_provider_user_id UUID,
    p_reason TEXT DEFAULT 'withdrawal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prov RECORD;
    v_winning_bid RECORD;
    v_penalty_coins INTEGER;
    v_penalty_pct NUMERIC := 50.0;
    v_penalty_rating NUMERIC := 0.1;
    v_ban_days INTEGER := 3;
    v_ban_until TIMESTAMPTZ;
BEGIN
    SELECT pp.*, p.name INTO v_prov
    FROM public.provider_profiles pp
    JOIN public.profiles p ON p.id = pp.user_id
    WHERE pp.user_id = p_provider_user_id;

    IF v_prov IS NULL THEN
        RAISE EXCEPTION 'Provider profile not found';
    END IF;

    SELECT COALESCE((value->>'value')::NUMERIC, 50.0) INTO v_penalty_pct
    FROM public.settings WHERE key = 'withdraw_penalty_coin_pct';
    IF v_penalty_pct IS NULL THEN v_penalty_pct := 50.0; END IF;

    SELECT COALESCE((value->>'value')::NUMERIC, 0.1) INTO v_penalty_rating
    FROM public.settings WHERE key = 'withdraw_penalty_rating';
    IF v_penalty_rating IS NULL THEN v_penalty_rating := 0.1; END IF;

    SELECT COALESCE((value->>'value')::INTEGER, 3) INTO v_ban_days
    FROM public.settings WHERE key = 'withdraw_ban_days';
    IF v_ban_days IS NULL THEN v_ban_days := 3; END IF;

    v_ban_until := timezone('utc'::text, now()) + (v_ban_days || ' days')::INTERVAL;

    -- Find bid to compute 50% penalty coins
    SELECT * INTO v_winning_bid
    FROM public.bids
    WHERE request_id = p_request_id AND provider_profile_id = v_prov.id
    ORDER BY coins DESC
    LIMIT 1;

    v_penalty_coins := ROUND(COALESCE(v_winning_bid.coins, 35) * (v_penalty_pct / 100.0));
    IF v_penalty_coins < 1 THEN v_penalty_coins := 15; END IF;

    -- 1. Deduct 50% coins from ledger
    INSERT INTO public.coin_ledger (
        provider_profile_id,
        amount,
        reason,
        request_id
    )
    VALUES (
        v_prov.id,
        -v_penalty_coins,
        'withdraw_penalty',
        p_request_id
    );

    -- 2. Deduct rating -0.1
    UPDATE public.provider_profiles
    SET rating_avg = GREATEST(0.00, rating_avg - v_penalty_rating),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_prov.id;

    -- 3. Set bid_banned_until keyed by verified_id_hash across all profiles sharing the hash!
    IF v_prov.verified_id_hash IS NOT NULL THEN
        UPDATE public.provider_profiles
        SET bid_banned_until = v_ban_until,
            updated_at = timezone('utc'::text, now())
        WHERE verified_id_hash = v_prov.verified_id_hash;
    ELSE
        UPDATE public.provider_profiles
        SET bid_banned_until = v_ban_until,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_prov.id;
    END IF;

    -- Cancel booking if held
    UPDATE public.bookings
    SET status = 'cancelled'
    WHERE request_id = p_request_id AND provider_profile_id = v_prov.id;

    -- Re-evaluate job
    PERFORM public.close_bidding(p_request_id);

    RETURN jsonb_build_object(
        'success', true,
        'penalty_coins', v_penalty_coins,
        'rating_deduction', v_penalty_rating,
        'banned_until', v_ban_until,
        'verified_id_hash', v_prov.verified_id_hash
    );
END;
$$;

-- 10. FALLBACK LADDER
CREATE OR REPLACE FUNCTION public.trigger_fallback_ladder(
    p_request_id UUID,
    p_reason TEXT DEFAULT 'timeout'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_stage INTEGER;
    v_r2 NUMERIC := 20.0;
    v_r3 NUMERIC := 30.0;
    v_cutoff_hours NUMERIC := 1.0;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
    IF v_req IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    v_stage := COALESCE(v_req.fallback_stage, 0) + 1;

    SELECT COALESCE((value->>'value')::NUMERIC, 20.0) INTO v_r2
    FROM public.settings WHERE key = 'emergency_radius_tier_2_km';
    SELECT COALESCE((value->>'value')::NUMERIC, 30.0) INTO v_r3
    FROM public.settings WHERE key = 'emergency_radius_tier_3_km';
    SELECT COALESCE((value->>'value')::NUMERIC, 1.0) INTO v_cutoff_hours
    FROM public.settings WHERE key = 'bidding_close_cutoff_hours';

    -- Stage 1: widen_radius (Tier 2: 20km)
    IF v_stage = 1 THEN
        UPDATE public.service_requests
        SET status = 'widen_radius',
            current_radius_km = v_r2,
            fallback_stage = 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_request_id;

        PERFORM public.transition_to_interest_window(p_request_id);

        RETURN jsonb_build_object('success', true, 'status', 'widen_radius', 'radius_km', v_r2);
    END IF;

    -- Stage 2: widen_radius (Tier 3: 30km)
    IF v_stage = 2 THEN
        UPDATE public.service_requests
        SET status = 'widen_radius',
            current_radius_km = v_r3,
            fallback_stage = 2,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_request_id;

        PERFORM public.transition_to_interest_window(p_request_id);

        RETURN jsonb_build_object('success', true, 'status', 'widen_radius', 'radius_km', v_r3);
    END IF;

    -- Stage 3: extended (if more than 1 hour before job start)
    IF v_stage = 3 AND (v_req.preferred_start - (v_cutoff_hours || ' hours')::INTERVAL) > now() THEN
        UPDATE public.service_requests
        SET status = 'extended',
            fallback_stage = 3,
            interest_expires_at = now() + INTERVAL '15 minutes',
            updated_at = timezone('utc'::text, now())
        WHERE id = p_request_id;

        RETURN jsonb_build_object('success', true, 'status', 'extended');
    END IF;

    -- Stage 4: offered_conversion (offer conversion to ordinary standard appointment)
    IF v_stage <= 4 AND (v_req.preferred_start - (v_cutoff_hours || ' hours')::INTERVAL) <= now() THEN
        UPDATE public.service_requests
        SET status = 'offered_conversion',
            fallback_stage = 4,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_request_id;

        INSERT INTO public.notifications (
            user_id,
            title,
            body,
            type,
            data
        )
        VALUES (
            v_req.customer_id,
            'Emergency Window Expiring: Option to Convert',
            'No emergency providers were available within the radius. Would you like to convert to a standard scheduled booking?',
            'offered_conversion',
            jsonb_build_object('request_id', p_request_id)
        );

        RETURN jsonb_build_object('success', true, 'status', 'offered_conversion');
    END IF;

    -- Stage 5: admin_assist
    IF v_stage = 5 THEN
        UPDATE public.service_requests
        SET status = 'admin_assist',
            fallback_stage = 5,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_request_id;

        RETURN jsonb_build_object('success', true, 'status', 'admin_assist');
    END IF;

    -- Final: expired
    UPDATE public.service_requests
    SET status = 'expired',
        fallback_stage = 6,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'expired');
END;
$$;

-- 11. ADMIN RPCS: START OR CANCEL BIDDING MANUALLY
CREATE OR REPLACE FUNCTION public.admin_start_bidding(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.open_emergency_bidding(p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_bidding(
    p_request_id UUID,
    p_reason TEXT DEFAULT 'Admin cancellation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
    IF v_req IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    -- Cancel all active bids
    UPDATE public.bids
    SET status = 'cancelled'
    WHERE request_id = p_request_id AND status = 'active';

    UPDATE public.service_requests
    SET status = 'cancelled',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    -- Notify customer
    INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        data
    )
    VALUES (
        v_req.customer_id,
        'Emergency Listing Cancelled',
        'Your emergency request was cancelled by support: ' || p_reason,
        'request_cancelled',
        jsonb_build_object('request_id', p_request_id, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'status', 'cancelled', 'reason', p_reason);
END;
$$;

-- 12. PERIODIC EVALUATION FUNCTION (CALLED BY PG_CRON OR SCHEDULE EVERY MINUTE)
CREATE OR REPLACE FUNCTION public.evaluate_bidding_ticks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
    v_opened_count INTEGER := 0;
    v_closed_count INTEGER := 0;
    v_fallback_count INTEGER := 0;
BEGIN
    -- 1. Requests in interest_window where 45-minute timer has expired
    FOR v_rec IN
        SELECT id
        FROM public.service_requests
        WHERE status IN ('interest_window', 'notified')
          AND interest_expires_at IS NOT NULL
          AND interest_expires_at <= now()
    LOOP
        -- Check if there are interested providers
        IF EXISTS (SELECT 1 FROM public.bid_interests WHERE request_id = v_rec.id AND status = 'interested') THEN
            PERFORM public.open_emergency_bidding(v_rec.id);
            v_opened_count := v_opened_count + 1;
        ELSE
            -- Nobody interested: trigger fallback ladder
            PERFORM public.trigger_fallback_ladder(v_rec.id, 'nobody_interested_timeout');
            v_fallback_count := v_fallback_count + 1;
        END IF;
    END LOOP;

    -- 2. Requests in bidding_open where bidding_closes_at has passed
    FOR v_rec IN
        SELECT id
        FROM public.service_requests
        WHERE status = 'bidding_open'
          AND bidding_closes_at IS NOT NULL
          AND bidding_closes_at <= now()
    LOOP
        PERFORM public.close_bidding(v_rec.id);
        v_closed_count := v_closed_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'opened_count', v_opened_count,
        'closed_count', v_closed_count,
        'fallback_count', v_fallback_count
    );
END;
$$;

-- 13. SCHEDULE PG_CRON IF EXTENSION EXISTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('emergency-bidding-tick');
        PERFORM cron.schedule(
            'emergency-bidding-tick',
            '* * * * *',
            'SELECT public.evaluate_bidding_ticks();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if pg_cron is not available in local test environment
    NULL;
END $$;
