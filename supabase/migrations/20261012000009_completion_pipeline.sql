-- ============================================================================
-- Migration 9: Completion Pipeline, Review System, No-show Flow
-- ============================================================================

-- -----------------------------------------------------------------------
-- 0. Settings additions (completion pipeline knobs)
-- -----------------------------------------------------------------------
INSERT INTO public.settings (key, value) VALUES
    ('review_open_delay_minutes',          '{"value": 30}'),
    ('auto_complete_customer_silent_hours', '{"value": 48}'),  -- provider done, customer silent 48h
    ('auto_complete_provider_silent_hours', '{"value": 24}'),  -- customer done, provider silent 24h
    ('auto_complete_both_silent_hours',     '{"value": 24}'),  -- neither marked after end + 24h -> ask both
    ('noshow_claim_delay_minutes',          '{"value": 30}'),
    ('review_reveal_days',                  '{"value": 7}'),
    ('review_bonus_table',                  '{"value": {"1":0,"2":1,"3":2,"4":3,"5":5}}'),
    ('review_completion_coins',             '{"value": 20}'),
    ('low_rating_warning_threshold',        '{"value": 3.0}'),
    ('low_rating_admin_approval_threshold', '{"value": 2.5}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- -----------------------------------------------------------------------
-- 1. Extend bookings & profiles tables
-- -----------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='provider_marked_complete_at') THEN
        ALTER TABLE public.bookings
            ADD COLUMN provider_marked_complete_at TIMESTAMPTZ,
            ADD COLUMN customer_marked_complete_at TIMESTAMPTZ,
            ADD COLUMN review_opens_at             TIMESTAMPTZ,
            ADD COLUMN completion_source           TEXT CHECK (completion_source IN ('both','auto_customer_silent','auto_provider_silent','auto_both_silent','admin')),
            ADD COLUMN noshow_claimed_at           TIMESTAMPTZ,
            ADD COLUMN noshow_claimed_by           UUID REFERENCES public.profiles(id),
            ADD COLUMN noshow_reviewed             BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='customer_rating_avg') THEN
        ALTER TABLE public.profiles
            ADD COLUMN customer_rating_avg   NUMERIC(3, 2) DEFAULT 5.00,
            ADD COLUMN customer_review_count INTEGER DEFAULT 0,
            ADD COLUMN customer_status       TEXT DEFAULT 'active' CHECK (customer_status IN ('active', 'warned', 'under_review', 'blocked'));
    END IF;
END; $$;

-- -----------------------------------------------------------------------
-- 2. Reviews table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    request_id              UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    reviewer_id             UUID NOT NULL REFERENCES public.profiles(id),
    reviewee_id             UUID NOT NULL REFERENCES public.profiles(id),
    reviewer_role           TEXT NOT NULL CHECK (reviewer_role IN ('customer','provider')),
    stars                   SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
    feedback                TEXT,
    -- Provider-to-customer specific tags
    tags                    TEXT[],
    paid_agreed_amount      BOOLEAN,
    -- Blind reveal
    revealed_at             TIMESTAMPTZ,
    -- For auto-reveal after 7 days even if other party hasn't reviewed
    reveal_deadline         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_id, reviewer_id)
);

