-- ============================================================================
-- Migration 12: Push Notifications, Device Tokens, Quiet Hours & Templates
-- Features:
-- 1. device_tokens registration & lifecycle
-- 2. notifications open tracking (opened_at)
-- 3. Quiet hours check (ordinary only, emergency bypasses)
-- 4. Multi-lingual templates (English & Tamil)
-- 5. pg_cron checks for bid_closing_soon (5m), mark_complete, review reminders
-- 6. Trigger-based push dispatch
-- ============================================================================

-- -----------------------------------------------------------------------
-- 0. Settings: Quiet Hours configuration
-- -----------------------------------------------------------------------
INSERT INTO public.settings (key, value) VALUES
    ('quiet_hours_enabled', '{"value": true}'),
    ('quiet_hours_start',   '{"value": "22:00"}'),
    ('quiet_hours_end',     '{"value": "07:00"}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- -----------------------------------------------------------------------
-- 1. Extend notifications table
-- -----------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='opened_at') THEN
        ALTER TABLE public.notifications
            ADD COLUMN opened_at TIMESTAMPTZ,
            ADD COLUMN push_delivered BOOLEAN DEFAULT FALSE NOT NULL,
            ADD COLUMN push_error TEXT,
            ADD COLUMN priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'emergency'));
    END IF;
END $$;

