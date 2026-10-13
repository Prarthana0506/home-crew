-- ============================================================================
-- Migration 11: Realtime Chat System per Confirmed Booking
-- Features:
-- 1. chat_conversations linked 1:1 to confirmed bookings
-- 2. chat_messages with text, image, and structured cards
-- 3. RLS: only customer, assigned provider/technician, and org owner
-- 4. Server-side validation: phone numbers (digits, Tamil, Hindi, spelled out),
--    links, profanity (EN & TA), and 20 msg/min rate limit
-- 5. Read-only 7 days after completion
-- 6. Address masking once job is completed
-- 7. Report message writing to disputes table
-- ============================================================================

-- -----------------------------------------------------------------------
-- 0. Extend disputes category check constraint
-- -----------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_category_check;
    ALTER TABLE public.disputes ADD CONSTRAINT disputes_category_check
        CHECK (category IN ('no_show', 'payment_dispute', 'damage_claim', 'quality_issue', 'chat_conduct', 'other'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- -----------------------------------------------------------------------
-- 1. Chat Conversations Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_booking ON public.chat_conversations (booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_request ON public.chat_conversations (request_id);

-- -----------------------------------------------------------------------
-- 2. Chat Messages Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'provider', 'technician', 'organization_owner', 'system')),
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'card_propose_time', 'card_confirm_time', 'card_share_address', 'card_on_the_way')),
    content TEXT CHECK (char_length(content) <= 1000),
    media_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_reported BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_booking ON public.chat_messages (booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages (created_at);

-- -----------------------------------------------------------------------
-- 3. Access Check Function
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_chat_access(p_booking_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_customer_id UUID;
    v_prov_user_id UUID;
    v_org_owner_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin bypass
    SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = p_user_id;
    IF v_is_admin IS TRUE THEN
        RETURN TRUE;
    END IF;

    -- Retrieve participants
    SELECT
        r.customer_id,
        pp.user_id,
        org.owner_id
    INTO
        v_customer_id,
        v_prov_user_id,
        v_org_owner_id
    FROM public.bookings b
    JOIN public.service_requests r ON r.id = b.request_id
    JOIN public.provider_profiles pp ON pp.id = b.provider_profile_id
    LEFT JOIN public.organizations org ON org.id = pp.organization_id
    WHERE b.id = p_booking_id;

    RETURN (
        p_user_id = v_customer_id OR
        p_user_id = v_prov_user_id OR
        (v_org_owner_id IS NOT NULL AND p_user_id = v_org_owner_id)
    );
END;
$$;

-- -----------------------------------------------------------------------
-- 4. Readonly Status Check Function
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_chat_readonly(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_b bookings%ROWTYPE;
    v_now TIMESTAMPTZ := now();
    v_completion_time TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    -- Cancelled or expired bookings are read-only
    IF v_b.status IN ('cancelled', 'expired', 'noshow') THEN
        RETURN TRUE;
    END IF;

    -- Completed bookings become read-only 7 days after completion
    IF v_b.status = 'completed' THEN
        v_completion_time := COALESCE(v_b.provider_marked_complete_at, v_b.customer_marked_complete_at, now());
        IF v_now >= v_completion_time + INTERVAL '7 days' THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

-- -----------------------------------------------------------------------
-- 5. Content Sanitization & Filter Function
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_chat_message(
    p_sender_id UUID,
    p_booking_id UUID,
    p_content TEXT,
    p_message_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent_count INTEGER;
    v_normalized TEXT;
    v_spelled_digit_count INTEGER;
BEGIN
    -- 1. Check Readonly
    IF public.is_chat_readonly(p_booking_id) THEN
        RAISE EXCEPTION 'Chat is read-only (either closed or 7 days post-completion).';
    END IF;

    -- 2. Rate limit: 20 messages per minute
    SELECT COUNT(*) INTO v_recent_count
    FROM public.chat_messages
    WHERE sender_id = p_sender_id AND created_at >= (now() - INTERVAL '1 minute');

    IF v_recent_count >= 20 THEN
        RAISE EXCEPTION 'Rate limit exceeded: You may send at most 20 messages per minute.';
    END IF;

    -- If card or system type without free-form text, skip text filter
    IF p_message_type != 'text' AND (p_content IS NULL OR length(trim(p_content)) = 0) THEN
        RETURN;
    END IF;

    v_normalized := lower(COALESCE(p_content, ''));

    -- 3. Length check
    IF char_length(v_normalized) > 1000 THEN
        RAISE EXCEPTION 'Message exceeds 1000 character limit.';
    END IF;

    -- 4. External links and emails filter
    IF v_normalized ~* '(https?://|ftp://|www\.|bit\.ly|t\.me|wa\.me|[a-z0-9.-]+\.(com|in|org|net|io|co|app|ai|me|ly)\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})' THEN
        RAISE EXCEPTION 'External links, websites, and email addresses are not permitted in chat for safety.';
    END IF;

    -- 5. Phone numbers filter:
    -- A) Standard digits sequence (7 or more digits even with separators)
    IF v_normalized ~ '(\+?[0-9][\s\-\.\(\)]{0,3}){7,15}' THEN
        RAISE EXCEPTION 'Sharing phone numbers or direct contact details is not allowed.';
    END IF;

    -- B) Tamil digits: ௦ ௧ ௨ ௩ ௪ ௫ ௬ ௭ ௮ ௯
    IF v_normalized ~ '([௦-௯][\s\-\.]{0,3}){5,15}' THEN
        RAISE EXCEPTION 'Sharing contact numbers using Tamil digits is not allowed.';
    END IF;

    -- C) Hindi / Devanagari digits: ० १ २ ३ ४ ५ ६ ७ ८ ९
    IF v_normalized ~ '([०-९][\s\-\.]{0,3}){5,15}' THEN
        RAISE EXCEPTION 'Sharing contact numbers using Hindi digits is not allowed.';
    END IF;

    -- D) Spelled-out English digits (e.g. "nine eight four...")
    -- Count occurrences of spelled numbers
    SELECT (
        (CASE WHEN v_normalized ~* '\bzero\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\bone\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\btwo\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\bthree\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\bfour\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\bfive\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\bsix\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\bseven\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\beight\b' THEN 1 ELSE 0 END) +
        (CASE WHEN v_normalized ~* '\bnine\b' THEN 1 ELSE 0 END)
    ) INTO v_spelled_digit_count;

    -- Check for concatenated or repeated spelled numbers
    IF v_spelled_digit_count >= 5 OR v_normalized ~* '(\b(zero|one|two|three|four|five|six|seven|eight|nine)\b[\s,.-]*){4,}' THEN
        RAISE EXCEPTION 'Sharing phone numbers by spelling out digits is not allowed.';
    END IF;

    -- E) Spelled-out Tamil digits
    IF v_normalized ~* '((பூஜ்ஜியம்|ஒன்று|ஒரு|இரண்டு|மூன்று|நான்கு|ஐந்து|ஆறு|ஏழு|எட்டு|ஒன்பது)[\s,.-]*){3,}' THEN
        RAISE EXCEPTION 'Sharing phone numbers using spelled-out Tamil numbers is not allowed.';
    END IF;

    -- F) Spelled-out Hindi digits
    IF v_normalized ~* '((शून्य|एक|दो|तीन|चार|पांच|पाँच|छह|सात|आठ|नौ)[\s,.-]*){3,}' THEN
        RAISE EXCEPTION 'Sharing phone numbers using spelled-out Hindi numbers is not allowed.';
    END IF;

    -- 6. Profanity filter (English and Tamil)
    IF v_normalized ~* '\b(fuck|shit|bitch|bastard|asshole|cunt|dick|pussy|motherfucker|whore|slut)\b' THEN
        RAISE EXCEPTION 'Inappropriate language is not permitted on this platform.';
    END IF;

    -- Tamil abusive terms (transliterated & Tamil script)
    IF v_normalized ~* '\b(thevidiya|thevadiya|otha|omala|kena|sunni|baadu|poolu|punda|தேவிடியா|புண்டை|சூத்து|சுன்னி)\b' THEN
        RAISE EXCEPTION 'Inappropriate language in Tamil is not permitted on this platform.';
    END IF;
