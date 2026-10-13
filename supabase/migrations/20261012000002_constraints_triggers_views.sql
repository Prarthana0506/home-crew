-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 2: CONSTRAINTS, TRIGGERS, AND VIEWS
-- Enforcing calendar gap rules, time check, exclusion constraints, views
-- ============================================================================

-- 1. EXCLUSION CONSTRAINT ON BOOKINGS (NO OVERLAPPING RANGES PER PROVIDER)
-- Ensures one provider_profile can never have overlapping time ranges
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_no_overlap_per_provider;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_no_overlap_per_provider
EXCLUDE USING gist (
    provider_profile_id WITH =,
    time_range WITH &&
)
WHERE (status IN ('confirmed', 'in_progress'));

-- 2. MANDATORY GAP TRIGGER ON BOOKINGS
-- Rejects a booking within the gap (settings.min_gap_hours, default 8) of another booking
-- for the same provider profile, counting from end to start.
CREATE OR REPLACE FUNCTION public.fn_check_booking_gap_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_gap_hours NUMERIC;
    v_gap_interval INTERVAL;
    v_conflict_count INTEGER;
BEGIN
    IF NEW.status NOT IN ('confirmed', 'in_progress') THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(
        (value->>'value')::NUMERIC,
        CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 8.0 END,
        8.0
    ) INTO v_gap_hours
    FROM public.settings
    WHERE key = 'min_gap_hours';

    IF v_gap_hours IS NULL THEN
        v_gap_hours := 8.0;
    END IF;

    v_gap_interval := (v_gap_hours || ' hours')::INTERVAL;

    -- Check gap between end of one booking and start of the other
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.bookings b
    WHERE b.provider_profile_id = NEW.provider_profile_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND b.status IN ('confirmed', 'in_progress')
      AND (
          -- Existing booking ends, and NEW booking starts within gap_hours
          (upper(b.time_range) <= lower(NEW.time_range) AND lower(NEW.time_range) < upper(b.time_range) + v_gap_interval)
          OR
          -- NEW booking ends, and existing booking starts within gap_hours
          (upper(NEW.time_range) <= lower(b.time_range) AND lower(b.time_range) < upper(NEW.time_range) + v_gap_interval)
      );

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Provider booking violates the %-hour mandatory gap rule between consecutive assignments.', v_gap_hours;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_booking_gap ON public.bookings;
CREATE TRIGGER trg_check_booking_gap
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_booking_gap_rule();

-- 3. ORDINARY START TIMES AND PRICING VALIDATION
-- Enforces ordinary service requests can only start between 8 AM and 7 PM (configurable in settings)
CREATE OR REPLACE FUNCTION public.fn_check_service_request_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIME;
    v_earliest TIME;
    v_latest TIME;
    v_cat_base_price NUMERIC;
    v_emerg_multiplier NUMERIC;
BEGIN
    v_start_time := (NEW.preferred_start AT TIME ZONE 'Asia/Kolkata')::TIME;

    IF NEW.type = 'ordinary' THEN
        SELECT COALESCE((value->>'value')::TIME, '08:00:00'::TIME) INTO v_earliest
        FROM public.settings WHERE key = 'ordinary_start_time_earliest';
        IF v_earliest IS NULL THEN v_earliest := '08:00:00'::TIME; END IF;

        SELECT COALESCE((value->>'value')::TIME, '19:00:00'::TIME) INTO v_latest
        FROM public.settings WHERE key = 'ordinary_start_time_latest';
        IF v_latest IS NULL THEN v_latest := '19:00:00'::TIME; END IF;

        IF v_start_time < v_earliest OR v_start_time > v_latest THEN
            RAISE EXCEPTION 'Ordinary service requests can only be scheduled between % and % IST.', v_earliest, v_latest;
        END IF;

        SELECT base_price INTO v_cat_base_price
        FROM public.service_categories WHERE id = NEW.category_id;

        IF v_cat_base_price IS NOT NULL THEN
            NEW.min_price := v_cat_base_price;
            IF NEW.offered_price < NEW.min_price THEN
                RAISE EXCEPTION 'Offered price (Rs %) cannot be lower than minimum base price (Rs %)', NEW.offered_price, NEW.min_price;
            END IF;
        END IF;
    ELSIF NEW.type = 'emergency' THEN
        SELECT base_price INTO v_cat_base_price
        FROM public.service_categories WHERE id = NEW.category_id;

        SELECT COALESCE(
            (value->>'value')::NUMERIC,
            CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 1.3 END,
            1.3
        ) INTO v_emerg_multiplier
        FROM public.settings WHERE key = 'emergency_multiplier';

        IF v_emerg_multiplier IS NULL THEN v_emerg_multiplier := 1.3; END IF;

        IF v_cat_base_price IS NOT NULL THEN
            NEW.min_price := ROUND(v_cat_base_price * v_emerg_multiplier);
            IF NEW.offered_price < NEW.min_price THEN
                RAISE EXCEPTION 'Emergency offered price (Rs %) cannot be lower than required base minimum with surcharge (Rs %)', NEW.offered_price, NEW.min_price;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_service_request_schedule ON public.service_requests;
