-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 13: ORGANIZATION MANAGEMENT
-- Full owner dashboard: add/remove/reassign technicians, eligibility checks,
-- org rating view, coins locked for emergency, ban/dispute carry-over by id hash.
-- ============================================================================

-- 1. ADD MISSING COLUMNS TO provider_profiles (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='provider_profiles' AND column_name='photo_url') THEN
        ALTER TABLE public.provider_profiles ADD COLUMN photo_url TEXT;
    END IF;

    -- id_proof_url already exists from core schema; guard anyway
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='provider_profiles' AND column_name='id_proof_url') THEN
        ALTER TABLE public.provider_profiles ADD COLUMN id_proof_url TEXT;
    END IF;

    -- archived_at: when a technician is removed (status = 'left'), record timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='provider_profiles' AND column_name='archived_at') THEN
        ALTER TABLE public.provider_profiles ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;

    -- admin_approved: organization owner approves the technician before they appear in bidding pool
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='provider_profiles' AND column_name='admin_approved') THEN
        ALTER TABLE public.provider_profiles ADD COLUMN admin_approved BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- 2. VIEW: ORGANIZATION RATING (active technicians only, min 1 review)
CREATE OR REPLACE VIEW public.organization_rating AS
SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    COUNT(pp.id) FILTER (WHERE pp.status = 'active') AS active_technician_count,
    ROUND(
        COALESCE(AVG(pp.rating_avg) FILTER (WHERE pp.status = 'active' AND pp.review_count > 0), 0)::numeric,
        2
    ) AS rating_avg,
    COALESCE(SUM(pp.review_count) FILTER (WHERE pp.status = 'active'), 0) AS total_reviews,
    COALESCE(SUM(pcb.coins_balance) FILTER (WHERE pp.status = 'active'), 0) AS total_active_coins
FROM public.organizations o
LEFT JOIN public.provider_profiles pp ON pp.organization_id = o.id
LEFT JOIN public.provider_coin_balances pcb ON pcb.provider_profile_id = pp.id
GROUP BY o.id, o.name;

-- 3. VIEW: TECHNICIAN DASHBOARD ROW (all data owner needs on one screen)
-- Returns per technician: profile info, coins, rating, next free slot, admin_approved,
-- bid eligibility flags, upcoming job count.
CREATE OR REPLACE VIEW public.org_technician_dashboard AS
SELECT
    pp.id                          AS provider_profile_id,
    pp.user_id,
    pp.organization_id,
    pp.provider_type,
    pp.skills,
    pp.categories,
    pp.experience,
    pp.working_hours,
    pp.status                      AS provider_status,
    pp.admin_approved,
    pp.bid_banned_until,
    pp.verified_id_hash,
    pp.photo_url,
    pp.id_proof_url,
    pp.archived_at,
    pp.rating_avg,
    pp.review_count,
    COALESCE(pcb.coins_balance, 0)::INTEGER AS coins,
    -- available (soft-locked) coins
    COALESCE(pac.available_coins, 0)::INTEGER AS available_coins,
    -- profile info
    pr.name                        AS technician_name,
    pr.phone                       AS technician_phone,
    pr.area_id,
    pr.avatar,
    -- upcoming bookings count
    COALESCE(upj.upcoming_count, 0) AS upcoming_job_count,
    -- next free slot approximation: end of last confirmed booking + gap
    upj.next_busy_until,
    -- bid eligibility flags (owner sees why a technician is blocked)
    (
        COALESCE(pac.available_coins, 0) >= 35
        AND pp.review_count >= 3
        AND pp.rating_avg >= 3.5
        AND pp.status = 'active'
        AND pp.admin_approved = TRUE
        AND (pp.bid_banned_until IS NULL OR pp.bid_banned_until <= now())
    ) AS is_eligible_to_bid,
    -- individual flag breakdown
    (COALESCE(pac.available_coins, 0) >= 35)                           AS has_enough_coins,
    (pp.review_count >= 3)                                              AS has_enough_reviews,
    (pp.rating_avg >= 3.5)                                             AS has_good_rating,
    (pp.status = 'active')                                              AS is_active,
    (pp.admin_approved = TRUE)                                          AS is_approved,
    (pp.bid_banned_until IS NULL OR pp.bid_banned_until <= now())       AS not_banned
