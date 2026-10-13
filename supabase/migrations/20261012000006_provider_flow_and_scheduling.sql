-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 6: PROVIDER FLOW AND SCHEDULING
-- 1. Open ordinary job feed within 13km, preference match, and calendar gap fit
-- 2. Atomic accept_ordinary() with 2-hour pending hold and race condition loser detection
-- 3. confirm_booking_time() with 8 AM to 7 PM validation and tstzrange booking write
-- ============================================================================

-- 1. ALLOW 'open' STATUS IN service_requests AND 'hold' STATUS IN bookings
DO $$
BEGIN
    -- Drop existing check on service_requests status and recreate with 'open'
    ALTER TABLE public.service_requests
    DROP CONSTRAINT IF EXISTS service_requests_status_check;

    ALTER TABLE public.service_requests
    ADD CONSTRAINT service_requests_status_check
    CHECK (status IN ('open', 'pending', 'bidding_active', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed'));

    -- Drop existing check on bookings status and recreate with 'hold'
    ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_status_check;

    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'hold'));
END $$;

-- 2. SEED HOLD DURATION SETTING
INSERT INTO public.settings (key, value, description)
VALUES
    ('hold_duration_hours', '{"value": 2.0}'::jsonb, 'Hold duration in hours when a provider accepts an ordinary job before start time confirmation')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- 3. PROVIDER ORDINARY JOB FEED RPC