END;
$$;

-- -----------------------------------------------------------------------
-- 6. Trigger to enforce validation on direct INSERT
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_chat_messages_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.validate_and_sanitize_chat_message(
        NEW.sender_id,
        NEW.booking_id,
        NEW.content,
        NEW.message_type
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_insert ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_insert
    BEFORE INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_chat_messages_before_insert();

-- -----------------------------------------------------------------------
-- 7. RPC: get_or_create_booking_conversation
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_booking_conversation(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking bookings%ROWTYPE;
    v_conv chat_conversations%ROWTYPE;
    v_req service_requests%ROWTYPE;
    v_caller UUID := auth.uid();
    v_is_readonly BOOLEAN;
    v_can_call BOOLEAN;
    v_job_start TIMESTAMPTZ;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.';
    END IF;

    -- Only allow chat once provider is confirmed
    IF v_booking.status NOT IN ('confirmed', 'in_progress', 'completed') THEN
        RAISE EXCEPTION 'Chat is created only once a provider is confirmed for the booking.';
    END IF;

    -- Validate caller access
    IF NOT public.user_has_chat_access(p_booking_id, v_caller) THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to view this chat.';
    END IF;

    SELECT * INTO v_req FROM public.service_requests WHERE id = v_booking.request_id;

    -- Create or fetch conversation
    INSERT INTO public.chat_conversations (booking_id, request_id)
    VALUES (p_booking_id, v_booking.request_id)
    ON CONFLICT (booking_id) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_conv;

    v_is_readonly := public.is_chat_readonly(p_booking_id);

    -- Masked Call eligibility: enabled only after confirmation and around job time (within 2h of start up to completion)
    v_job_start := lower(v_booking.time_range);
    v_can_call := (
        v_booking.status IN ('confirmed', 'in_progress') AND
        v_now >= (v_job_start - INTERVAL '2 hours')
    );

    RETURN jsonb_build_object(
        'id',                   v_conv.id,
        'booking_id',           v_booking.id,
        'request_id',           v_req.id,
        'request_title',        v_req.title,
        'booking_status',       v_booking.status,
        'job_start',            v_job_start,
        'job_end',              upper(v_booking.time_range),
        'is_readonly',          v_is_readonly,
        'can_call',             v_can_call,
        'created_at',           v_conv.created_at
    );
END;
$$;

-- -----------------------------------------------------------------------
-- 8. RPC: send_chat_message
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_chat_message(
    p_booking_id    UUID,
    p_message_type  TEXT,
    p_content       TEXT DEFAULT NULL,
    p_media_url     TEXT DEFAULT NULL,
    p_metadata      JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        UUID := auth.uid();
    v_conv_id       UUID;
    v_booking       bookings%ROWTYPE;
    v_req           service_requests%ROWTYPE;
    v_pp            provider_profiles%ROWTYPE;
    v_org           organizations%ROWTYPE;
    v_sender_role   TEXT;
    v_new_msg       chat_messages%ROWTYPE;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.';
    END IF;

    IF v_booking.status NOT IN ('confirmed', 'in_progress', 'completed') THEN
        RAISE EXCEPTION 'Chat is created only once a provider is confirmed.';
    END IF;

    SELECT * INTO v_req FROM public.service_requests WHERE id = v_booking.request_id;
    SELECT * INTO v_pp FROM public.provider_profiles WHERE id = v_booking.provider_profile_id;
    IF v_pp.organization_id IS NOT NULL THEN
        SELECT * INTO v_org FROM public.organizations WHERE id = v_pp.organization_id;
    END IF;

    -- Determine sender role
    IF v_caller = v_req.customer_id THEN
        v_sender_role := 'customer';
    ELSIF v_caller = v_pp.user_id THEN
        v_sender_role := CASE WHEN v_pp.provider_type = 'technician' THEN 'technician' ELSE 'provider' END;
    ELSIF v_org.owner_id IS NOT NULL AND v_caller = v_org.owner_id THEN
        v_sender_role := 'organization_owner';
    ELSE
        RAISE EXCEPTION 'Access denied: You are not a participant in this booking.';
    END IF;

    -- If sharing address, only customer can send
    IF p_message_type = 'card_share_address' AND v_sender_role != 'customer' THEN
        RAISE EXCEPTION 'Only the customer can share the service location address.';
    END IF;

    -- Fetch or create conversation
    SELECT id INTO v_conv_id FROM public.chat_conversations WHERE booking_id = p_booking_id;
    IF v_conv_id IS NULL THEN
        INSERT INTO public.chat_conversations (booking_id, request_id)
        VALUES (p_booking_id, v_booking.request_id)
        RETURNING id INTO v_conv_id;
    END IF;

    -- Insert message (trg_chat_messages_insert will run validation)
    INSERT INTO public.chat_messages (
        conversation_id,
        booking_id,
        sender_id,
        sender_role,
        message_type,
        content,
        media_url,
        metadata
    ) VALUES (
        v_conv_id,
        p_booking_id,
        v_caller,
        v_sender_role,
        p_message_type,
        p_content,
        p_media_url,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO v_new_msg;

    -- Update conversation updated_at
    UPDATE public.chat_conversations SET updated_at = now() WHERE id = v_conv_id;

    RETURN to_jsonb(v_new_msg);
END;
$$;

-- -----------------------------------------------------------------------
-- 9. RPC: get_chat_messages (with address masking post-completion)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_chat_messages(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_caller    UUID := auth.uid();
    v_booking   bookings%ROWTYPE;
    v_is_completed BOOLEAN;
    v_messages  JSONB;
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.';
    END IF;

    IF NOT public.user_has_chat_access(p_booking_id, v_caller) THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    v_is_completed := (v_booking.status = 'completed');

    -- Build json array of messages, masking full address if completed
    SELECT jsonb_agg(
        jsonb_build_object(
            'id',              m.id,
            'conversation_id', m.conversation_id,
            'booking_id',      m.booking_id,
            'sender_id',       m.sender_id,
            'sender_name',     p.name,
            'sender_role',     m.sender_role,
            'message_type',    m.message_type,
            'content',         m.content,
            'media_url',       m.media_url,
            'metadata',        CASE
                                  WHEN m.message_type = 'card_share_address' AND v_is_completed THEN
                                      jsonb_set(m.metadata, '{full_address}', '"[Address hidden after job completion]"'::jsonb)
                                  ELSE m.metadata
                               END,
            'is_reported',     m.is_reported,
            'created_at',      m.created_at
        ) ORDER BY m.created_at ASC
    )
    INTO v_messages
    FROM public.chat_messages m
    JOIN public.profiles p ON p.id = m.sender_id
    WHERE m.booking_id = p_booking_id;

    RETURN COALESCE(v_messages, '[]'::jsonb);
END;
$$;

-- -----------------------------------------------------------------------
-- 10. RPC: report_chat_message
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_chat_message(p_message_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller    UUID := auth.uid();
    v_msg       chat_messages%ROWTYPE;
    v_booking   bookings%ROWTYPE;
    v_dispute_id UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_msg FROM public.chat_messages WHERE id = p_message_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found.';
    END IF;

    SELECT * INTO v_booking FROM public.bookings WHERE id = v_msg.booking_id;

    IF NOT public.user_has_chat_access(v_msg.booking_id, v_caller) THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    -- Mark message as reported
    UPDATE public.chat_messages SET is_reported = TRUE WHERE id = p_message_id;

    -- Insert into disputes table
    INSERT INTO public.disputes (
        request_id,
        raised_by,
        category,
        description,
        status
    ) VALUES (
        v_booking.request_id,
        v_caller,
        'chat_conduct',
        'Reported message #' || p_message_id || ' by user ' || v_caller || '. Reason: ' || COALESCE(p_reason, 'Inappropriate behavior') || '. Content: ' || LEFT(COALESCE(v_msg.content, '[card/media]'), 300),
        'open'
    )
    RETURNING id INTO v_dispute_id;

    RETURN jsonb_build_object(
        'success',    TRUE,
        'message_id', p_message_id,
        'dispute_id', v_dispute_id
    );
END;
$$;

-- -----------------------------------------------------------------------
-- 11. Row Level Security Policies
-- -----------------------------------------------------------------------
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conversations_select ON public.chat_conversations;
CREATE POLICY chat_conversations_select ON public.chat_conversations
    FOR SELECT TO authenticated
    USING (public.user_has_chat_access(booking_id, auth.uid()));

DROP POLICY IF EXISTS chat_conversations_insert ON public.chat_conversations;
CREATE POLICY chat_conversations_insert ON public.chat_conversations
    FOR INSERT TO authenticated
    WITH CHECK (public.user_has_chat_access(booking_id, auth.uid()));

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
    FOR SELECT TO authenticated
    USING (public.user_has_chat_access(booking_id, auth.uid()));

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_has_chat_access(booking_id, auth.uid())
        AND sender_id = auth.uid()
        AND NOT public.is_chat_readonly(booking_id)
    );

-- -----------------------------------------------------------------------
-- 12. Permissions & Realtime Enablement
-- -----------------------------------------------------------------------
GRANT ALL ON TABLE public.chat_conversations TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_has_chat_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_readonly(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_and_sanitize_chat_message(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_booking_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_chat_message(UUID, TEXT) TO authenticated;

-- Enable Realtime
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
