-- Mandatory gap is now 4 hours and applies only between bookings made by the
-- SAME customer with the SAME provider. Other customers are not subject to it.
-- Overlapping time ranges stay blocked for everyone by the
-- bookings_no_overlap_per_provider exclusion constraint (migration 02).

INSERT INTO public.settings (key, value, description)
VALUES (
    'min_gap_hours',
    '{"value": 4.0}'::jsonb,
    'Mandatory gap (hours) between repeat bookings by the same customer with the same provider'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

CREATE OR REPLACE FUNCTION public.fn_check_booking_gap_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gap_hours NUMERIC;
    v_gap_interval INTERVAL;
    v_customer_id UUID;
    v_conflict_count INTEGER;
BEGIN
    IF NEW.status NOT IN ('confirmed', 'in_progress') THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(
        (value->>'value')::NUMERIC,
        CASE WHEN value::TEXT ~ '^[0-9.]+$' THEN value::TEXT::NUMERIC ELSE 4.0 END,
        4.0
    ) INTO v_gap_hours
    FROM public.settings
    WHERE key = 'min_gap_hours';

    IF v_gap_hours IS NULL THEN
        v_gap_hours := 4.0;
    END IF;

    v_gap_interval := (v_gap_hours || ' hours')::INTERVAL;

    -- Customer who owns the request this booking belongs to
    SELECT sr.customer_id INTO v_customer_id
    FROM public.service_requests sr
    WHERE sr.id = NEW.request_id;

    IF v_customer_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Gap applies only against this customer's other bookings with this provider
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.bookings b
    JOIN public.service_requests sr ON sr.id = b.request_id
    WHERE b.provider_profile_id = NEW.provider_profile_id
      AND sr.customer_id = v_customer_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND b.status IN ('confirmed', 'in_progress')
      AND (
          (upper(b.time_range) <= lower(NEW.time_range)
              AND lower(NEW.time_range) < upper(b.time_range) + v_gap_interval)
          OR
          (upper(NEW.time_range) <= lower(b.time_range)
              AND lower(b.time_range) < upper(NEW.time_range) + v_gap_interval)
      );

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'A repeat booking with the same provider needs a %-hour gap after the previous one.', v_gap_hours;
    END IF;

    RETURN NEW;
END;
$$;