-- Returns open ordinary jobs within 13 km of provider, matching preference, fitting 8-hour gap
CREATE OR REPLACE FUNCTION public.get_provider_ordinary_feed(p_provider_user_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category_id UUID,
    category_name TEXT,
    area_id UUID,
    area_name TEXT,
    pincode TEXT,
    distance_km NUMERIC,
    offered_price NUMERIC,
    min_price NUMERIC,
    preferred_start TIMESTAMPTZ,
    estimated_duration_hours NUMERIC,
    provider_preference TEXT,
    customer_id UUID,
    customer_name TEXT,
    customer_phone TEXT,
    images TEXT[],
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_provider_profile_id UUID;
    v_provider_type TEXT;
    v_provider_area_id UUID;
    v_prov_lat NUMERIC;
    v_prov_lng NUMERIC;
    v_prov_loc GEOGRAPHY;
    v_gap_hours NUMERIC;
    v_gap_interval INTERVAL;
BEGIN
    -- Resolve provider profile
    SELECT pp.id, pp.provider_type, p.area_id
    INTO v_provider_profile_id, v_provider_type, v_provider_area_id
    FROM public.provider_profiles pp
    JOIN public.profiles p ON p.id = pp.user_id
    WHERE pp.user_id = p_provider_user_id;

    IF v_provider_profile_id IS NULL THEN
        RETURN;
    END IF;

    -- Resolve provider locality coordinates
    SELECT a.latitude, a.longitude, a.location
    INTO v_prov_lat, v_prov_lng, v_prov_loc
    FROM public.areas a
    WHERE a.id = v_provider_area_id;

    -- Read min gap hours
    SELECT COALESCE(
        (value->>'value')::NUMERIC,
        CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 8.0 END,
        8.0
    ) INTO v_gap_hours
    FROM public.settings WHERE key = 'min_gap_hours';

    IF v_gap_hours IS NULL THEN v_gap_hours := 8.0; END IF;
    v_gap_interval := (v_gap_hours || ' hours')::INTERVAL;

    RETURN QUERY
    WITH candidate_jobs AS (
        SELECT
            sr.id,
            sr.title,
            sr.description,
            sr.category_id,
            sc.name AS category_name,
            sr.area_id,
            ar.name AS area_name,
            ar.pincode,
            ROUND(
                (COALESCE(
                    ST_Distance(v_prov_loc, ar.location),
                    CASE
                        WHEN v_prov_lat IS NOT NULL AND ar.latitude IS NOT NULL THEN
                            6371000 * 2 * asin(sqrt(
                                sin(radians(ar.latitude - v_prov_lat)/2)^2 +
                                cos(radians(v_prov_lat)) * cos(radians(ar.latitude)) *
                                sin(radians(ar.longitude - v_prov_lng)/2)^2
                            ))
                        ELSE 0
                    END
                ) / 1000.0)::NUMERIC,
                1
            ) AS distance_km,
            sr.offered_price,
            sr.min_price,
            sr.preferred_start,
            sr.estimated_duration_hours,
            sr.provider_preference,
            sr.customer_id,
            cp.name AS customer_name,
            cp.phone AS customer_phone,
            sr.images,
            sr.created_at,
            tstzrange(
                sr.preferred_start,
                sr.preferred_start + (COALESCE(sr.estimated_duration_hours, 2.0) || ' hours')::INTERVAL
            ) AS proposed_range
        FROM public.service_requests sr
        JOIN public.service_categories sc ON sc.id = sr.category_id
        JOIN public.areas ar ON ar.id = sr.area_id
        JOIN public.profiles cp ON cp.id = sr.customer_id
        WHERE sr.type = 'ordinary'
          AND sr.status IN ('open', 'pending')
          AND sr.assigned_provider_profile_id IS NULL
    )
    SELECT
        cj.id,
        cj.title,
        cj.description,
        cj.category_id,
        cj.category_name,
        cj.area_id,
        cj.area_name,
        cj.pincode,
        cj.distance_km,
        cj.offered_price,
        cj.min_price,
        cj.preferred_start,
        cj.estimated_duration_hours,
        cj.provider_preference,
        cj.customer_id,
        cj.customer_name,
        cj.customer_phone,
        cj.images,
        cj.created_at
    FROM candidate_jobs cj
    WHERE
        -- 1. Distance filter (Within 13 km)
        (v_prov_loc IS NULL OR cj.distance_km <= 13.0)
        -- 2. Provider preference match
        AND (
            cj.provider_preference = 'either'
            OR (cj.provider_preference = 'freelancer' AND v_provider_type = 'freelancer')
            OR (cj.provider_preference = 'organization' AND v_provider_type IN ('organization_owner', 'technician'))
        )
        -- 3. Calendar fit (No 8-hour gap rule conflict with provider's active bookings)
        AND NOT EXISTS (
            SELECT 1
            FROM public.bookings b
            WHERE b.provider_profile_id = v_provider_profile_id
              AND b.status IN ('confirmed', 'in_progress', 'hold')
              AND (
                  -- Direct overlap
                  b.time_range && cj.proposed_range
                  OR
                  -- Candidate starts within gap_hours of existing booking ending
                  (upper(b.time_range) <= lower(cj.proposed_range) AND lower(cj.proposed_range) < upper(b.time_range) + v_gap_interval)
                  OR
                  -- Existing booking starts within gap_hours of candidate ending
                  (upper(cj.proposed_range) <= lower(b.time_range) AND lower(b.time_range) < upper(cj.proposed_range) + v_gap_interval)
              )
        )
    ORDER BY cj.preferred_start ASC;
END;
$$;

-- 4. ATOMIC accept_ordinary(request_id)
-- Single atomic UPDATE ... WHERE status IN ('open', 'pending')
-- Returns "already taken" for loser of race condition
-- Creates a pending hold of 2 hours until start time is confirmed
CREATE OR REPLACE FUNCTION public.accept_ordinary(
    p_request_id UUID,
    p_provider_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_provider_profile_id UUID;
    v_updated_id UUID;
    v_preferred_start TIMESTAMPTZ;
    v_duration_hours NUMERIC;
    v_hold_hours NUMERIC;
    v_booking_id UUID;
    v_hold_range TSTZRANGE;
BEGIN
    -- Resolve provider profile
    SELECT id INTO v_provider_profile_id
    FROM public.provider_profiles
    WHERE user_id = p_provider_user_id;

    IF v_provider_profile_id IS NULL THEN
        RAISE EXCEPTION 'Provider profile not found for user %', p_provider_user_id;
    END IF;

    -- Atomic update: only one concurrent transaction can succeed
    UPDATE public.service_requests
    SET status = 'assigned',
        assigned_provider_profile_id = v_provider_profile_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id
      AND status IN ('open', 'pending')
    RETURNING id, preferred_start, estimated_duration_hours
    INTO v_updated_id, v_preferred_start, v_duration_hours;

    -- Loser of race: row was already updated by another provider
    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'already taken'
        );
    END IF;

    -- Read hold duration setting (default 2 hours)
    SELECT COALESCE(
        (value->>'value')::NUMERIC,
        CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 2.0 END,
        2.0
    ) INTO v_hold_hours
    FROM public.settings WHERE key = 'hold_duration_hours';

    IF v_hold_hours IS NULL THEN v_hold_hours := 2.0; END IF;

    -- Create pending hold booking for the job
    v_hold_range := tstzrange(
        v_preferred_start,
        v_preferred_start + (COALESCE(v_duration_hours, 2.0) || ' hours')::INTERVAL
    );

    INSERT INTO public.bookings (
        request_id,
        provider_profile_id,
        time_range,
        status
    )
    VALUES (
        v_updated_id,
        v_provider_profile_id,
        v_hold_range,
        'hold'
    )
    RETURNING id INTO v_booking_id;

    -- Add a system chat message notifying customer and provider
    INSERT INTO public.messages (
        request_id,
        sender_id,
        content,
        message_type,
        payload
    )
    VALUES (
        v_updated_id,
        p_provider_user_id,
        'Provider has accepted this work order. A ' || v_hold_hours || '-hour pending hold is active. Please coordinate arrival or propose a confirmed start time.',
        'system',
        jsonb_build_object('event', 'accepted_ordinary', 'hold_hours', v_hold_hours, 'booking_id', v_booking_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_updated_id,
        'provider_profile_id', v_provider_profile_id,
        'booking_id', v_booking_id,
        'hold_hours', v_hold_hours,
        'status', 'assigned'
    );
END;
$$;

-- 5. CONFIRM BOOKING TIME (Customer confirms proposed time)
-- Enforces 8 AM to 7 PM IST, writes confirmed tstzrange booking row
CREATE OR REPLACE FUNCTION public.confirm_booking_time(
    p_request_id UUID,
    p_confirmed_start TIMESTAMPTZ,
    p_duration_hours NUMERIC DEFAULT 2.0,
    p_confirmed_by UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_time TIME;
    v_earliest TIME;
    v_latest TIME;
    v_time_range TSTZRANGE;
    v_provider_profile_id UUID;
    v_booking_id UUID;
BEGIN
    -- 1. Validate operating hours: 8 AM to 7 PM IST only
    v_start_time := (p_confirmed_start AT TIME ZONE 'Asia/Kolkata')::TIME;

    SELECT COALESCE((value->>'value')::TIME, '08:00:00'::TIME) INTO v_earliest
    FROM public.settings WHERE key = 'ordinary_start_time_earliest';
    IF v_earliest IS NULL THEN v_earliest := '08:00:00'::TIME; END IF;

    SELECT COALESCE((value->>'value')::TIME, '19:00:00'::TIME) INTO v_latest
    FROM public.settings WHERE key = 'ordinary_start_time_latest';
    IF v_latest IS NULL THEN v_latest := '19:00:00'::TIME; END IF;

    IF v_start_time < v_earliest OR v_start_time > v_latest THEN
        RAISE EXCEPTION 'Ordinary home services can only start between % and % IST.', v_earliest, v_latest;
    END IF;

    -- 2. Construct tstzrange
    v_time_range := tstzrange(
        p_confirmed_start,
        p_confirmed_start + (COALESCE(p_duration_hours, 2.0) || ' hours')::INTERVAL
    );

    -- 3. Resolve assigned provider
    SELECT assigned_provider_profile_id INTO v_provider_profile_id
    FROM public.service_requests
    WHERE id = p_request_id;

    IF v_provider_profile_id IS NULL THEN
        RAISE EXCEPTION 'Service request % has no assigned provider.', p_request_id;
    END IF;

    -- 4. Update existing hold booking or insert confirmed booking
    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE request_id = p_request_id AND provider_profile_id = v_provider_profile_id
    LIMIT 1;

    IF v_booking_id IS NOT NULL THEN
        UPDATE public.bookings
        SET time_range = v_time_range,
            status = 'confirmed',
            updated_at = timezone('utc'::text, now())
        WHERE id = v_booking_id;
    ELSE
        INSERT INTO public.bookings (
            request_id,
            provider_profile_id,
            time_range,
            status
        )
        VALUES (
            p_request_id,
            v_provider_profile_id,
            v_time_range,
            'confirmed'
        )
        RETURNING id INTO v_booking_id;
    END IF;

    -- 5. Update request preferred_start
    UPDATE public.service_requests
    SET preferred_start = p_confirmed_start,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_request_id;

    -- 6. Insert confirmation chat message
    INSERT INTO public.messages (
        request_id,
        sender_id,
        content,
        message_type,
        payload
    )
    VALUES (
        p_request_id,
        COALESCE(p_confirmed_by, (SELECT customer_id FROM public.service_requests WHERE id = p_request_id)),
        'Start time confirmed for ' || to_char(p_confirmed_start AT TIME ZONE 'Asia/Kolkata', 'Dy, DD Mon YYYY at HH12:MI AM') || '. Booking is locked into the schedule.',
        'system',
        jsonb_build_object('event', 'time_confirmed', 'start_time', p_confirmed_start, 'booking_id', v_booking_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'booking_id', v_booking_id,
        'time_range', v_time_range::TEXT
    );
END;
$$;