FROM public.provider_profiles pp
JOIN public.profiles pr ON pr.id = pp.user_id
LEFT JOIN public.provider_coin_balances pcb ON pcb.provider_profile_id = pp.id
LEFT JOIN public.provider_available_coins pac ON pac.provider_profile_id = pp.id
LEFT JOIN (
    SELECT
        b.provider_profile_id,
        COUNT(*) FILTER (WHERE upper(b.time_range) > now() AND b.status IN ('confirmed','in_progress')) AS upcoming_count,
        MAX(upper(b.time_range)) FILTER (WHERE b.status IN ('confirmed','in_progress'))               AS next_busy_until
    FROM public.bookings b
    GROUP BY b.provider_profile_id
) upj ON upj.provider_profile_id = pp.id
WHERE pp.provider_type = 'technician';

-- 4. RPC: org_add_technician
-- Owner creates a technician profile under their organization.
-- Returns provider_profile_id on success.
-- Admin approval is initially FALSE; owner sets it via org_approve_technician.
CREATE OR REPLACE FUNCTION public.org_add_technician(
    p_organization_id   UUID,
    p_name              TEXT,
    p_phone             TEXT,
    p_skills            TEXT[]   DEFAULT '{}',
    p_categories        TEXT[]   DEFAULT '{}',
    p_experience        INTEGER  DEFAULT 0,
    p_working_hours     JSONB    DEFAULT '{"start":"08:00:00","end":"19:00:00"}'::jsonb,
    p_photo_url         TEXT     DEFAULT NULL,
    p_id_proof_url      TEXT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_user_id     UUID;
    v_caller_id         UUID := auth.uid();
    v_new_profile_id    UUID;
    v_new_pp_id         UUID;
    v_verified_hash     TEXT;
    v_existing_hash     TEXT;
    v_existing_pp_id    UUID;
BEGIN
    -- Caller must be the organization owner
    SELECT owner_id INTO v_owner_user_id
    FROM public.organizations WHERE id = p_organization_id;

    IF v_owner_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    IF v_caller_id <> v_owner_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the organization owner can add technicians');
    END IF;

    -- Derive a deterministic id hash from phone (cheap fingerprint; real impl would use pgcrypto on ID doc)
    v_verified_hash := encode(digest(lower(trim(p_phone)), 'sha256'), 'hex');

    -- Check if this identity was previously removed (status=left) and carry over ban/disputes
    SELECT id INTO v_existing_pp_id
    FROM public.provider_profiles
    WHERE verified_id_hash = v_verified_hash
      AND organization_id = p_organization_id
      AND status = 'left'
    ORDER BY archived_at DESC NULLS LAST
    LIMIT 1;

    -- Create the auth-less profile stub (technicians do not have their own auth account by default)
    INSERT INTO public.profiles (id, role, name, phone, phone_demo_verified, language, status)
    VALUES (gen_random_uuid(), 'provider', trim(p_name), trim(p_phone), true, 'en', 'active')
    RETURNING id INTO v_new_profile_id;

    -- Create fresh provider_profile with 0 coins (coin ledger starts empty)
    -- bid_banned_until and open disputes are carried over by verified_id_hash in eligibility checks,
    -- NOT written back here, so the fresh profile truly starts at 0 coins.
    INSERT INTO public.provider_profiles (
        user_id, organization_id, provider_type,
        skills, categories, experience,
        working_hours, status,
        photo_url, id_proof_url,
        verified_id_hash, admin_approved
    )
    VALUES (
        v_new_profile_id, p_organization_id, 'technician',
        p_skills, p_categories, p_experience,
        p_working_hours, 'pending',
        p_photo_url, p_id_proof_url,
        v_verified_hash, false
    )
    RETURNING id INTO v_new_pp_id;

    RETURN jsonb_build_object(
        'success', true,
        'provider_profile_id', v_new_pp_id,
        'profile_id', v_new_profile_id,
        'verified_id_hash', v_verified_hash,
        'had_prior_record', (v_existing_pp_id IS NOT NULL)
    );
END;
$$;

-- 5. RPC: org_approve_technician
-- Owner approves a pending technician (sets admin_approved = true, status = active).
CREATE OR REPLACE FUNCTION public.org_approve_technician(
    p_provider_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id        UUID;
    v_owner_id      UUID;
    v_caller_id     UUID := auth.uid();
BEGIN
    SELECT pp.organization_id, o.owner_id
    INTO v_org_id, v_owner_id
    FROM public.provider_profiles pp
    JOIN public.organizations o ON o.id = pp.organization_id
    WHERE pp.id = p_provider_profile_id AND pp.provider_type = 'technician';

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Technician not found');
    END IF;
    IF v_caller_id <> v_owner_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the organization owner can approve technicians');
    END IF;

    UPDATE public.provider_profiles
    SET admin_approved = true, status = 'active', updated_at = now()
    WHERE id = p_provider_profile_id;

    RETURN jsonb_build_object('success', true, 'provider_profile_id', p_provider_profile_id, 'status', 'active');
END;
$$;

-- 6. RPC: org_remove_technician
-- Archives a technician (status = 'left').
-- Blocked if upcoming confirmed/in_progress bookings exist.
-- Returns warning about coins and rating loss; actual data preserved in archived record.
CREATE OR REPLACE FUNCTION public.org_remove_technician(
    p_provider_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id      UUID;
    v_caller_id     UUID := auth.uid();
    v_upcoming_cnt  INTEGER;
    v_coins         INTEGER;
    v_rating        NUMERIC;
BEGIN
    SELECT o.owner_id
    INTO v_owner_id
    FROM public.provider_profiles pp
    JOIN public.organizations o ON o.id = pp.organization_id
    WHERE pp.id = p_provider_profile_id AND pp.provider_type = 'technician';

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Technician not found or not part of your organization');
    END IF;
    IF v_caller_id <> v_owner_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the organization owner can remove technicians');
    END IF;

    -- Block if upcoming jobs exist
    SELECT COUNT(*) INTO v_upcoming_cnt
    FROM public.bookings b
    WHERE b.provider_profile_id = p_provider_profile_id
      AND b.status IN ('confirmed', 'in_progress')
      AND upper(b.time_range) > now();

    IF v_upcoming_cnt > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format(
                'Cannot remove technician: %s upcoming job(s) still active. Reassign or complete them first.',
                v_upcoming_cnt
            ),
            'upcoming_job_count', v_upcoming_cnt
        );
    END IF;

    -- Read current coins & rating for warning message
    SELECT COALESCE(pcb.coins_balance, 0), pp.rating_avg
    INTO v_coins, v_rating
    FROM public.provider_profiles pp
    LEFT JOIN public.provider_coin_balances pcb ON pcb.provider_profile_id = pp.id
    WHERE pp.id = p_provider_profile_id;

    -- Archive: set status = 'left', stamp archived_at
    -- bid_banned_until and verified_id_hash are deliberately retained for carry-over.
    UPDATE public.provider_profiles
    SET status = 'left',
        archived_at = now(),
        admin_approved = false,
        updated_at = now()
    WHERE id = p_provider_profile_id;

    -- Deactivate the profile stub so they can no longer log in
    UPDATE public.profiles
    SET status = 'deactivated', updated_at = now()
    WHERE id = (
        SELECT user_id FROM public.provider_profiles WHERE id = p_provider_profile_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'provider_profile_id', p_provider_profile_id,
        'archived_at', now(),
        'warning', format(
            'Technician archived. Their %s coins and %.1f-star rating remain stored in their archived profile but will no longer affect the organization rating. If this technician rejoins later, they start with 0 coins; any active bid bans and open disputes will carry over by identity hash.',
            v_coins, v_rating
        )
    );
END;
$$;

-- 7. RPC: org_reassign_technician
-- Reassigns a booking (before job start) from one technician to another.
-- New technician must pass the same eligibility checks as the old one.
-- p_reason: 'emergency' or 'ordinary' (determines whether coins are locked immediately).
CREATE OR REPLACE FUNCTION public.org_reassign_technician(
    p_booking_id              UUID,
    p_new_provider_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id          UUID;
    v_caller_id         UUID := auth.uid();
    v_old_pp_id         UUID;
    v_org_id            UUID;
    v_request_id        UUID;
    v_req_status        TEXT;
    v_req_type          TEXT;
    v_job_start         TIMESTAMPTZ;
    v_new_pp_org        UUID;
    v_new_coins         INTEGER;
    v_new_rating        NUMERIC;
    v_new_reviews       INTEGER;
    v_new_banned_until  TIMESTAMPTZ;
    v_new_status        TEXT;
    v_new_approved      BOOLEAN;
    v_clash_cnt         INTEGER;
    v_time_range        TSTZRANGE;
BEGIN
    -- Resolve booking
    SELECT b.provider_profile_id, b.request_id, b.time_range
    INTO v_old_pp_id, v_request_id, v_time_range
    FROM public.bookings b
    WHERE b.id = p_booking_id AND b.status IN ('confirmed', 'hold');

    IF v_old_pp_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking not found or already started/completed');
    END IF;

    v_job_start := lower(v_time_range);
    IF v_job_start <= now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot reassign after job has started');
    END IF;

    -- Get request details
    SELECT sr.status, sr.type INTO v_req_status, v_req_type
    FROM public.service_requests sr WHERE sr.id = v_request_id;

    -- Caller must be org owner of the old technician
    SELECT pp.organization_id INTO v_org_id
    FROM public.provider_profiles pp WHERE pp.id = v_old_pp_id;

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o WHERE o.id = v_org_id;

    IF v_caller_id <> v_owner_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the organization owner can reassign bookings');
    END IF;

    -- New technician must belong to same org
    SELECT pp.organization_id INTO v_new_pp_org
    FROM public.provider_profiles pp WHERE pp.id = p_new_provider_profile_id;

    IF v_new_pp_org IS DISTINCT FROM v_org_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'New technician must belong to the same organization');
    END IF;

    -- Eligibility checks for new technician (same rules as bid eligibility)
    SELECT
        COALESCE(pac.available_coins, 0),
        pp.rating_avg,
        pp.review_count,
        pp.bid_banned_until,
        pp.status,
        pp.admin_approved
    INTO v_new_coins, v_new_rating, v_new_reviews, v_new_banned_until, v_new_status, v_new_approved
    FROM public.provider_profiles pp
    LEFT JOIN public.provider_available_coins pac ON pac.provider_profile_id = pp.id
    WHERE pp.id = p_new_provider_profile_id;

    IF v_new_status <> 'active' OR NOT v_new_approved THEN
        RETURN jsonb_build_object('success', false, 'error', 'New technician is not active or not approved');
    END IF;
    IF v_new_coins < 35 THEN
        RETURN jsonb_build_object('success', false, 'error', format('New technician has only %s coins (minimum 35 required)', v_new_coins));
    END IF;
    IF v_new_reviews < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', format('New technician has only %s reviews (minimum 3 required)', v_new_reviews));
    END IF;
    IF v_new_rating < 3.5 THEN
        RETURN jsonb_build_object('success', false, 'error', format('New technician rating %.1f is below the 3.5 minimum', v_new_rating));
    END IF;
    IF v_new_banned_until IS NOT NULL AND v_new_banned_until > now() THEN
        RETURN jsonb_build_object('success', false, 'error', format('New technician is bid-banned until %s', v_new_banned_until));
    END IF;

    -- Check calendar clash for new technician
    SELECT COUNT(*) INTO v_clash_cnt
    FROM public.bookings b
    WHERE b.provider_profile_id = p_new_provider_profile_id
      AND b.id <> p_booking_id
      AND b.status IN ('confirmed', 'in_progress')
      AND b.time_range && v_time_range;

    IF v_clash_cnt > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'New technician has a calendar clash at that time');
    END IF;

    -- Perform reassignment: update booking and service_request
    UPDATE public.bookings
    SET provider_profile_id = p_new_provider_profile_id,
        updated_at = now()
    WHERE id = p_booking_id;

    UPDATE public.service_requests
    SET assigned_provider_profile_id = p_new_provider_profile_id,
        updated_at = now()
    WHERE id = v_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'old_provider_profile_id', v_old_pp_id,
        'new_provider_profile_id', p_new_provider_profile_id
    );