CREATE TRIGGER trg_check_service_request_schedule
BEFORE INSERT OR UPDATE ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_service_request_schedule();

-- 4. VIEW FOR COINS BALANCE FROM COIN_LEDGER
CREATE OR REPLACE VIEW public.provider_coin_balances AS
SELECT
    pp.id AS provider_profile_id,
    pp.user_id,
    COALESCE(SUM(cl.amount), 0)::INTEGER AS coins_balance
FROM public.provider_profiles pp
LEFT JOIN public.coin_ledger cl ON cl.provider_profile_id = pp.id
GROUP BY pp.id, pp.user_id;

-- Public safe view for provider profiles with computed coins
CREATE OR REPLACE VIEW public.provider_profiles_with_coins AS
SELECT
    pp.id,
    pp.user_id,
    pp.organization_id,
    pp.provider_type,
    pp.skills,
    pp.categories,
    pp.experience,
    pp.working_hours,
    pp.working_days,
    pp.travel_radius_km,
    pp.rating_avg,
    pp.review_count,
    pp.status,
    pp.bid_banned_until,
    pp.created_at,
    pp.updated_at,
    COALESCE(pcb.coins_balance, 0)::INTEGER AS coins
FROM public.provider_profiles pp
LEFT JOIN public.provider_coin_balances pcb ON pcb.provider_profile_id = pp.id;

-- 5. APPEND-ONLY ENFORCEMENT ON COIN_LEDGER
CREATE OR REPLACE FUNCTION public.fn_coin_ledger_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'The coin_ledger table is append-only. Modifying or deleting records is strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_coin_ledger_append_only ON public.coin_ledger;
CREATE TRIGGER trg_coin_ledger_append_only
BEFORE UPDATE OR DELETE ON public.coin_ledger
FOR EACH ROW
EXECUTE FUNCTION public.fn_coin_ledger_append_only();

-- 6. SETTINGS HISTORY AUDIT TRIGGER
CREATE OR REPLACE FUNCTION public.fn_settings_track_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.settings_history (key, value, valid_from, valid_to, updated_by)
    VALUES (OLD.key, OLD.value, OLD.updated_at, timezone('utc'::text, now()), OLD.updated_by);
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settings_history ON public.settings;
CREATE TRIGGER trg_settings_history
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.fn_settings_track_history();

-- 7. BLIND REVIEWS AUTO-REVEAL TRIGGER
CREATE OR REPLACE FUNCTION public.fn_process_review_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_counterpart_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_counterpart_count
    FROM public.reviews
    WHERE request_id = NEW.request_id
      AND direction <> NEW.direction;

    IF v_counterpart_count > 0 THEN
        NEW.revealed := TRUE;
        UPDATE public.reviews
        SET revealed = TRUE
        WHERE request_id = NEW.request_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_review ON public.reviews;
CREATE TRIGGER trg_process_review
BEFORE INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.fn_process_review_submission();

-- 8. REVEALED REVIEWS PROVIDER STATS RECALCULATION
CREATE OR REPLACE FUNCTION public.fn_update_provider_rating_on_reveal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_prov_profile_id UUID;
    v_avg NUMERIC(3, 2);
    v_cnt INTEGER;
BEGIN
    IF NEW.revealed = TRUE AND NEW.direction = 'customer_to_provider' THEN
        SELECT id INTO v_prov_profile_id
        FROM public.provider_profiles
        WHERE user_id = NEW.reviewee_id
        LIMIT 1;

        IF v_prov_profile_id IS NOT NULL THEN
            SELECT
                ROUND(AVG(rating)::numeric, 2),
                COUNT(*)
            INTO v_avg, v_cnt
            FROM public.reviews
            WHERE reviewee_id = NEW.reviewee_id
              AND direction = 'customer_to_provider'
              AND revealed = TRUE;

            UPDATE public.provider_profiles
            SET rating_avg = COALESCE(v_avg, 0.00),
                review_count = COALESCE(v_cnt, 0),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_prov_profile_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rating_on_reveal ON public.reviews;
CREATE TRIGGER trg_update_rating_on_reveal
AFTER INSERT OR UPDATE OF revealed ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_provider_rating_on_reveal();