-- Index for reveal queries
CREATE INDEX IF NOT EXISTS idx_reviews_reveal ON public.reviews (reveal_deadline) WHERE revealed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON public.reviews (booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews (reviewee_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_own ON public.reviews
    FOR ALL TO authenticated
    USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());

CREATE POLICY reviews_admin ON public.reviews
    FOR ALL TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- -----------------------------------------------------------------------
-- 3. Review bonus ledger reason extension (already handled by existing coin_ledger)
-- -----------------------------------------------------------------------

-- -----------------------------------------------------------------------
-- 4. mark_complete() RPC: provider or customer marks job done
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_complete(
    p_booking_id UUID,
    p_role TEXT   -- 'provider' or 'customer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking  bookings%ROWTYPE;
    v_request  service_requests%ROWTYPE;
    v_profile  profiles%ROWTYPE;
    v_now      TIMESTAMPTZ := now();
    v_delay_min INTEGER;
    v_review_opens_at TIMESTAMPTZ;
BEGIN
    -- Validate caller matches role
    SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
    IF p_role NOT IN ('provider', 'customer') THEN
        RAISE EXCEPTION 'Invalid role: %', p_role;
    END IF;

    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id;
    END IF;

    SELECT * INTO v_request FROM public.service_requests WHERE id = v_booking.request_id;

    -- Validate caller is part of this booking
    IF p_role = 'provider' THEN
        IF v_profile.id != (
            SELECT user_id FROM provider_profiles WHERE id = v_booking.provider_profile_id
        ) THEN
            RAISE EXCEPTION 'mark_complete: caller is not the assigned provider';
        END IF;
        IF v_booking.provider_marked_complete_at IS NOT NULL THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'already_marked');
        END IF;
        UPDATE public.bookings SET
            provider_marked_complete_at = v_now,
            updated_at                  = v_now
        WHERE id = p_booking_id;

    ELSIF p_role = 'customer' THEN
        IF v_profile.id != v_request.customer_id THEN
            RAISE EXCEPTION 'mark_complete: caller is not the customer for this booking';
        END IF;
        IF v_booking.customer_marked_complete_at IS NOT NULL THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'already_marked');
        END IF;
        UPDATE public.bookings SET
            customer_marked_complete_at = v_now,
            updated_at                  = v_now
        WHERE id = p_booking_id;
    END IF;

    -- Re-fetch to see if both are now set
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

    IF v_booking.provider_marked_complete_at IS NOT NULL
       AND v_booking.customer_marked_complete_at IS NOT NULL
       AND v_booking.review_opens_at IS NULL
    THEN
        SELECT COALESCE((value->'value')::INTEGER, 30)
        INTO v_delay_min
        FROM public.settings WHERE key = 'review_open_delay_minutes';

        v_review_opens_at := GREATEST(
            v_booking.provider_marked_complete_at,
            v_booking.customer_marked_complete_at
        ) + (v_delay_min || ' minutes')::INTERVAL;

        UPDATE public.bookings SET
            review_opens_at   = v_review_opens_at,
            completion_source = 'both',
            status            = 'completed',
            updated_at        = v_now
        WHERE id = p_booking_id;

        UPDATE public.service_requests SET
            status     = 'completed',
            updated_at = v_now
        WHERE id = v_request.id;

        RETURN jsonb_build_object(
            'success',          TRUE,
            'both_complete',    TRUE,
            'review_opens_at',  v_review_opens_at
        );
    END IF;

    RETURN jsonb_build_object(
        'success',                         TRUE,
        'both_complete',                   FALSE,
        'provider_marked',                 v_booking.provider_marked_complete_at IS NOT NULL,
        'customer_marked',                 v_booking.customer_marked_complete_at IS NOT NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_complete(UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------
-- 5. submit_review() RPC: submit a blind review
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_review(
    p_booking_id       UUID,
    p_stars            SMALLINT,
    p_feedback         TEXT DEFAULT NULL,
    p_tags             TEXT[] DEFAULT NULL,
    p_paid_agreed      BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking      bookings%ROWTYPE;
    v_request      service_requests%ROWTYPE;
    v_profile      profiles%ROWTYPE;
    v_provider_prof provider_profiles%ROWTYPE;
    v_reviewer_role TEXT;
    v_reviewee_id   UUID;
    v_now           TIMESTAMPTZ := now();
    v_reveal_days   INTEGER;
    v_reveal_deadline TIMESTAMPTZ;
    v_other_review  reviews%ROWTYPE;
    v_completion_coins INTEGER;
    v_bonus_table   JSONB;
    v_bonus_coins   INTEGER;
    v_new_avg       NUMERIC;
    v_review_count  INTEGER;
    v_existing_avg  NUMERIC;
    v_provider_user_id UUID;
    v_cust_count    INTEGER;
    v_cust_avg      NUMERIC;
    v_warn_thresh   NUMERIC;
    v_block_thresh  NUMERIC;
BEGIN
    SELECT * INTO v_profile  FROM public.profiles  WHERE id = auth.uid();
    SELECT * INTO v_booking  FROM public.bookings   WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id;
    END IF;

    SELECT * INTO v_request  FROM public.service_requests WHERE id = v_booking.request_id;
    SELECT * INTO v_provider_prof FROM public.provider_profiles WHERE id = v_booking.provider_profile_id;

    -- Review window must be open
    IF v_booking.review_opens_at IS NULL OR v_booking.review_opens_at > v_now THEN
        RAISE EXCEPTION 'Review window is not open yet. Opens at: %', v_booking.review_opens_at;
    END IF;

    -- Determine reviewer role and reviewee
    IF auth.uid() = v_request.customer_id THEN
        v_reviewer_role := 'customer';
        v_reviewee_id   := v_provider_prof.user_id;
    ELSIF auth.uid() = v_provider_prof.user_id THEN
        v_reviewer_role := 'provider';
        v_reviewee_id   := v_request.customer_id;
    ELSE
        RAISE EXCEPTION 'submit_review: caller is not a participant in this booking';
    END IF;

    -- Check no duplicate review
    IF EXISTS (
        SELECT 1 FROM public.reviews WHERE booking_id = p_booking_id AND reviewer_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this booking';
    END IF;

    -- Validate stars
    IF p_stars NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'Stars must be between 1 and 5';
    END IF;

    SELECT COALESCE((value->'value')::INTEGER, 7)
    INTO v_reveal_days
    FROM public.settings WHERE key = 'review_reveal_days';

    v_reveal_deadline := v_now + (v_reveal_days || ' days')::INTERVAL;

    -- Insert the review (not yet revealed)
    INSERT INTO public.reviews (
        booking_id, request_id, reviewer_id, reviewee_id, reviewer_role,
        stars, feedback, tags, paid_agreed_amount, reveal_deadline
    ) VALUES (
        p_booking_id, v_request.id, auth.uid(), v_reviewee_id, v_reviewer_role,
        p_stars, p_feedback, p_tags, p_paid_agreed, v_reveal_deadline
    );

    -- Check if the other party has also reviewed -> reveal both immediately
    SELECT * INTO v_other_review
    FROM public.reviews
    WHERE booking_id = p_booking_id
      AND reviewer_id != auth.uid()
    LIMIT 1;

    IF FOUND AND v_other_review.revealed_at IS NULL THEN
        -- Reveal both
        UPDATE public.reviews
        SET revealed_at = v_now, updated_at = v_now
        WHERE booking_id = p_booking_id;

        -- Award coins only when customer review is revealed (so we know stars)
        IF v_reviewer_role = 'customer' THEN
            -- Completion coins to provider
            SELECT COALESCE((value->'value')::INTEGER, 20)
            INTO v_completion_coins
            FROM public.settings WHERE key = 'review_completion_coins';

            SELECT value
            INTO v_bonus_table
            FROM public.settings WHERE key = 'review_bonus_table';

            v_bonus_coins := COALESCE((v_bonus_table->'value'->>p_stars::TEXT)::INTEGER, 0);

            INSERT INTO public.coin_ledger (provider_profile_id, amount, reason, reference_id)
            VALUES
                (v_booking.provider_profile_id, v_completion_coins, 'job_completion', v_booking.id),
                (v_booking.provider_profile_id, v_bonus_coins,      'review_bonus',   v_booking.id)
            ON CONFLICT DO NOTHING;
        ELSIF v_other_review.reviewer_role = 'customer' THEN
            -- Customer reviewed first, now provider has reviewed -> award based on customer stars
            SELECT COALESCE((value->'value')::INTEGER, 20)
            INTO v_completion_coins
            FROM public.settings WHERE key = 'review_completion_coins';

            SELECT value
            INTO v_bonus_table
            FROM public.settings WHERE key = 'review_bonus_table';

            v_bonus_coins := COALESCE((v_bonus_table->'value'->>v_other_review.stars::TEXT)::INTEGER, 0);

            INSERT INTO public.coin_ledger (provider_profile_id, amount, reason, reference_id)
            VALUES
                (v_booking.provider_profile_id, v_completion_coins, 'job_completion', v_booking.id),
                (v_booking.provider_profile_id, v_bonus_coins,      'review_bonus',   v_booking.id)
            ON CONFLICT DO NOTHING;
        END IF;

        -- Update provider avg rating from all revealed reviews
        SELECT COUNT(*), AVG(r.stars)
        INTO v_review_count, v_new_avg
        FROM public.reviews r
        JOIN public.bookings b ON b.id = r.booking_id
        WHERE b.provider_profile_id = v_booking.provider_profile_id
          AND r.reviewer_role = 'customer'
          AND r.revealed_at IS NOT NULL;

        UPDATE public.provider_profiles SET
            rating_avg   = ROUND(v_new_avg::NUMERIC, 2),
            review_count = v_review_count,
            updated_at   = v_now
        WHERE id = v_booking.provider_profile_id;

        -- Update customer avg rating from revealed provider reviews
        SELECT COUNT(*), AVG(r.stars)
        INTO v_cust_count, v_cust_avg
        FROM public.reviews r
        WHERE r.reviewee_id = v_request.customer_id
          AND r.reviewer_role = 'provider'
          AND r.revealed_at IS NOT NULL;

        IF v_cust_count > 0 THEN
            SELECT COALESCE((value->'value')::NUMERIC, 3.0) INTO v_warn_thresh
            FROM public.settings WHERE key = 'low_rating_warning_threshold';

            SELECT COALESCE((value->'value')::NUMERIC, 2.5) INTO v_block_thresh
            FROM public.settings WHERE key = 'low_rating_admin_approval_threshold';

            UPDATE public.profiles SET
                customer_rating_avg   = ROUND(v_cust_avg::NUMERIC, 2),
                customer_review_count = v_cust_count,
                customer_status = CASE
                    WHEN v_cust_avg < v_block_thresh THEN 'under_review'
                    WHEN v_cust_avg < v_warn_thresh  THEN 'warned'
                    ELSE 'active'
                END,
                updated_at = v_now
            WHERE id = v_request.customer_id;

            -- Low rating notifications & admin flagging
            IF v_cust_avg < v_block_thresh THEN
                INSERT INTO public.notifications (user_id, title, body, type, data)
                VALUES (
                    v_request.customer_id,
                    'Account Under Review',
                    'Your customer rating (' || ROUND(v_cust_avg::NUMERIC, 1) || '/5.0) is below 2.5. New requests are suspended pending admin review.',
                    'account_under_review',
                    jsonb_build_object('rating', v_cust_avg, 'booking_id', p_booking_id)
                );
            ELSIF v_cust_avg < v_warn_thresh THEN
                INSERT INTO public.notifications (user_id, title, body, type, data)
                VALUES (
                    v_request.customer_id,
                    'Customer Rating Warning',
                    'Your customer rating (' || ROUND(v_cust_avg::NUMERIC, 1) || '/5.0) is below 3.0. Please maintain polite communication and timely payments.',
                    'low_rating_warning',
                    jsonb_build_object('rating', v_cust_avg, 'booking_id', p_booking_id)
                );
            END IF;
        END IF;

    ELSIF NOT FOUND THEN
        -- First review in, coin award deferred until other party reviews (or 7-day auto-reveal)
        NULL;
    END IF;

    RETURN jsonb_build_object(
        'success',            TRUE,
        'reviewer_role',      v_reviewer_role,
        'stars',              p_stars,
        'both_reviewed',      (v_other_review.id IS NOT NULL),
        'revealed',           (v_other_review.id IS NOT NULL),
        'completion_coins',   COALESCE(v_completion_coins, 0),
        'bonus_coins',        COALESCE(v_bonus_coins, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(UUID, SMALLINT, TEXT, TEXT[], BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------
-- 6. claim_noshow() RPC: "Provider didn't show up" button
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_noshow(
    p_booking_id UUID,
    p_reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking    bookings%ROWTYPE;
    v_request    service_requests%ROWTYPE;
    v_now        TIMESTAMPTZ := now();
    v_noshow_delay_min INTEGER;
    v_job_start  TIMESTAMPTZ;
    v_provider_user_id UUID;
    v_penalty    JSONB;
    v_dispute_id UUID;
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

    SELECT * INTO v_request FROM public.service_requests WHERE id = v_booking.request_id;

    -- Only the customer can claim no-show
    IF auth.uid() != v_request.customer_id THEN
        RAISE EXCEPTION 'claim_noshow: only the customer can claim a no-show';
    END IF;

    -- Must be at least noshow_claim_delay_minutes after job start
    SELECT COALESCE((value->'value')::INTEGER, 30)
    INTO v_noshow_delay_min
    FROM public.settings WHERE key = 'noshow_claim_delay_minutes';

    v_job_start := lower(v_booking.time_range);
    IF v_now < v_job_start + (v_noshow_delay_min || ' minutes')::INTERVAL THEN
        RAISE EXCEPTION 'claim_noshow: must wait % minutes after job start. Job starts at: %',
            v_noshow_delay_min, v_job_start;
    END IF;

    -- Already claimed?
    IF v_booking.noshow_claimed_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'already_claimed');
    END IF;

    -- Provider user id
    SELECT user_id INTO v_provider_user_id FROM public.provider_profiles WHERE id = v_booking.provider_profile_id;

    -- Mark booking
    UPDATE public.bookings SET
        noshow_claimed_at = v_now,
        noshow_claimed_by = auth.uid(),
        status            = 'disputed',
        updated_at        = v_now
    WHERE id = p_booking_id;

    -- Update request status
    UPDATE public.service_requests SET status = 'disputed', updated_at = v_now WHERE id = v_request.id;

    -- Apply no-show penalty to provider
    BEGIN
        v_penalty := public.penalize_withdrawal_or_noshow(v_request.id, v_provider_user_id, 'no_show');
    EXCEPTION WHEN OTHERS THEN
        v_penalty := jsonb_build_object('error', SQLERRM);
    END;

    -- Create dispute record
    INSERT INTO public.disputes (request_id, raised_by, category, description, status)
    VALUES (v_request.id, auth.uid(), 'provider_noshow',
        'Customer claims provider did not show up. Reason: ' || p_reason, 'open')
    RETURNING id INTO v_dispute_id;

    -- Notify provider
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (v_provider_user_id,
        'No-show claim filed',
        'A customer has claimed you did not show up for booking on ' ||
            to_char(v_job_start, 'Mon DD at HH24:MI'),
        'noshow_claim',
        jsonb_build_object('booking_id', p_booking_id, 'dispute_id', v_dispute_id)
    );

    RETURN jsonb_build_object(
        'success',     TRUE,
        'dispute_id',  v_dispute_id,
        'penalty',     v_penalty
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_noshow(UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------
-- 7. reopen_after_noshow() RPC: copy post, carry paid fee, block provider
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_after_noshow(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking   bookings%ROWTYPE;
    v_old_req   service_requests%ROWTYPE;
    v_new_req_id UUID;
    v_now       TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

    SELECT * INTO v_old_req FROM public.service_requests WHERE id = v_booking.request_id;

    IF auth.uid() != v_old_req.customer_id THEN
        RAISE EXCEPTION 'reopen_after_noshow: only customer can reopen';
    END IF;

    IF v_booking.noshow_claimed_at IS NULL THEN
        RAISE EXCEPTION 'No no-show claim on this booking';
    END IF;

    -- Create a new request as a copy (carries fee_payment_id, excludes the no-show provider)
    INSERT INTO public.service_requests (
        customer_id, type, category_id, area_id, title, description,
        offered_price, min_price, preferred_start, provider_preference,
        status, fee_payment_id, images,
        excluded_provider_profile_id
    )
    SELECT
        customer_id, type, category_id, area_id,
        title, description, offered_price, min_price,
        preferred_start + INTERVAL '1 day',   -- shift start by 1 day
        provider_preference,
        CASE WHEN type = 'ordinary' THEN 'open' ELSE 'draft_fee' END,
        fee_payment_id,
        images,
        v_booking.provider_profile_id         -- block the no-show provider
    FROM public.service_requests
    WHERE id = v_old_req.id
    RETURNING id INTO v_new_req_id;

    RETURN jsonb_build_object(
        'success',      TRUE,
        'new_request_id', v_new_req_id,
        'blocked_provider_profile_id', v_booking.provider_profile_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_after_noshow(UUID) TO authenticated;

-- Add excluded_provider_profile_id column to service_requests if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='excluded_provider_profile_id') THEN
        ALTER TABLE public.service_requests
            ADD COLUMN excluded_provider_profile_id UUID REFERENCES public.provider_profiles(id);
    END IF;
END; $$;

-- -----------------------------------------------------------------------
-- 8. pg_cron: auto-complete ticks (every 10 minutes)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_completion_ticks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now                    TIMESTAMPTZ := now();
    v_provider_silent_hours  INTEGER;
    v_customer_silent_hours  INTEGER;
    v_both_silent_hours      INTEGER;
    v_review_delay_min       INTEGER;
    v_reveal_days            INTEGER;
    v_completion_coins       INTEGER;
    v_bonus_table            JSONB;
    v_auto_completed         INTEGER := 0;
    v_reviews_revealed       INTEGER := 0;
    b                        RECORD;
    r                        RECORD;
    v_job_end                TIMESTAMPTZ;
    v_review_opens_at        TIMESTAMPTZ;
    v_new_avg                NUMERIC;
    v_review_count           INTEGER;
    v_bonus_coins            INTEGER;
    v_cust_stars             SMALLINT;
BEGIN
    -- Load settings
    SELECT COALESCE((value->'value')::INTEGER, 48) INTO v_provider_silent_hours
    FROM public.settings WHERE key = 'auto_complete_provider_silent_hours';

    SELECT COALESCE((value->'value')::INTEGER, 24) INTO v_customer_silent_hours
    FROM public.settings WHERE key = 'auto_complete_customer_silent_hours';

    SELECT COALESCE((value->'value')::INTEGER, 24) INTO v_both_silent_hours
    FROM public.settings WHERE key = 'auto_complete_both_silent_hours';

    SELECT COALESCE((value->'value')::INTEGER, 30) INTO v_review_delay_min
    FROM public.settings WHERE key = 'review_open_delay_minutes';

    SELECT COALESCE((value->'value')::INTEGER, 7) INTO v_reveal_days
    FROM public.settings WHERE key = 'review_reveal_days';

    SELECT COALESCE((value->'value')::INTEGER, 20) INTO v_completion_coins
    FROM public.settings WHERE key = 'review_completion_coins';

    SELECT value INTO v_bonus_table FROM public.settings WHERE key = 'review_bonus_table';

    -- ------------------------------------------------------------------
    -- A. Auto-complete: provider marked + customer silent for 24h
    -- ------------------------------------------------------------------
    FOR b IN
        SELECT bk.* FROM public.bookings bk
        WHERE bk.status = 'confirmed'
          AND bk.provider_marked_complete_at IS NOT NULL
          AND bk.customer_marked_complete_at IS NULL
          AND bk.review_opens_at IS NULL
          AND bk.provider_marked_complete_at + (v_customer_silent_hours || ' hours')::INTERVAL <= v_now
    LOOP
        v_review_opens_at := v_now + (v_review_delay_min || ' minutes')::INTERVAL;
        UPDATE public.bookings SET
            customer_marked_complete_at = v_now,
            review_opens_at             = v_review_opens_at,
            completion_source           = 'auto_customer_silent',
            status                      = 'completed',
            updated_at                  = v_now
        WHERE id = b.id;

        UPDATE public.service_requests SET status = 'completed', updated_at = v_now WHERE id = b.request_id;

        v_auto_completed := v_auto_completed + 1;
    END LOOP;

    -- ------------------------------------------------------------------
    -- B. Auto-complete: customer marked + provider silent for 48h
    -- ------------------------------------------------------------------
    FOR b IN
        SELECT bk.* FROM public.bookings bk
        WHERE bk.status = 'confirmed'
          AND bk.customer_marked_complete_at IS NOT NULL
          AND bk.provider_marked_complete_at IS NULL
          AND bk.review_opens_at IS NULL
          AND bk.customer_marked_complete_at + (v_provider_silent_hours || ' hours')::INTERVAL <= v_now
    LOOP
        v_review_opens_at := v_now + (v_review_delay_min || ' minutes')::INTERVAL;
        UPDATE public.bookings SET
            provider_marked_complete_at = v_now,
            review_opens_at             = v_review_opens_at,
            completion_source           = 'auto_provider_silent',
            status                      = 'completed',
            updated_at                  = v_now
        WHERE id = b.id;

        UPDATE public.service_requests SET status = 'completed', updated_at = v_now WHERE id = b.request_id;

        v_auto_completed := v_auto_completed + 1;
    END LOOP;

    -- ------------------------------------------------------------------
    -- C. Auto-complete: neither marked 24h after job end -> ask both, auto-complete at 48h
    -- ------------------------------------------------------------------
    FOR b IN
        SELECT bk.*, sr.customer_id AS b_customer_id, pp.user_id AS b_prov_user_id
        FROM public.bookings bk
        JOIN public.service_requests sr ON sr.id = bk.request_id
        JOIN public.provider_profiles pp ON pp.id = bk.provider_profile_id
        WHERE bk.status = 'confirmed'
          AND bk.provider_marked_complete_at IS NULL
          AND bk.customer_marked_complete_at IS NULL
          AND bk.review_opens_at IS NULL
          AND upper(bk.time_range) + (v_both_silent_hours || ' hours')::INTERVAL <= v_now
    LOOP
        IF upper(b.time_range) + INTERVAL '48 hours' <= v_now THEN
            v_review_opens_at := v_now + (v_review_delay_min || ' minutes')::INTERVAL;
            UPDATE public.bookings SET
                provider_marked_complete_at = v_now,
                customer_marked_complete_at = v_now,
                review_opens_at             = v_review_opens_at,
                completion_source           = 'auto_both_silent',
                status                      = 'completed',
                updated_at                  = v_now
            WHERE id = b.id;

            UPDATE public.service_requests SET status = 'completed', updated_at = v_now WHERE id = b.request_id;
            v_auto_completed := v_auto_completed + 1;
        ELSE
            -- Ask both: prompt them to confirm status
            INSERT INTO public.notifications (user_id, title, body, type, data)
            VALUES
                (b.b_customer_id,  'Action Required: Confirm Service Completion', 'Your appointment ended over 24 hours ago. Please mark completed or report an issue.', 'confirm_completion_inquiry', jsonb_build_object('booking_id', b.id)),
                (b.b_prov_user_id, 'Action Required: Confirm Service Completion', 'Your assignment ended over 24 hours ago. Please mark completed or report an issue.', 'confirm_completion_inquiry', jsonb_build_object('booking_id', b.id));
        END IF;
    END LOOP;

    -- ------------------------------------------------------------------
    -- D. Auto-reveal reviews after reveal_deadline
    -- ------------------------------------------------------------------
    FOR r IN
        SELECT rv.*,
               bk.provider_profile_id AS bk_provider_profile_id,
               bk.request_id AS bk_request_id
        FROM public.reviews rv
        JOIN public.bookings bk ON bk.id = rv.booking_id
        WHERE rv.revealed_at IS NULL
          AND rv.reveal_deadline <= v_now
    LOOP
        -- Reveal this review
        UPDATE public.reviews SET revealed_at = v_now, updated_at = v_now WHERE id = r.id;

        -- Award coins if customer review and not yet awarded
        IF r.reviewer_role = 'customer' THEN
            -- check if coins already given
            IF NOT EXISTS (
                SELECT 1 FROM public.coin_ledger
                WHERE provider_profile_id = r.bk_provider_profile_id
                  AND reason = 'job_completion'
                  AND reference_id = r.booking_id
            ) THEN
                v_bonus_coins := COALESCE((v_bonus_table->'value'->>r.stars::TEXT)::INTEGER, 0);

                INSERT INTO public.coin_ledger (provider_profile_id, amount, reason, reference_id)
                VALUES
                    (r.bk_provider_profile_id, v_completion_coins, 'job_completion', r.booking_id),
                    (r.bk_provider_profile_id, v_bonus_coins,      'review_bonus',   r.booking_id);
            END IF;
        END IF;

        -- Update provider avg rating if reviewed by customer
        IF r.reviewer_role = 'customer' THEN
            SELECT COUNT(*), AVG(stars)
            INTO v_review_count, v_new_avg
            FROM public.reviews
            WHERE reviewee_id = r.reviewee_id
              AND reviewer_role = 'customer'
              AND revealed_at IS NOT NULL;

            IF v_review_count > 0 THEN
                UPDATE public.provider_profiles SET
                    rating_avg   = ROUND(v_new_avg::NUMERIC, 2),
                    review_count = v_review_count,
                    updated_at   = v_now
                WHERE user_id = r.reviewee_id;
            END IF;
        -- Update customer avg rating if reviewed by provider
        ELSIF r.reviewer_role = 'provider' THEN
            DECLARE
                v_c_count INTEGER;
                v_c_avg NUMERIC;
            BEGIN
                SELECT COUNT(*), AVG(stars)
                INTO v_c_count, v_c_avg
                FROM public.reviews
                WHERE reviewee_id = r.reviewee_id
                  AND reviewer_role = 'provider'
                  AND revealed_at IS NOT NULL;

                IF v_c_count > 0 THEN
                    UPDATE public.profiles SET
                        customer_rating_avg   = ROUND(v_c_avg::NUMERIC, 2),
                        customer_review_count = v_c_count,
                        customer_status = CASE
                            WHEN v_c_avg < 2.5 THEN 'under_review'
                            WHEN v_c_avg < 3.0 THEN 'warned'
                            ELSE 'active'
                        END,
                        updated_at = v_now
                    WHERE id = r.reviewee_id;
                END IF;
            END;
        END IF;

        v_reviews_revealed := v_reviews_revealed + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'auto_completed',    v_auto_completed,
        'reviews_revealed',  v_reviews_revealed,
        'evaluated_at',      v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_completion_ticks() TO service_role;

-- Schedule pg_cron every 10 minutes
SELECT cron.schedule(
    'completion-pipeline-ticks',
    '*/10 * * * *',
    $$SELECT public.evaluate_completion_ticks();$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- -----------------------------------------------------------------------
-- 9. get_completion_status() - for UI polling
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_completion_status(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking bookings%ROWTYPE;
    v_now     TIMESTAMPTZ := now();
    v_my_review reviews%ROWTYPE;
    v_other_review reviews%ROWTYPE;
    v_noshow_delay_min INTEGER;
    v_job_start TIMESTAMPTZ;
    v_can_claim_noshow BOOLEAN;
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

    SELECT COALESCE((value->'value')::INTEGER, 30)
    INTO v_noshow_delay_min
    FROM public.settings WHERE key = 'noshow_claim_delay_minutes';

    v_job_start := lower(v_booking.time_range);

    -- Can claim no-show if: job started 30+ min ago, no noshow already, status is confirmed
    v_can_claim_noshow := (
        v_booking.status = 'confirmed'
        AND v_booking.noshow_claimed_at IS NULL
        AND v_now >= v_job_start + (v_noshow_delay_min || ' minutes')::INTERVAL
    );

    SELECT * INTO v_my_review
    FROM public.reviews
    WHERE booking_id = p_booking_id AND reviewer_id = auth.uid();

    SELECT * INTO v_other_review
    FROM public.reviews
    WHERE booking_id = p_booking_id AND reviewer_id != auth.uid()
    LIMIT 1;

    RETURN jsonb_build_object(
        'booking_id',                  p_booking_id,
        'status',                      v_booking.status,
        'provider_marked_complete_at', v_booking.provider_marked_complete_at,
        'customer_marked_complete_at', v_booking.customer_marked_complete_at,
        'review_opens_at',             v_booking.review_opens_at,
        'review_window_open',          (v_booking.review_opens_at IS NOT NULL AND v_booking.review_opens_at <= v_now),
        'my_review_submitted',         (v_my_review.id IS NOT NULL),
        'other_reviewed',              (v_other_review.id IS NOT NULL),
        'reviews_revealed',            (v_my_review.id IS NOT NULL AND v_my_review.revealed_at IS NOT NULL),
        'can_claim_noshow',            v_can_claim_noshow,
        'noshow_claimed',              (v_booking.noshow_claimed_at IS NOT NULL),
        'noshow_claimed_at',           v_booking.noshow_claimed_at,
        'completion_source',           v_booking.completion_source,
        'job_start',                   v_job_start,
        'noshow_eligible_at',          v_job_start + (v_noshow_delay_min || ' minutes')::INTERVAL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_completion_status(UUID) TO authenticated;

-- -----------------------------------------------------------------------
-- 10. get_history() - enriched history for customer and provider screens
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_history(p_role TEXT)
RETURNS TABLE (
    booking_id              UUID,
    request_id              UUID,
    title                   TEXT,
    request_type            TEXT,
    status                  TEXT,
    job_start               TIMESTAMPTZ,
    job_end                 TIMESTAMPTZ,
    offered_price           NUMERIC,
    completion_source       TEXT,
    provider_name           TEXT,
    provider_rating_avg     NUMERIC,
    provider_review_count   INTEGER,
    customer_name           TEXT,
    my_review_stars         SMALLINT,
    my_review_feedback      TEXT,
    my_review_revealed      BOOLEAN,
    other_review_stars      SMALLINT,
    other_review_feedback   TEXT,
    other_review_revealed   BOOLEAN,
    review_opens_at         TIMESTAMPTZ,
    noshow_claimed_at       TIMESTAMPTZ,
    created_at              TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_role = 'customer' THEN
        RETURN QUERY
        SELECT
            bk.id,
            sr.id,
            sr.title,
            sr.type,
            sr.status,
            lower(bk.time_range),
            upper(bk.time_range),
            sr.offered_price,
            bk.completion_source,
            prof_prov.name,
            pp.rating_avg,
            pp.review_count,
            prof_cust.name,
            my_r.stars,
            my_r.feedback,
            (my_r.revealed_at IS NOT NULL),
            other_r.stars,
            other_r.feedback,
            (other_r.revealed_at IS NOT NULL),
            bk.review_opens_at,
            bk.noshow_claimed_at,
            bk.created_at
        FROM public.bookings bk
        JOIN public.service_requests sr      ON sr.id = bk.request_id
        JOIN public.provider_profiles pp     ON pp.id = bk.provider_profile_id
        JOIN public.profiles prof_prov       ON prof_prov.id = pp.user_id
        JOIN public.profiles prof_cust       ON prof_cust.id = sr.customer_id
        LEFT JOIN public.reviews my_r        ON my_r.booking_id = bk.id AND my_r.reviewer_id = auth.uid()
        LEFT JOIN public.reviews other_r     ON other_r.booking_id = bk.id AND other_r.reviewer_id != auth.uid()
        WHERE sr.customer_id = auth.uid()
          AND sr.status IN ('completed', 'disputed')
        ORDER BY bk.created_at DESC;

    ELSIF p_role = 'provider' THEN
        RETURN QUERY
        SELECT
            bk.id,
            sr.id,
            sr.title,
            sr.type,
            sr.status,
            lower(bk.time_range),
            upper(bk.time_range),
            sr.offered_price,
            bk.completion_source,
            prof_prov.name,
            pp.rating_avg,
            pp.review_count,
            prof_cust.name,
            my_r.stars,
            my_r.feedback,
            (my_r.revealed_at IS NOT NULL),
            other_r.stars,
            other_r.feedback,
            (other_r.revealed_at IS NOT NULL),
            bk.review_opens_at,
            bk.noshow_claimed_at,
            bk.created_at
        FROM public.bookings bk
        JOIN public.service_requests sr      ON sr.id = bk.request_id
        JOIN public.provider_profiles pp     ON pp.id = bk.provider_profile_id
        JOIN public.profiles prof_prov       ON prof_prov.id = pp.user_id
        JOIN public.profiles prof_cust       ON prof_cust.id = sr.customer_id
        LEFT JOIN public.reviews my_r        ON my_r.booking_id = bk.id AND my_r.reviewer_id = auth.uid()
        LEFT JOIN public.reviews other_r     ON other_r.booking_id = bk.id AND other_r.reviewer_id != auth.uid()
        WHERE pp.user_id = auth.uid()
          AND sr.status IN ('completed', 'disputed')
        ORDER BY bk.created_at DESC;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_history(TEXT) TO authenticated;

-- -----------------------------------------------------------------------
-- 10. Upgrade create_request() with Customer Low-Rating Gate & Review Gate
-- -----------------------------------------------------------------------
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
BEGIN
    -- -------------------------------------------------------------------------
    -- RULE 0: CUSTOMER LOW RATING CHECK (< 2.5 marks user for review / blocks requests)
    -- -------------------------------------------------------------------------
    SELECT customer_status, customer_rating_avg, customer_review_count
    INTO v_cust_prof
    FROM public.profiles
    WHERE id = p_customer_id;

    IF v_cust_prof.customer_status = 'under_review' OR (v_cust_prof.customer_review_count > 0 AND v_cust_prof.customer_rating_avg < 2.5) THEN
        RAISE EXCEPTION 'Customer rating violation: Your customer rating (%.2f) is below 2.5. New requests are suspended pending administrative approval.', COALESCE(v_cust_prof.customer_rating_avg, 0.0);
    END IF;

    -- -------------------------------------------------------------------------
    -- RULE 1: REVIEW GATE
    -- Refuse if customer has any completed job without a submitted review
    -- -------------------------------------------------------------------------
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

    -- -------------------------------------------------------------------------
    -- RULE 2: IMAGE COUNT (0 to 4 allowed)
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

        IF v_emergency_fee = 0.0 THEN
            v_final_status := 'bidding_active';
        ELSE
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

    -- INSERT
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
        status
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
        v_final_status
    )
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'status', v_final_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_request(UUID, TEXT, UUID, UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT[], TEXT, TEXT, UUID) TO authenticated, service_role;