END;
$$;

-- 8. RPC: org_check_technician_eligibility
-- Returns a JSON object with detailed bid eligibility for a given technician.
-- Used by owner before picking a technician for an emergency job.
CREATE OR REPLACE FUNCTION public.org_check_technician_eligibility(
    p_provider_profile_id UUID,
    p_request_id          UUID DEFAULT NULL   -- if provided, also checks calendar clash
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_coins         INTEGER;
    v_rating        NUMERIC;
    v_reviews       INTEGER;
    v_banned_until  TIMESTAMPTZ;
    v_status        TEXT;
    v_approved      BOOLEAN;
    v_clash_cnt     INTEGER := 0;
    v_req_range     TSTZRANGE;
    v_reasons       TEXT[] := '{}';
    v_eligible      BOOLEAN;
    v_hash          TEXT;
    v_prior_ban     TIMESTAMPTZ;
BEGIN
    SELECT
        COALESCE(pac.available_coins, 0),
        pp.rating_avg,
        pp.review_count,
        pp.bid_banned_until,
        pp.status,
        pp.admin_approved,
        pp.verified_id_hash
    INTO v_coins, v_rating, v_reviews, v_banned_until, v_status, v_approved, v_hash
    FROM public.provider_profiles pp
    LEFT JOIN public.provider_available_coins pac ON pac.provider_profile_id = pp.id
    WHERE pp.id = p_provider_profile_id;

    IF v_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Technician not found');
    END IF;

    -- Check if identity hash carries an active ban from a prior profile
    IF v_hash IS NOT NULL THEN
        SELECT MAX(pp2.bid_banned_until) INTO v_prior_ban
        FROM public.provider_profiles pp2
        WHERE pp2.verified_id_hash = v_hash
          AND pp2.id <> p_provider_profile_id
          AND pp2.bid_banned_until IS NOT NULL;

        IF v_prior_ban IS NOT NULL AND v_prior_ban > now() THEN
            IF v_banned_until IS NULL OR v_prior_ban > v_banned_until THEN
                v_banned_until := v_prior_ban;
            END IF;
        END IF;
    END IF;

    IF v_status <> 'active' THEN
        v_reasons := array_append(v_reasons, format('Technician status is "%s" (must be active)', v_status));
    END IF;
    IF NOT v_approved THEN
        v_reasons := array_append(v_reasons, 'Technician is pending owner approval');
    END IF;
    IF v_coins < 35 THEN
        v_reasons := array_append(v_reasons, format('Needs at least 35 available coins (current: %s, need %s more)', v_coins, 35 - v_coins));
    END IF;
    IF v_reviews < 3 THEN
        v_reasons := array_append(v_reasons, format('Needs at least 3 customer reviews (current: %s)', v_reviews));
    END IF;
    IF v_rating < 3.5 THEN
        v_reasons := array_append(v_reasons, format('Rating %.1f is below the 3.5 minimum', v_rating));
    END IF;
    IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
        v_reasons := array_append(v_reasons, format('Bid-banned until %s', to_char(v_banned_until AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM')));
    END IF;

    -- Calendar clash check
    IF p_request_id IS NOT NULL THEN
        SELECT tstzrange(sr.preferred_start, sr.preferred_start + make_interval(hours => sr.estimated_duration_hours::INTEGER))
        INTO v_req_range
        FROM public.service_requests sr WHERE sr.id = p_request_id;

        IF v_req_range IS NOT NULL THEN
            SELECT COUNT(*) INTO v_clash_cnt
            FROM public.bookings b
            WHERE b.provider_profile_id = p_provider_profile_id
              AND b.status IN ('confirmed', 'in_progress')
              AND b.time_range && v_req_range;

            IF v_clash_cnt > 0 THEN
                v_reasons := array_append(v_reasons, 'Calendar clash: technician is already booked at that time');
            END IF;
        END IF;
    END IF;

    v_eligible := (array_length(v_reasons, 1) IS NULL);

    RETURN jsonb_build_object(
        'eligible', v_eligible,
        'provider_profile_id', p_provider_profile_id,
        'available_coins', v_coins,
        'rating_avg', v_rating,
        'review_count', v_reviews,
        'banned_until', v_banned_until,
        'status', v_status,
        'admin_approved', v_approved,
        'calendar_clash', v_clash_cnt > 0,
        'reasons', v_reasons
    );
END;
$$;

-- 9. RPC: org_owner_pick_technician_for_emergency
-- Owner selects a specific technician for an emergency job before bidding.
-- Coins are soft-locked (they participate in the bid as that technician).
-- The provider_profile_id written to the bid is the technician's.
CREATE OR REPLACE FUNCTION public.org_owner_pick_technician_for_emergency(
    p_request_id              UUID,
    p_technician_profile_id   UUID,
    p_coins                   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id        UUID;
    v_owner_id      UUID;
    v_caller_id     UUID := auth.uid();
    v_tech_org      UUID;
    v_eligibility   JSONB;
    v_req_status    TEXT;
    v_result        JSONB;
BEGIN
    -- Verify caller owns an organization
    SELECT o.id, o.owner_id INTO v_org_id, v_owner_id
    FROM public.organizations o
    WHERE o.owner_id = v_caller_id
    LIMIT 1;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Caller is not an organization owner');
    END IF;

    -- Technician must belong to caller's org
    SELECT pp.organization_id INTO v_tech_org
    FROM public.provider_profiles pp WHERE pp.id = p_technician_profile_id;

    IF v_tech_org IS DISTINCT FROM v_org_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Technician does not belong to your organization');
    END IF;

    -- Check request is in interest_window or bidding_open
    SELECT status INTO v_req_status FROM public.service_requests WHERE id = p_request_id;
    IF v_req_status NOT IN ('interest_window', 'bidding_open', 'notified') THEN
        RETURN jsonb_build_object('success', false, 'error', format('Request is not in a biddable state (current: %s)', v_req_status));
    END IF;

    -- Run eligibility check (with clash detection)
    v_eligibility := public.org_check_technician_eligibility(p_technician_profile_id, p_request_id);

    IF NOT (v_eligibility->>'eligible')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Technician is not eligible to bid',
            'reasons', v_eligibility->'reasons'
        );
    END IF;

    -- Place bid on behalf of the technician (coins are soft-locked via provider_available_coins view)
    SELECT public.place_emergency_bid(p_request_id, p_technician_profile_id, p_coins, 'Organization bid by owner') INTO v_result;

    RETURN v_result;
END;
$$;

-- 10. RLS POLICIES for new org_* functions (they are SECURITY DEFINER so no additional policies needed
-- but we add a policy so org owners can read all technicians in their org)

-- Allow org owners to read all provider_profiles in their org
DROP POLICY IF EXISTS "Org owner reads own technicians" ON public.provider_profiles;
CREATE POLICY "Org owner reads own technicians"
ON public.provider_profiles FOR SELECT
USING (
    organization_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_id AND o.owner_id = auth.uid()
    )
);

-- Technician can read their own profile
DROP POLICY IF EXISTS "Technician reads own profile" ON public.provider_profiles;
CREATE POLICY "Technician reads own profile"
ON public.provider_profiles FOR SELECT
USING (user_id = auth.uid());

-- 11. Grant execute on new RPCs to authenticated users
GRANT EXECUTE ON FUNCTION public.org_add_technician TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_approve_technician TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_remove_technician TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_reassign_technician TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_check_technician_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_owner_pick_technician_for_emergency TO authenticated;

-- Grant select on new views
GRANT SELECT ON public.organization_rating TO authenticated;
GRANT SELECT ON public.org_technician_dashboard TO authenticated;
