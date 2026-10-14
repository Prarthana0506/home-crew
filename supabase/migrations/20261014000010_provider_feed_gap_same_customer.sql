-- Provider ordinary job feed: the mandatory gap now applies only to jobs from
-- the same customer as an existing booking with this provider. Direct time
-- overlap with any active booking still hides the job.

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
    SELECT pp.id, pp.provider_type, p.area_id
    INTO v_provider_profile_id, v_provider_type, v_provider_area_id
    FROM public.provider_profiles pp
    JOIN public.profiles p ON p.id = pp.user_id
    WHERE pp.user_id = p_provider_user_id;

    IF v_provider_profile_id IS NULL THEN
        RETURN;
    END IF;

    SELECT a.latitude, a.longitude, a.location
    INTO v_prov_lat, v_prov_lng, v_prov_loc
    FROM public.areas a
    WHERE a.id = v_provider_area_id;

    SELECT COALESCE(
        (value->>'value')::NUMERIC,
        CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 4.0 END,
        4.0
    ) INTO v_gap_hours
    FROM public.settings WHERE key = 'min_gap_hours';

    IF v_gap_hours IS NULL THEN v_gap_hours := 4.0; END IF;
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
        -- 1. Distance filter (within 13 km)
        (v_prov_loc IS NULL OR cj.distance_km <= 13.0)
        -- 2. Provider preference match
        AND (
            cj.provider_preference = 'either'
            OR (cj.provider_preference = 'freelancer' AND v_provider_type = 'freelancer')
            OR (cj.provider_preference = 'organization' AND v_provider_type IN ('organization_owner', 'technician'))
        )
        -- 3. Calendar fit: no overlap with any active booking, and no
        --    gap violation against this same customer's bookings
        AND NOT EXISTS (
            SELECT 1
            FROM public.bookings b
            JOIN public.service_requests bsr ON bsr.id = b.request_id
            WHERE b.provider_profile_id = v_provider_profile_id
              AND b.status IN ('confirmed', 'in_progress', 'hold')
              AND (
                  b.time_range && cj.proposed_range
                  OR (
                      bsr.customer_id = cj.customer_id
                      AND (
                          (upper(b.time_range) <= lower(cj.proposed_range)
                              AND lower(cj.proposed_range) < upper(b.time_range) + v_gap_interval)
                          OR
                          (upper(cj.proposed_range) <= lower(b.time_range)
                              AND lower(b.time_range) < upper(cj.proposed_range) + v_gap_interval)
                      )
                  )
              )
        )
    ORDER BY cj.preferred_start ASC;
END;
$$;