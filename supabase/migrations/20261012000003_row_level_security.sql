-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 3: ROW LEVEL SECURITY (RLS)
-- Comprehensive access control with role claim checks and confidential field isolation
-- ============================================================================

-- 1. HELPER FUNCTION: CHECK ADMIN ROLE VIA JWT CLAIM OR PROFILES TABLE
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    COALESCE(auth.jwt() ->> 'role', '') = 'admin'
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
$$;

-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES: SETTINGS AND SETTINGS HISTORY
CREATE POLICY "Public read settings"
ON public.settings FOR SELECT
USING (true);

CREATE POLICY "Admin manage settings"
ON public.settings FOR ALL
USING (public.is_admin());

CREATE POLICY "Admin view settings history"
ON public.settings_history FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admin view audit log"
ON public.audit_log FOR SELECT
USING (public.is_admin());

-- 4. POLICIES: AREAS AND CATEGORIES
CREATE POLICY "Public read areas"
ON public.areas FOR SELECT
USING (true);

CREATE POLICY "Admin manage areas"
ON public.areas FOR ALL
USING (public.is_admin());

CREATE POLICY "Public read service categories"
ON public.service_categories FOR SELECT
USING (true);

CREATE POLICY "Admin manage service categories"
ON public.service_categories FOR ALL
USING (public.is_admin());

-- 5. POLICIES: PROFILES (Confidential address protection)
-- Non-admins and other users can view public profile details
CREATE POLICY "Public read active profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admin manage profiles"
ON public.profiles FOR ALL
USING (public.is_admin());

-- Function for securely fetching own confidential address
CREATE OR REPLACE FUNCTION public.get_my_confidential_address()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_address TEXT;
BEGIN
    SELECT address_confidential INTO v_address
    FROM public.profiles
    WHERE id = auth.uid();
    RETURN v_address;
END;
$$;

-- 6. POLICIES: ORGANIZATIONS
CREATE POLICY "Public read organizations"
ON public.organizations FOR SELECT
USING (true);

CREATE POLICY "Owners manage own organization"
ON public.organizations FOR ALL
USING (auth.uid() = owner_id OR public.is_admin());

-- 7. POLICIES: PROVIDER PROFILES (ID proof & Aadhaar hash isolation)
CREATE POLICY "Public view active providers"
ON public.provider_profiles FOR SELECT
USING (status = 'active' OR user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Providers insert own profile"
ON public.provider_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Providers update own profile"
ON public.provider_profiles FOR UPDATE
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admin manage provider profiles"
ON public.provider_profiles FOR ALL
USING (public.is_admin());

-- Column security: prevent regular users from selecting id_proof_url and verified_id_hash of other providers
REVOKE SELECT (id_proof_url, verified_id_hash) ON public.provider_profiles FROM anon, authenticated;
GRANT SELECT (id_proof_url, verified_id_hash) ON public.provider_profiles TO service_role;

-- Secure function allowing a provider to view only their own verified ID hash or ID proof URL
CREATE OR REPLACE FUNCTION public.get_my_provider_verification()
RETURNS TABLE (
    id UUID,
    id_proof_url TEXT,
    verified_id_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT pp.id, pp.id_proof_url, pp.verified_id_hash
    FROM public.provider_profiles pp
    WHERE pp.user_id = auth.uid() OR public.is_admin();
END;
$$;

-- Column security: prevent regular users from selecting confidential address on profiles
REVOKE SELECT (address_confidential) ON public.profiles FROM anon, authenticated;
GRANT SELECT (address_confidential) ON public.profiles TO service_role;

-- 8. POLICIES: EMERGENCY FEE PAYMENTS
CREATE POLICY "Customers view own emergency fee payments"
ON public.emergency_fee_payments FOR SELECT
USING (customer_id = auth.uid() OR public.is_admin());

CREATE POLICY "Customers insert fee payments"
ON public.emergency_fee_payments FOR INSERT
WITH CHECK (customer_id = auth.uid() OR public.is_admin());

-- 9. POLICIES: SERVICE REQUESTS
CREATE POLICY "Customers view own requests"
ON public.service_requests FOR SELECT
USING (
    customer_id = auth.uid()
    OR status IN ('pending', 'bidding_active')
    OR assigned_provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
);

CREATE POLICY "Customers insert requests"
ON public.service_requests FOR INSERT
WITH CHECK (customer_id = auth.uid() OR public.is_admin());

CREATE POLICY "Customers and assigned providers update requests"
ON public.service_requests FOR UPDATE
USING (
    customer_id = auth.uid()
    OR assigned_provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
);

CREATE POLICY "Customers delete pending requests"
ON public.service_requests FOR DELETE
USING (
    (customer_id = auth.uid() AND status IN ('pending', 'cancelled'))
    OR public.is_admin()
);

-- 10. POLICIES: BIDS
CREATE POLICY "View bids for request participants"
ON public.bids FOR SELECT
USING (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.customer_id = auth.uid())
    OR public.is_admin()
);

CREATE POLICY "Providers insert bids"
ON public.bids FOR INSERT
WITH CHECK (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
);

CREATE POLICY "Providers update own bids"
ON public.bids FOR UPDATE
USING (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
);

-- 11. POLICIES: BID INTERESTS
CREATE POLICY "View bid interests"
ON public.bid_interests FOR SELECT
USING (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.customer_id = auth.uid())
    OR public.is_admin()
);

