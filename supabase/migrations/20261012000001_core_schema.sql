-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 1: EXTENSIONS AND CORE TABLES
-- Master context database migration with PostgreSQL, PostGIS, and btree_gist
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. AREAS TABLE (Coimbatore Localities with PostGIS points)
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    pincode TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_areas_location ON public.areas USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_areas_pincode ON public.areas (pincode);

-- 3. SETTINGS, SETTINGS HISTORY, AND AUDIT LOG
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_settings_history_key ON public.settings_history (key);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    performed_by UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at);

-- 4. SERVICE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_ta TEXT,
    icon TEXT NOT NULL,
    default_image TEXT NOT NULL,
    base_price NUMERIC NOT NULL CHECK (base_price > 0),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_categories_slug ON public.service_categories (slug);
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON public.service_categories (active);

-- 5. PROFILES TABLE (Linked 1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('customer', 'provider', 'both', 'admin')),
    name TEXT NOT NULL,
    phone TEXT,
    phone_demo_verified BOOLEAN DEFAULT FALSE NOT NULL,
    language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ta')),
    area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
    avatar TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
    address_confidential TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_area_id ON public.profiles (area_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

-- 6. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    business_type TEXT DEFAULT 'Proprietorship' CHECK (business_type IN ('Proprietorship', 'Partnership', 'LLP', 'Private Limited')),
    gst_number TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    address TEXT,
    area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations (owner_id);

-- 7. PROVIDER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.provider_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    provider_type TEXT NOT NULL DEFAULT 'freelancer' CHECK (provider_type IN ('freelancer', 'organization_owner', 'technician')),
    id_proof_url TEXT,
    skills TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    experience INTEGER DEFAULT 0 CHECK (experience >= 0),
    working_hours JSONB DEFAULT '{"start": "08:00:00", "end": "19:00:00"}'::jsonb,
    working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6],
    travel_radius_km NUMERIC DEFAULT 13.0,
    rating_avg NUMERIC(3, 2) DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'pending', 'rejected')),
    verified_id_hash TEXT,
    bid_banned_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_provider_profile_user_org UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_user ON public.provider_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_org ON public.provider_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_status ON public.provider_profiles (status);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_verified_hash ON public.provider_profiles (verified_id_hash);

-- 8. EMERGENCY FEE PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.emergency_fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'waived')),
    fee_version INTEGER NOT NULL DEFAULT 1,
    payment_method TEXT,
    transaction_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emergency_fee_customer ON public.emergency_fee_payments (customer_id);

-- 9. SERVICE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('ordinary', 'emergency')),
    category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
    area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    offered_price NUMERIC NOT NULL CHECK (offered_price > 0),
    min_price NUMERIC NOT NULL CHECK (min_price > 0),
    preferred_start TIMESTAMPTZ NOT NULL,
    estimated_duration_hours NUMERIC NOT NULL DEFAULT 2.0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'bidding_active', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed')),
    images TEXT[] DEFAULT '{}' CHECK (cardinality(images) <= 4),
    provider_preference TEXT NOT NULL DEFAULT 'either' CHECK (provider_preference IN ('freelancer', 'organization', 'either')),
    fee_payment_id UUID REFERENCES public.emergency_fee_payments(id) ON DELETE SET NULL,
    assigned_provider_profile_id UUID REFERENCES public.provider_profiles(id) ON DELETE SET NULL,
    address_confidential TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON public.service_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_category ON public.service_requests (category_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_area ON public.service_requests (area_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests (status);
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_provider ON public.service_requests (assigned_provider_profile_id);

-- 10. BIDS TABLE
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    provider_profile_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
    coins INTEGER NOT NULL CHECK (coins > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'won', 'outbid', 'cancelled')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bids_request ON public.bids (request_id);
CREATE INDEX IF NOT EXISTS idx_bids_provider_profile ON public.bids (provider_profile_id);

-- 11. BID INTERESTS TABLE
CREATE TABLE IF NOT EXISTS public.bid_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    provider_profile_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('interested', 'not_interested')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_bid_interest_request_provider UNIQUE (request_id, provider_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_bid_interests_request ON public.bid_interests (request_id);

-- 12. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE RESTRICT,
    provider_profile_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE RESTRICT,
    time_range TSTZRANGE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_request ON public.bookings (request_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON public.bookings (provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON public.bookings USING GIST (time_range);

-- 13. REVIEWS TABLE (Blind reviews)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE RESTRICT,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    direction TEXT NOT NULL CHECK (direction IN ('customer_to_provider', 'provider_to_customer')),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,
    revealed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_reviews_request_direction UNIQUE (request_id, direction)
);

CREATE INDEX IF NOT EXISTS idx_reviews_request ON public.reviews (request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews (reviewee_id);

-- 14. COIN LEDGER TABLE (Append-only)
CREATE TABLE IF NOT EXISTS public.coin_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_profile_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_provider ON public.coin_ledger (provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_request ON public.coin_ledger (request_id);

-- 15. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system', 'time_proposal', 'address_share')),
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_request ON public.messages (request_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);

-- 16. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications (read);

-- 17. DEVICE TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('web', 'android', 'ios')),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_device_tokens_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens (user_id);

-- 18. DISPUTES TABLE
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE RESTRICT,
    raised_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    category TEXT NOT NULL CHECK (category IN ('no_show', 'payment_dispute', 'damage_claim', 'quality_issue', 'other')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_request ON public.disputes (request_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON public.disputes (raised_by);
