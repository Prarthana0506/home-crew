-- Emergency flow: the mandatory gap (now 4 hours, see 20261014000009) applies
-- only against bookings from the SAME customer as the emergency request.
-- Direct time overlap with any active booking still excludes the provider.

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

    SELECT COALESCE((value->>'value')::NUMERIC, 3.5) INTO v_min_rating
    FROM public.settings WHERE key = 'bidding_min_rating';
    IF v_min_rating IS NULL THEN v_min_rating := 3.5; END IF;

    SELECT COALESCE((value->>'value')::INTEGER, 3) INTO v_min_reviews
    FROM public.settings WHERE key = 'bidding_min_reviews';
    IF v_min_reviews IS NULL THEN v_min_reviews := 3; END IF;

    SELECT COALESCE((value->>'value')::INTEGER, 35) INTO v_min_coins
    FROM public.settings WHERE key = 'bidding_min_coins';
    IF v_min_coins IS NULL THEN v_min_coins := 35; END IF;

    SELECT COALESCE((value->>'value')::NUMERIC, 4.0) INTO v_gap_hours
    FROM public.settings WHERE key = 'min_gap_hours';
    IF v_gap_hours IS NULL THEN v_gap_hours := 4.0; END IF;
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
        cp.dist_km <= p_radius_km
        AND cp.pp_rating >= v_min_rating
        AND cp.pp_reviews >= v_min_reviews
        AND cp.pp_coins >= v_min_coins
        AND (cp.pp_banned_until IS NULL OR cp.pp_banned_until < now())
        AND (
            v_req.provider_preference = 'either'
            OR (v_req.provider_preference = 'freelancer' AND cp.pp_type = 'freelancer')
            OR (v_req.provider_preference = 'organization' AND cp.pp_type IN ('organization_owner', 'technician'))
        )
        -- Calendar fit: no overlap with any active booking, and no gap
        -- violation against this same customer's bookings
        AND NOT EXISTS (
            SELECT 1
            FROM public.bookings b
            JOIN public.service_requests bsr ON bsr.id = b.request_id
            WHERE b.provider_profile_id = cp.pp_id
              AND b.status IN ('confirmed', 'in_progress', 'hold')
              AND (
                  b.time_range && v_proposed_range
                  OR (
                      bsr.customer_id = v_req.customer_id
                      AND (
                          (upper(b.time_range) <= lower(v_proposed_range)
                              AND lower(v_proposed_range) < upper(b.time_range) + v_gap_interval)
                          OR
                          (upper(v_proposed_range) <= lower(b.time_range)
                              AND lower(b.time_range) < upper(v_proposed_range) + v_gap_interval)
                      )
                  )
              )
        );
END;
$$;

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

    SELECT COALESCE((value->>'value')::NUMERIC, 4.0) INTO v_gap_hours
    FROM public.settings WHERE key = 'min_gap_hours';
    IF v_gap_hours IS NULL THEN v_gap_hours := 4.0; END IF;
    v_gap_interval := (v_gap_hours || ' hours')::INTERVAL;

    v_proposed_range := tstzrange(
        v_req.preferred_start,
        v_req.preferred_start + (COALESCE(v_req.estimated_duration_hours, 2.0) || ' hours')::INTERVAL
    );

    FOR v_bid IN
        SELECT b.*, pp.user_id AS provider_user_id
        FROM public.bids b
        JOIN public.provider_profiles pp ON pp.id = b.provider_profile_id
        WHERE b.request_id = p_request_id
          AND b.status IN ('active', 'outbid')
          AND b.status <> 'withdrawn'
        ORDER BY b.coins DESC, b.created_at ASC
    LOOP
        -- Recheck calendar: overlap with any active booking, or gap
        -- violation against this same customer's bookings
        SELECT COUNT(*) INTO v_conflict_count
        FROM public.bookings bk
        JOIN public.service_requests bsr ON bsr.id = bk.request_id
        WHERE bk.provider_profile_id = v_bid.provider_profile_id
          AND bk.status IN ('confirmed', 'in_progress', 'hold')
          AND (
              bk.time_range && v_proposed_range
              OR (
                  bsr.customer_id = v_req.customer_id
                  AND (
                      (upper(bk.time_range) <= lower(v_proposed_range)
                          AND lower(v_proposed_range) < upper(bk.time_range) + v_gap_interval)
                      OR
                      (upper(v_proposed_range) <= lower(bk.time_range)
                          AND lower(bk.time_range) < upper(v_proposed_range) + v_gap_interval)
                  )
              )
          );

        IF v_conflict_count = 0 THEN
            v_winner := v_bid;
            EXIT;
        ELSE
            UPDATE public.bids SET status = 'cancelled' WHERE id = v_bid.id;
        END IF;
    END LOOP;

    IF v_winner IS NULL THEN
        RETURN public.trigger_fallback_ladder(p_request_id, 'no_bids_or_conflicts');
    END IF;

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

    UPDATE public.bids SET status = 'won' WHERE id = v_winner.id;

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

    UPDATE public.service_requests
    SET status = 'awarded',
        assigned_provider_profile_id = v_winner.provider_profile_id,
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