CREATE POLICY "Providers record interest"
ON public.bid_interests FOR INSERT
WITH CHECK (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
);

-- 12. POLICIES: BOOKINGS
CREATE POLICY "Participants view bookings"
ON public.bookings FOR SELECT
USING (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.customer_id = auth.uid())
    OR public.is_admin()
);

CREATE POLICY "Participants update bookings"
ON public.bookings FOR UPDATE
USING (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id AND sr.customer_id = auth.uid())
    OR public.is_admin()
);

-- 13. POLICIES: REVIEWS (Blind until revealed)
CREATE POLICY "Blind reviews access"
ON public.reviews FOR SELECT
USING (
    revealed = TRUE
    OR reviewer_id = auth.uid()
    OR public.is_admin()
);

CREATE POLICY "Users insert own reviews"
ON public.reviews FOR INSERT
WITH CHECK (reviewer_id = auth.uid() OR public.is_admin());

-- 14. POLICIES: COIN LEDGER
CREATE POLICY "Providers view own coin ledger"
ON public.coin_ledger FOR SELECT
USING (
    provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
);

-- 15. POLICIES: MESSAGES
CREATE POLICY "Participants view chat messages"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.service_requests sr
        WHERE sr.id = request_id
          AND (
              sr.customer_id = auth.uid()
              OR sr.assigned_provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
          )
    )
    OR public.is_admin()
);

CREATE POLICY "Participants insert chat messages"
ON public.messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.service_requests sr
            WHERE sr.id = request_id
              AND (
                  sr.customer_id = auth.uid()
                  OR sr.assigned_provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
              )
        )
        OR public.is_admin()
    )
);

-- 16. POLICIES: NOTIFICATIONS
CREATE POLICY "Users manage own notifications"
ON public.notifications FOR ALL
USING (user_id = auth.uid() OR public.is_admin());

-- 17. POLICIES: DEVICE TOKENS
CREATE POLICY "Users manage own device tokens"
ON public.device_tokens FOR ALL
USING (user_id = auth.uid() OR public.is_admin());

-- 18. POLICIES: DISPUTES
CREATE POLICY "View disputes"
ON public.disputes FOR SELECT
USING (
    raised_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.service_requests sr
        WHERE sr.id = request_id
          AND (
              sr.customer_id = auth.uid()
              OR sr.assigned_provider_profile_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
          )
    )
    OR public.is_admin()
);

CREATE POLICY "Users raise disputes"
ON public.disputes FOR INSERT
WITH CHECK (raised_by = auth.uid() OR public.is_admin());

CREATE POLICY "Admin resolve disputes"
ON public.disputes FOR UPDATE
USING (public.is_admin());
