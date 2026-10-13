-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 5: CUSTOMER POSTING FLOW
-- Server-side validation: min price, image count, review gate, fee gating
-- ============================================================================

-- 1. SETUP STORAGE BUCKET FOR SERVICE IMAGES (IF STORAGE SCHEMA EXISTS)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('service-images', 'service-images', true)
        ON CONFLICT (id) DO NOTHING;

        -- Allow public read access to service-images
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read service images'
        ) THEN
            CREATE POLICY "Public read service images"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'service-images');
        END IF;

        -- Allow authenticated uploads to service-images
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload service images'
        ) THEN
            CREATE POLICY "Authenticated upload service images"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id = 'service-images');
        END IF;
    END IF;
END $$;

-- 2. HELPER: GET PENDING UNREVIEWED COMPLETED REQUEST FOR A CUSTOMER
CREATE OR REPLACE FUNCTION public.get_customer_pending_review(p_customer_id UUID)
RETURNS TABLE (
    request_id UUID,
    title TEXT,
    completed_at TIMESTAMPTZ,
    category_name TEXT,
    provider_name TEXT,
    provider_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sr.id AS request_id,
        sr.title,
        sr.updated_at AS completed_at,
        sc.name AS category_name,
        COALESCE(pp_prof.name, 'Assigned Technician') AS provider_name,
        pp.user_id AS provider_user_id
    FROM public.service_requests sr
    JOIN public.service_categories sc ON sc.id = sr.category_id
    LEFT JOIN public.provider_profiles pp ON pp.id = sr.assigned_provider_profile_id
    LEFT JOIN public.profiles pp_prof ON pp_prof.id = pp.user_id
    LEFT JOIN public.reviews r ON r.request_id = sr.id AND r.direction = 'customer_to_provider'
    WHERE sr.customer_id = p_customer_id
      AND sr.status = 'completed'
      AND r.id IS NULL
    ORDER BY sr.updated_at ASC
    LIMIT 1;
END;
$$;

-- 3. HELPER: RECORD EMERGENCY FEE PAYMENT
CREATE OR REPLACE FUNCTION public.record_emergency_fee_payment(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_status TEXT,
    p_payment_method TEXT DEFAULT 'UPI',
    p_transaction_ref TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id UUID;
    v_fee_version INTEGER;
BEGIN
    -- Read fee version or default to 1
    SELECT COALESCE((value->>'version')::INTEGER, 1) INTO v_fee_version
    FROM public.settings WHERE key = 'emergency_fee';

    IF v_fee_version IS NULL THEN v_fee_version := 1; END IF;

    IF p_status NOT IN ('paid', 'waived', 'pending') THEN
        RAISE EXCEPTION 'Invalid payment status: %', p_status;
    END IF;

    INSERT INTO public.emergency_fee_payments (
        customer_id,
        amount,
        status,
        fee_version,
        payment_method,
        transaction_ref
    )
    VALUES (
        p_customer_id,
        p_amount,
        p_status,
        v_fee_version,
        p_payment_method,
        COALESCE(p_transaction_ref, 'TXN-' || floor(random() * 899999 + 100000)::text)
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$;

-- 4. ATOMIC CREATE REQUEST FUNCTION ENFORCING ALL VALIDATION RULES
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
BEGIN
    -- -------------------------------------------------------------------------
    -- RULE 1: REVIEW GATE
    -- Refuse if customer has any completed job without a submitted review
    -- -------------------------------------------------------------------------
    SELECT sr.id INTO v_unreviewed_id
    FROM public.service_requests sr
    LEFT JOIN public.reviews r ON r.request_id = sr.id AND r.direction = 'customer_to_provider'
    WHERE sr.customer_id = p_customer_id
      AND sr.status = 'completed'
      AND r.id IS NULL
    LIMIT 1;

    IF v_unreviewed_id IS NOT NULL THEN
        RAISE EXCEPTION 'Review gate violation: You cannot post a new service request until you submit a review for your previously completed job (Request ID: %).', v_unreviewed_id;
    END IF;

    -- -------------------------------------------------------------------------
    -- RULE 2: IMAGE COUNT
    -- Must be between 0 and 4 images
    -- -------------------------------------------------------------------------
    IF p_images IS NOT NULL AND cardinality(p_images) > 4 THEN
        RAISE EXCEPTION 'Image count violation: Maximum 4 images allowed (provided %).', cardinality(p_images);
    END IF;

    -- -------------------------------------------------------------------------
    -- RULE 3: SERVICE TYPE AND CATEGORY BASE PRICE VALIDATION
    -- -------------------------------------------------------------------------
    IF p_type NOT IN ('ordinary', 'emergency') THEN
        RAISE EXCEPTION 'Invalid service type: %. Must be ordinary or emergency.', p_type;
    END IF;

    SELECT * INTO v_category
    FROM public.service_categories
    WHERE id = p_category_id AND active = true;

    IF v_category IS NULL THEN
        RAISE EXCEPTION 'Invalid service category or category is inactive.';
    END IF;

    -- -------------------------------------------------------------------------
    -- RULE 4: MINIMUM PRICE ENFORCEMENT
    -- Ordinary = base_price; Emergency = ROUND(base_price * emergency_multiplier)
    -- -------------------------------------------------------------------------
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

    -- -------------------------------------------------------------------------
    -- RULE 5: SCHEDULE VALIDATION
    -- Ordinary: 2 to 3 days advance, start time between 8:00 AM and 7:00 PM
    -- Emergency: minimum lead hours check
    -- -------------------------------------------------------------------------
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
        -- Emergency lead time
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

        -- ---------------------------------------------------------------------
        -- RULE 6: EMERGENCY FEE GATING
        -- Job goes live into bidding_active ONLY when fee payment is paid or waived
        -- ---------------------------------------------------------------------
        SELECT COALESCE(
            (value->>'value')::NUMERIC,
            CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 50.0 END,
            50.0
        ) INTO v_emergency_fee
        FROM public.settings WHERE key = 'emergency_fee';

        IF v_emergency_fee IS NULL THEN v_emergency_fee := 0.0; END IF;

        IF v_emergency_fee = 0.0 THEN
            -- Fee is zero: automatically waived, job goes live
            v_final_status := 'bidding_active';
        ELSE
            -- Fee is required: verify payment record
            IF p_fee_payment_id IS NULL THEN
                RAISE EXCEPTION 'Emergency fee gating: Payment reference required. Fee of Rs % must be paid or waived before job goes live.', v_emergency_fee;
            END IF;

            SELECT status INTO v_payment_status
            FROM public.emergency_fee_payments
            WHERE id = p_fee_payment_id AND customer_id = p_customer_id;

            IF v_payment_status IS NULL THEN
                RAISE EXCEPTION 'Emergency fee gating: Payment record % not found for customer.', p_fee_payment_id;
            END IF;

            IF v_payment_status IN ('paid', 'waived') THEN
                v_final_status := 'bidding_active';
            ELSE
                RAISE EXCEPTION 'Emergency fee gating: Payment status is %, but must be paid or waived for job to go live.', v_payment_status;
            END IF;
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- INSERT THE VALIDATED SERVICE REQUEST
    -- -------------------------------------------------------------------------
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
        estimated_duration_hours,
        status,
        images,
        provider_preference,
        fee_payment_id,
        address_confidential
    )
    VALUES (
        p_customer_id,
        p_type,
        p_category_id,
        p_area_id,
        p_title,
        p_description,
        p_offered_price,
        v_min_price,
        p_preferred_start,
        2.0,
        v_final_status,
        COALESCE(p_images, '{}'),
        COALESCE(p_provider_preference, 'either'),
        p_fee_payment_id,
        p_address_confidential
    )
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'status', v_final_status,
        'min_price', v_min_price,
        'offered_price', p_offered_price,
        'type', p_type
    );
END;
$$;