-- -----------------------------------------------------------------------
-- 2. RPC: save_device_token
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_device_token(
    p_token TEXT,
    p_platform TEXT DEFAULT 'web'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to save device token.';
    END IF;

    IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
        RAISE EXCEPTION 'Device token cannot be empty.';
    END IF;

    INSERT INTO public.device_tokens (user_id, token, platform, updated_at)
    VALUES (v_user_id, trim(p_token), COALESCE(p_platform, 'web'), now())
    ON CONFLICT (user_id, token) DO UPDATE
    SET platform = EXCLUDED.platform, updated_at = now();

    RETURN jsonb_build_object('success', TRUE, 'token', p_token);
END;
$$;

-- -----------------------------------------------------------------------
-- 3. RPC: delete_device_token
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_device_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthenticated');
    END IF;

    DELETE FROM public.device_tokens
    WHERE user_id = v_user_id AND token = p_token;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- -----------------------------------------------------------------------
-- 4. RPC: mark_notification_opened
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_opened(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    UPDATE public.notifications
    SET read = TRUE,
        opened_at = now()
    WHERE id = p_notification_id AND (user_id = v_user_id OR v_user_id IS NULL);

    RETURN jsonb_build_object('success', TRUE, 'notification_id', p_notification_id);
END;
$$;

-- -----------------------------------------------------------------------
-- 5. Helper: is_in_quiet_hours (Indian Standard Time UTC+05:30)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_in_quiet_hours()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_enabled BOOLEAN;
    v_start_str TEXT;
    v_end_str TEXT;
    v_ist_time TIME;
    v_start TIME;
    v_end TIME;
BEGIN
    SELECT COALESCE((value->>'value')::BOOLEAN, true) INTO v_enabled
    FROM public.settings WHERE key = 'quiet_hours_enabled';

    IF v_enabled IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    SELECT COALESCE(value->>'value', '22:00') INTO v_start_str
    FROM public.settings WHERE key = 'quiet_hours_start';

    SELECT COALESCE(value->>'value', '07:00') INTO v_end_str
    FROM public.settings WHERE key = 'quiet_hours_end';

    v_start := v_start_str::TIME;
    v_end := v_end_str::TIME;

    -- Current time in IST (UTC + 5 hours 30 mins)
    v_ist_time := (now() AT TIME ZONE 'Asia/Kolkata')::TIME;

    -- Overnight span: e.g. 22:00 to 07:00
    IF v_start > v_end THEN
        RETURN (v_ist_time >= v_start OR v_ist_time < v_end);
    ELSE
        RETURN (v_ist_time >= v_start AND v_ist_time < v_end);
    END IF;
END;
$$;

-- -----------------------------------------------------------------------
-- 6. Core Function: send_push
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_push(
    p_user_id       UUID,
    p_template      TEXT,
    p_data          JSONB DEFAULT '{}'::jsonb,
    p_is_emergency  BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lang          TEXT := 'en';
    v_in_quiet      BOOLEAN := FALSE;
    v_title         TEXT;
    v_body          TEXT;
    v_priority      TEXT := 'normal';
    v_target_url    TEXT := '/';
    v_image_url     TEXT := NULL;
    v_actions       JSONB := '[]'::jsonb;
    v_notif_id      UUID;
    v_token_count   INTEGER;
BEGIN
    -- 1. Fetch user language preference
    SELECT COALESCE(language, 'en') INTO v_lang
    FROM public.profiles WHERE id = p_user_id;

    -- 2. Quiet hours check
    IF p_is_emergency IS TRUE THEN
        v_priority := 'emergency';
    ELSE
        v_in_quiet := public.is_in_quiet_hours();
    END IF;

    -- 3. Localized Templates (English & Tamil)
    CASE p_template
        -- 1. Bid Invite (Emergency)
        WHEN 'bid_invite' THEN
            v_priority := 'emergency';
            v_image_url := p_data->>'image_url';
            v_target_url := '/?tab=bidding&req_id=' || COALESCE(p_data->>'request_id', '');
            IF v_lang = 'ta' THEN
                v_title := 'அவசர சேவை அழைப்பு: ' || COALESCE(p_data->>'category', 'சேவை');
                v_body  := 'பட்ஜெட்: ரூ ' || COALESCE(p_data->>'price', '') || ' (' || COALESCE(p_data->>'area', '') || '). 45 நிமிடங்களில் பதிலளிக்கவும்!';
                v_actions := '[{"action":"interested","title":"ஆர்வமுள்ளது"},{"action":"not_interested","title":"ஆர்வமில்லை"}]'::jsonb;
            ELSE
                v_title := 'Emergency Job Alert: ' || COALESCE(p_data->>'category', 'Service');
                v_body  := 'Budget: Rs ' || COALESCE(p_data->>'price', '') || ' in ' || COALESCE(p_data->>'area', '') || '. Respond within 45m!';
                v_actions := '[{"action":"interested","title":"Interested"},{"action":"not_interested","title":"Not Interested"}]'::jsonb;
            END IF;

        -- 2. Bid Opened
        WHEN 'bid_opened' THEN
            v_priority := 'emergency';
            v_target_url := '/?tab=bidding&req_id=' || COALESCE(p_data->>'request_id', '');
            IF v_lang = 'ta' THEN
                v_title := 'நேரடி ஏலம் தொடங்கியது';
                v_body  := '10 வல்லுநர்கள் இணைந்தனர். "' || COALESCE(p_data->>'title', 'பணி') || '" பணிக்கான ஏலம் தொடங்கியது!';
            ELSE
                v_title := 'Bidding Arena Open';
                v_body  := '10 providers joined. Live bidding has begun for "' || COALESCE(p_data->>'title', 'Job') || '"!';
            END IF;

        -- 3. Outbid
        WHEN 'outbid' THEN
            v_priority := 'high';
            v_target_url := '/?tab=bidding&req_id=' || COALESCE(p_data->>'request_id', '');
            IF v_lang = 'ta' THEN
                v_title := 'உங்கள் ஏலம் தாண்டப்பட்டது!';
                v_body  := '"' || COALESCE(p_data->>'title', '') || '" பணிக்கு ' || COALESCE(p_data->>'coins', '') || ' நாணயங்கள் புதிய ஏலம் வைக்கப்பட்டுள்ளது!';
            ELSE
                v_title := 'You were outbid!';
                v_body  := 'A new top bid of ' || COALESCE(p_data->>'coins', '') || ' coins was placed on "' || COALESCE(p_data->>'title', '') || '". Bid again to win!';
            END IF;

        -- 4. Bid Closing in 5 Minutes
        WHEN 'bid_closing_soon' THEN
            v_priority := 'high';
            v_target_url := '/?tab=bidding&req_id=' || COALESCE(p_data->>'request_id', '');
            IF v_lang = 'ta' THEN
                v_title := 'ஏலம் 5 நிமிடங்களில் முடிகிறது!';
                v_body  := '"' || COALESCE(p_data->>'title', '') || '" பணிக்கான ஏலக் காலம் விரைவில் முடிகிறது.';
            ELSE
                v_title := 'Bidding Closing in 5 Minutes!';
                v_body  := 'Final window to place your bid on "' || COALESCE(p_data->>'title', '') || '".';
            END IF;

        -- 5. You Won
        WHEN 'bid_won' THEN
            v_priority := 'high';
            v_target_url := '/?tab=calendar';
            IF v_lang = 'ta' THEN
                v_title := 'வாழ்த்துகள், நீங்கள் வென்றீர்கள்!';
                v_body  := '"' || COALESCE(p_data->>'title', '') || '" பணிக்கான ஒப்பந்தத்தை வென்றுள்ளீர்கள். அட்டவணையைப் பார்க்கவும்.';
            ELSE
                v_title := 'Congratulations, You Won!';
                v_body  := 'You won the bidding for "' || COALESCE(p_data->>'title', '') || '". Check your schedule.';
            END IF;

        -- 6. Job Accepted
        WHEN 'job_accepted' THEN
            v_target_url := '/?tab=calendar';
            IF v_lang = 'ta' THEN
                v_title := 'பணி ஏற்றுக்கொள்ளப்பட்டது';
                v_body  := COALESCE(p_data->>'provider_name', 'வல்லுநர்') || ' உங்கள் கோரிக்கையை ஏற்றுக்கொண்டார்: "' || COALESCE(p_data->>'title', '') || '".';
            ELSE
                v_title := 'Job Accepted';
                v_body  := COALESCE(p_data->>'provider_name', 'A provider') || ' accepted your service request: "' || COALESCE(p_data->>'title', '') || '".';
            END IF;

        -- 7. Time Confirmed
        WHEN 'time_confirmed' THEN
            v_target_url := '/?tab=calendar';
            IF v_lang = 'ta' THEN
                v_title := 'பணி நேரம் உறுதிசெய்யப்பட்டது';
                v_body  := COALESCE(p_data->>'time', '') || ' மணிக்கு ' || COALESCE(p_data->>'name', '') || ' உடன் பணி உறுதிசெய்யப்பட்டது.';
            ELSE
                v_title := 'Service Time Confirmed';
                v_body  := 'Scheduled for ' || COALESCE(p_data->>'time', '') || ' with ' || COALESCE(p_data->>'name', '') || '.';
            END IF;

        -- 8. Provider On The Way
        WHEN 'provider_on_the_way' THEN
            v_priority := 'high';
            v_target_url := '/?tab=calendar';
            IF v_lang = 'ta' THEN
                v_title := 'வல்லுநர் வந்து கொண்டிருக்கிறார்!';
                v_body  := COALESCE(p_data->>'name', 'தொழில்நுட்ப வல்லுநர்') || ' உங்கள் முகவரிக்கு வந்து கொண்டிருக்கிறார். வருகை: ' || COALESCE(p_data->>'eta', '15') || ' நிமி.';
            ELSE
                v_title := 'Technician On The Way!';
                v_body  := COALESCE(p_data->>'name', 'Technician') || ' is en route to your location. ETA: ' || COALESCE(p_data->>'eta', '15') || ' mins.';
            END IF;

        -- 9. Mark Complete Reminder
        WHEN 'mark_complete_reminder' THEN
            v_target_url := '/?tab=calendar';
            IF v_lang = 'ta' THEN
                v_title := 'பணி முடிவு நினைவூட்டல்';
                v_body  := '"' || COALESCE(p_data->>'title', '') || '" பணி முடிந்துவிட்டதா? செயலியில் முடிந்தது என குறிக்கவும்.';
            ELSE
                v_title := 'Job Complete Reminder';
                v_body  := 'Has the work on "' || COALESCE(p_data->>'title', '') || '" finished? Please mark complete.';
            END IF;

        -- 10. Review Reminder
        WHEN 'review_reminder' THEN
            v_target_url := '/?tab=history';
            IF v_lang = 'ta' THEN
                v_title := 'மதிப்பாய்வு செய்ய நேரம் வந்துவிட்டது';
                v_body  := '"' || COALESCE(p_data->>'title', '') || '" பணிக்கான உங்கள் மதிப்பீட்டை வழங்கவும்!';
            ELSE
                v_title := 'Blind Review Window Open';
                v_body  := 'Share your rating for "' || COALESCE(p_data->>'title', '') || '". Your review keeps our community trusted!';
            END IF;

        -- 11. No-Show
        WHEN 'noshow' THEN
            v_priority := 'high';
            v_target_url := '/?tab=history';
            IF v_lang = 'ta' THEN
                v_title := 'வருகையின்மை புகார்';
                v_body  := '"' || COALESCE(p_data->>'title', '') || '" பணிக்கான வருகையின்மை பதிவு செய்யப்பட்டுள்ளது. விவரங்களைப் பார்க்கவும்.';
            ELSE
                v_title := 'No-Show Reported';
                v_body  := 'A no-show report was logged for "' || COALESCE(p_data->>'title', '') || '". Tap to review.';
            END IF;

        -- 12. Dispute Opened
        WHEN 'dispute_opened' THEN
            v_priority := 'high';
            v_target_url := '/?tab=disputes';
            IF v_lang = 'ta' THEN
                v_title := 'சர்ச்சை பதிவு செய்யப்பட்டது';
                v_body  := '"' || COALESCE(p_data->>'title', '') || '" குறித்து புதிய சர்ச்சை பதிவு செய்யப்பட்டுள்ளது. நிர்வாகி பரிசீலித்து வருகிறார்.';
            ELSE
                v_title := 'Dispute Opened';
                v_body  := 'A dispute case has been opened regarding "' || COALESCE(p_data->>'title', '') || '". Platform admin is reviewing.';
            END IF;

        ELSE
            v_title := COALESCE(p_data->>'title', 'HomeCrew Notification');
            v_body  := COALESCE(p_data->>'body', 'You have a new service update.');
    END CASE;

    -- 4. Check device token count
    SELECT COUNT(*) INTO v_token_count
    FROM public.device_tokens
    WHERE user_id = p_user_id;

    -- 5. Log send in notifications table (In-App Inbox backup)
    INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        data,
        read,
        push_delivered,
        priority
    ) VALUES (
        p_user_id,
        v_title,
        v_body,
        p_template,
        p_data || jsonb_build_object(
            'url', v_target_url,
            'image_url', v_image_url,
            'actions', v_actions,
            'language', v_lang,
            'quiet_hours_delayed', v_in_quiet
        ),
        FALSE,
        (NOT v_in_quiet AND v_token_count > 0),
        v_priority
    )
    RETURNING id INTO v_notif_id;

    RETURN jsonb_build_object(
        'success',              TRUE,
        'notification_id',      v_notif_id,
        'title',                v_title,
        'body',                 v_body,
        'language',             v_lang,
        'quiet_hours_delayed',  v_in_quiet,
        'device_tokens_found',  v_token_count,
        'target_url',           v_target_url
    );
END;
$$;

-- -----------------------------------------------------------------------
-- 7. Automated Database Triggers for Events
-- -----------------------------------------------------------------------

-- A) Trigger on BIDS: outbid & bid_won
CREATE OR REPLACE FUNCTION public.trg_push_on_bids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req service_requests%ROWTYPE;
    v_prev_top_user UUID;
    v_winner_user UUID;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = NEW.request_id;

    -- Event: Outbid
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        -- Find previous highest bidder
        SELECT pp.user_id INTO v_prev_top_user
        FROM public.bids b
        JOIN public.provider_profiles pp ON pp.id = b.provider_profile_id
        WHERE b.request_id = NEW.request_id
          AND b.id != NEW.id
          AND b.status = 'outbid'
        ORDER BY b.coins DESC
        LIMIT 1;

        IF v_prev_top_user IS NOT NULL AND v_prev_top_user != NEW.provider_profile_id THEN
            PERFORM public.send_push(
                v_prev_top_user,
                'outbid',
                jsonb_build_object('request_id', v_req.id, 'title', v_req.title, 'coins', NEW.coins),
                TRUE
            );
        END IF;
    END IF;

    -- Event: Bid Won
    IF TG_OP = 'UPDATE' AND NEW.status = 'won' AND OLD.status != 'won' THEN
        SELECT user_id INTO v_winner_user
        FROM public.provider_profiles WHERE id = NEW.provider_profile_id;

        IF v_winner_user IS NOT NULL THEN
            PERFORM public.send_push(
                v_winner_user,
                'bid_won',
                jsonb_build_object('request_id', v_req.id, 'title', v_req.title),
                TRUE
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bids_push_notify ON public.bids;
CREATE TRIGGER trg_bids_push_notify
    AFTER INSERT OR UPDATE ON public.bids
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_push_on_bids();

-- B) Trigger on DISPUTES: dispute_opened
CREATE OR REPLACE FUNCTION public.trg_push_on_disputes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req service_requests%ROWTYPE;
    v_target_user UUID;
BEGIN
    SELECT * INTO v_req FROM public.service_requests WHERE id = NEW.request_id;

    -- If raised by customer, notify provider; if raised by provider, notify customer
    IF NEW.raised_by = v_req.customer_id THEN
        SELECT pp.user_id INTO v_target_user
        FROM public.provider_profiles pp
        WHERE pp.id = v_req.assigned_provider_profile_id;
    ELSE
        v_target_user := v_req.customer_id;
    END IF;

    IF v_target_user IS NOT NULL THEN
        PERFORM public.send_push(
            v_target_user,
            'dispute_opened',
            jsonb_build_object('request_id', v_req.id, 'title', v_req.title, 'dispute_id', NEW.id),
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disputes_push_notify ON public.disputes;
CREATE TRIGGER trg_disputes_push_notify
    AFTER INSERT ON public.disputes
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_push_on_disputes();

-- -----------------------------------------------------------------------
-- 8. Cron: Check bid closing in 5 mins and reminders
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_push_cron_ticks()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req RECORD;
    v_bidder RECORD;
    v_booking RECORD;
BEGIN
    -- 1. Bid closing in 5 minutes (between 4 and 6 minutes from now)
    FOR v_req IN
        SELECT *
        FROM public.service_requests
        WHERE status = 'bidding_open'
          AND bidding_closes_at IS NOT NULL
          AND bidding_closes_at BETWEEN (now() + INTERVAL '4 minutes') AND (now() + INTERVAL '6 minutes')
    LOOP
        -- Notify all active bidders on this request
        FOR v_bidder IN
            SELECT DISTINCT pp.user_id
            FROM public.bids b
            JOIN public.provider_profiles pp ON pp.id = b.provider_profile_id
            WHERE b.request_id = v_req.id
        LOOP
            PERFORM public.send_push(
                v_bidder.user_id,
                'bid_closing_soon',
                jsonb_build_object('request_id', v_req.id, 'title', v_req.title),
                TRUE
            );
        END LOOP;
    END LOOP;

    -- 2. Mark complete reminder (if 2 hours past job end and not completed)
    FOR v_booking IN
        SELECT b.*, r.title, r.customer_id, pp.user_id AS prov_user_id
        FROM public.bookings b
        JOIN public.service_requests r ON r.id = b.request_id
        JOIN public.provider_profiles pp ON pp.id = b.provider_profile_id
        WHERE b.status = 'in_progress'
          AND upper(b.time_range) < (now() - INTERVAL '2 hours')
          AND b.provider_marked_complete_at IS NULL
    LOOP
        PERFORM public.send_push(
            v_booking.prov_user_id,
            'mark_complete_reminder',
            jsonb_build_object('booking_id', v_booking.id, 'title', v_booking.title),
            FALSE
        );
    END LOOP;
END;
$$;

-- Schedule cron check every minute if pg_cron available
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('push_cron_ticks');
        PERFORM cron.schedule(
            'push_cron_ticks',
            '* * * * *',
            'SELECT public.check_push_cron_ticks();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- -----------------------------------------------------------------------
-- 9. Permissions & Realtime
-- -----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.save_device_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_device_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_opened(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_push(UUID, TEXT, JSONB, BOOLEAN) TO authenticated;

-- Allow authenticated users to view & update their own device tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS device_tokens_user_policy ON public.device_tokens;
CREATE POLICY device_tokens_user_policy ON public.device_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Realtime on notifications for in-app inbox
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
