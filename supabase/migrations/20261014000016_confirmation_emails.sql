-- Migration: 20261014000016_confirmation_emails.sql
-- Description: Create sent_emails table, email validation and sending RPCs,
--              and recipient resolution for request and booking confirmations.

BEGIN;

-- 1. Ensure profiles has email column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 2. Create sent_emails table
CREATE TABLE IF NOT EXISTS public.sent_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    recipient_role TEXT, -- 'customer' | 'provider' | 'admin'
    email_type TEXT NOT NULL, -- 'request_confirmation' | 'booking_confirmation'
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    body_html TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'pending' | 'invalid_email'
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read/write sent_emails" ON public.sent_emails;
CREATE POLICY "Public read/write sent_emails" ON public.sent_emails FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Add to supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sent_emails'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sent_emails;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if publication alteration is restricted
    NULL;
END $$;

-- 4. RPC: validate_and_send_email
CREATE OR REPLACE FUNCTION public.validate_and_send_email(
    p_user_id UUID,
    p_email TEXT,
    p_recipient_name TEXT,
    p_recipient_role TEXT,
    p_email_type TEXT,
    p_subject TEXT,
    p_body_text TEXT,
    p_body_html TEXT,
    p_request_id UUID DEFAULT NULL,
    p_booking_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email TEXT;
    v_is_valid BOOLEAN;
    v_email_id UUID;
BEGIN
    v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));

    -- Validate email format using standard RFC-compatible pattern
    -- Must have characters, @, domain, dot, and at least 2 char TLD
    v_is_valid := (v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

    IF NOT v_is_valid OR v_clean_email = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_email',
            'message', 'Not valid mail. Provide a valid mail and send the mail to the given mail.'
        );
    END IF;

    -- Update user profile email if user_id is provided
    IF p_user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET email = v_clean_email, updated_at = now()
        WHERE id = p_user_id;
    END IF;

    -- Insert into sent_emails table
    INSERT INTO public.sent_emails (
        recipient_email,
        recipient_name,
        recipient_role,
        email_type,
        subject,
        body_text,
        body_html,
        status,
        user_id,
        request_id,
        booking_id,
        created_at
    ) VALUES (
        v_clean_email,
        COALESCE(p_recipient_name, 'User'),
        COALESCE(p_recipient_role, 'customer'),
        p_email_type,
        p_subject,
        p_body_text,
        p_body_html,
        'sent',
        p_user_id,
        p_request_id,
        p_booking_id,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_email_id;

    -- Also record an in-app notification if user_id is provided
    IF p_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            title,
            body,
            type,
            data,
            read,
            priority,
            created_at
        ) VALUES (
            p_user_id,
            p_subject,
            p_body_text,
            'email_sent',
            jsonb_build_object(
                'email_id', v_email_id,
                'email_type', p_email_type,
                'recipient_email', v_clean_email,
                'request_id', p_request_id,
                'booking_id', p_booking_id
            ),
            false,
            'normal',
            timezone('utc'::text, now())
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'email_id', v_email_id,
        'email', v_clean_email,
        'message', 'Confirmation mail sent successfully.'
    );
END;
$$;

-- 5. RPC: get_booking_email_details
CREATE OR REPLACE FUNCTION public.get_booking_email_details(
    p_booking_id UUID DEFAULT NULL,
    p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req RECORD;
    v_booking RECORD;
    v_customer RECORD;
    v_provider RECORD;
    v_provider_user RECORD;
    v_category RECORD;
    v_area RECORD;
BEGIN
    -- Locate booking and request
    IF p_booking_id IS NOT NULL THEN
        SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
        IF FOUND THEN
            SELECT * INTO v_req FROM public.service_requests WHERE id = v_booking.request_id;
        END IF;
    END IF;

    IF v_req.id IS NULL AND p_request_id IS NOT NULL THEN
        SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
        IF FOUND THEN
            SELECT * INTO v_booking FROM public.bookings WHERE request_id = v_req.id ORDER BY created_at DESC LIMIT 1;
        END IF;
    END IF;

    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request or booking not found');
    END IF;

    -- Get customer profile
    SELECT * INTO v_customer FROM public.profiles WHERE id = v_req.customer_id;

    -- Get category & area
    SELECT name INTO v_category FROM public.service_categories WHERE id = v_req.category_id;
    SELECT name INTO v_area FROM public.areas WHERE id = v_req.area_id;

    -- Get provider profile if assigned
    IF v_req.assigned_provider_profile_id IS NOT NULL THEN
        SELECT * INTO v_provider FROM public.provider_profiles WHERE id = v_req.assigned_provider_profile_id;
        IF v_provider.user_id IS NOT NULL THEN
            SELECT * INTO v_provider_user FROM public.profiles WHERE id = v_provider.user_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req.id,
        'booking_id', v_booking.id,
        'title', v_req.title,
        'category_name', COALESCE(v_category.name, 'Home Service'),
        'area_name', COALESCE(v_area.name, 'Local Area'),
        'address', COALESCE(v_req.address_confidential, 'Customer Address'),
        'preferred_start', v_req.preferred_start,
        'scheduled_time', v_req.preferred_start,
        'price', COALESCE(v_req.offered_price, v_booking.final_price, 0),
        'customer', jsonb_build_object(
            'id', v_customer.id,
            'name', COALESCE(v_customer.name, 'Valued Customer'),
            'email', COALESCE(v_customer.email, ''),
            'phone', COALESCE(v_customer.phone, '')
        ),
        'provider', jsonb_build_object(
            'id', v_provider.id,
            'user_id', v_provider_user.id,
            'name', COALESCE(v_provider_user.name, 'Service Provider'),
            'email', COALESCE(v_provider_user.email, ''),
            'phone', COALESCE(v_provider_user.phone, '')
        )
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.validate_and_send_email(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_email_details(UUID, UUID) TO authenticated, anon;

COMMIT;
