-- ============================================================================
-- DEMO STORY SEED SCRIPT
-- supabase/demo_seed.sql
--
-- Run with:   psql $DATABASE_URL -f supabase/demo_seed.sql
-- Or via:     npx supabase db reset --db-url $DATABASE_URL
--             (then this file is applied after migration)
--
-- Creates a fully playable demo with 5 scenario cards:
--   1. PENDING ordinary job   (customer posted, no bids yet)
--   2. OPEN emergency         (interest window, 2/10 providers interested)
--   3. BID ARENA              (3 bidders competing, closes in ~40 min)
--   4. COMPLETED job          (mutual completion, review window open)
--   5. NO-SHOW history        (provider no-show, dispute filed)
-- ============================================================================

BEGIN;

-- ─── 0.  Constant UUIDs for all demo rows ────────────────────────────────────
-- Auth users (use Supabase Dashboard → Auth → Users → "Add user" to match these)
-- For the demo runner script these are pre-created via service role client.

DO $$
DECLARE
  -- Personas
  v_cust1   UUID := 'dd000000-0000-0000-0000-000000000001'; -- Customer: Priya Krishnan
  v_cust2   UUID := 'dd000000-0000-0000-0000-000000000002'; -- Customer: Arun Selvam
  v_prov1   UUID := 'dd000000-0000-0000-0000-000000000011'; -- Provider: Rajan (plumber, 42c, 4.2★, 5r)
  v_prov2   UUID := 'dd000000-0000-0000-0000-000000000012'; -- Provider: Kumaran (electrician, 50c, 4.5★, 7r)
  v_prov3   UUID := 'dd000000-0000-0000-0000-000000000013'; -- Provider: Mani (plumber, 38c, 3.8★, 4r)
  v_prov4   UUID := 'dd000000-0000-0000-0000-000000000014'; -- Provider: Senthil (pending, 35c, 0r)
  v_prov5   UUID := 'dd000000-0000-0000-0000-000000000015'; -- Provider: Vinoth (no-show offender)

  -- Profile IDs (provider_profiles rows)
  v_pp1     UUID := 'pp000000-0000-0000-0000-000000000001';
  v_pp2     UUID := 'pp000000-0000-0000-0000-000000000002';
  v_pp3     UUID := 'pp000000-0000-0000-0000-000000000003';
  v_pp4     UUID := 'pp000000-0000-0000-0000-000000000004';
  v_pp5     UUID := 'pp000000-0000-0000-0000-000000000005';

  -- Request / booking IDs
  v_req1    UUID := 'req00000-0000-0000-0000-000000000001'; -- Pending ordinary
  v_req2    UUID := 'req00000-0000-0000-0000-000000000002'; -- Open emergency (interest window)
  v_req3    UUID := 'req00000-0000-0000-0000-000000000003'; -- Emergency with 3 bids
  v_req4    UUID := 'req00000-0000-0000-0000-000000000004'; -- Completed, review open
  v_req5    UUID := 'req00000-0000-0000-0000-000000000005'; -- No-show history

  v_bk4     UUID := 'bk000000-0000-0000-0000-000000000004';
  v_bk5     UUID := 'bk000000-0000-0000-0000-000000000005';

  v_area_rs UUID := 'e0000000-0000-0000-0000-000000000001'; -- RS Puram
  v_area_gp UUID := 'e0000000-0000-0000-0000-000000000002'; -- Gandhipuram
  v_cat_pl  UUID := 'f0000000-0000-0000-0000-000000000001'; -- Plumbing
  v_cat_el  UUID := 'f0000000-0000-0000-0000-000000000002'; -- Electrical

  v_now     TIMESTAMPTZ := now();
BEGIN

  -- ─── 1. Auth user stubs & profiles (safe upsert) ─────────────────────────
  -- NOTE: auth.users must be pre-created via Supabase Dashboard or service role.
  -- We only upsert the public.profiles rows here.

  INSERT INTO public.profiles (id, name, role, status, phone, area_id, language, created_at)
  VALUES
    (v_cust1, 'Priya Krishnan',  'customer', 'active', '9876500001', v_area_rs, 'ta', v_now - INTERVAL '60 days'),
    (v_cust2, 'Arun Selvam',     'customer', 'active', '9876500002', v_area_gp, 'en', v_now - INTERVAL '30 days'),
    (v_prov1, 'Rajan Kumar',     'provider', 'active', '9876500011', v_area_rs, 'ta', v_now - INTERVAL '90 days'),
    (v_prov2, 'Kumaran Pillai',  'provider', 'active', '9876500012', v_area_gp, 'en', v_now - INTERVAL '75 days'),
    (v_prov3, 'Mani Natarajan',  'provider', 'active', '9876500013', v_area_rs, 'ta', v_now - INTERVAL '45 days'),
    (v_prov4, 'Senthil Prabhu', 'provider', 'active', '9876500014', v_area_gp, 'en', v_now - INTERVAL '10 days'),
    (v_prov5, 'Vinoth Anand',    'provider', 'active', '9876500015', v_area_rs, 'ta', v_now - INTERVAL '60 days')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, phone = EXCLUDED.phone;

  -- ─── 2. Provider profiles ─────────────────────────────────────────────────
  INSERT INTO public.provider_profiles
    (id, user_id, provider_type, status, rating_avg, review_count, categories, experience,
     verified_id_hash, created_at)
  VALUES
    (v_pp1, v_prov1, 'freelancer', 'active', 4.2, 5, ARRAY['Plumbing & Water Systems'], 8,
     encode(sha256(('DEMO-ID-RAJAN')::bytea), 'hex'), v_now - INTERVAL '90 days'),

    (v_pp2, v_prov2, 'freelancer', 'active', 4.5, 7, ARRAY['Electrical & Wiring'], 6,
     encode(sha256(('DEMO-ID-KUMARAN')::bytea), 'hex'), v_now - INTERVAL '75 days'),

    (v_pp3, v_prov3, 'freelancer', 'active', 3.8, 4, ARRAY['Plumbing & Water Systems'], 4,
     encode(sha256(('DEMO-ID-MANI')::bytea), 'hex'), v_now - INTERVAL '45 days'),

    -- Pending provider (no reviews yet → not eligible)
    (v_pp4, v_prov4, 'freelancer', 'pending', 0, 0, ARRAY['Electrical & Wiring'], 1,
     encode(sha256(('DEMO-ID-SENTHIL')::bytea), 'hex'), v_now - INTERVAL '10 days'),

    -- No-show offender
    (v_pp5, v_prov5, 'freelancer', 'active', 3.2, 3, ARRAY['Plumbing & Water Systems'], 2,
     encode(sha256(('DEMO-ID-VINOTH')::bytea), 'hex'), v_now - INTERVAL '60 days')
  ON CONFLICT (id) DO UPDATE SET
    rating_avg   = EXCLUDED.rating_avg,
    review_count = EXCLUDED.review_count,
    status       = EXCLUDED.status;

  -- ─── 3. Coin ledger bootstrap (safe insert) ───────────────────────────────
  -- Rajan: 42 coins net (35 onboarding + 20 completion + 5 bonus − 18 bid spent)
  INSERT INTO public.coin_ledger (provider_profile_id, amount, reason)
  VALUES
    (v_pp1, 35, 'onboarding_grant'),
    (v_pp1, 20, 'job_completion'),
    (v_pp1, 5,  'star_bonus_5'),
    (v_pp1, -18,'emergency_bid_spent'),
    (v_pp2, 35, 'onboarding_grant'),
    (v_pp2, 20, 'job_completion'),
    (v_pp2, 3,  'star_bonus_4'),
    (v_pp2, 20, 'job_completion'),
    (v_pp2, 5,  'star_bonus_5'),
    (v_pp3, 35, 'onboarding_grant'),
    (v_pp3, 20, 'job_completion'),
    (v_pp3, 2,  'star_bonus_3'),
    (v_pp3, -18,'emergency_bid_spent'),
    (v_pp4, 35, 'onboarding_grant'), -- not yet approved but coins present
    (v_pp5, 35, 'onboarding_grant'),
    (v_pp5, 20, 'job_completion'),
    (v_pp5, -10,'noshow_penalty')    -- prior no-show penalty
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────────────────
  -- SCENARIO 1: Pending Ordinary Job
  -- Customer Priya posted a plumbing repair, no provider assigned yet.
  -- Status: 'pending' (visible in customer feed, providers can bookmark)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.service_requests
    (id, customer_id, type, category_id, area_id, title, description,
     offered_price, min_price, preferred_start, status,
     provider_preference, images, created_at, updated_at)
  VALUES
    (v_req1, v_cust1, 'ordinary', v_cat_pl, v_area_rs,
     'Kitchen Tap Leakage Fix',
     'The kitchen mixer tap is dripping constantly even when fully closed. Need a plumber to replace the washer or tap cartridge. Prefer morning slot.',
     600, 400,
     (v_now + INTERVAL '3 days')::DATE + TIME '09:00:00',
     'pending', 'either',
     ARRAY[]::TEXT[],
     v_now - INTERVAL '2 hours', v_now - INTERVAL '2 hours')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;

  -- ─────────────────────────────────────────────────────────────────────────
  -- SCENARIO 2: Open Emergency — Interest Window
  -- Customer Arun posted emergency electrical. 2 providers registered interest.
  -- Waiting for 10 interested (or 45-min window). Status: 'interest_window'
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.service_requests
    (id, customer_id, type, category_id, area_id, title, description,
     offered_price, min_price, preferred_start, status,
     provider_preference, images, created_at, updated_at)
  VALUES
    (v_req2, v_cust2, 'emergency', v_cat_el, v_area_gp,
     'Power Outage — MCB Keeps Tripping',
     'All lights in the main hall and two bedrooms went off. MCB is tripping every few minutes. Possible short circuit. Need immediate help.',
     900, 700,
     v_now + INTERVAL '3 hours',
     'interest_window', 'either',
     ARRAY[]::TEXT[],
     v_now - INTERVAL '20 minutes', v_now - INTERVAL '20 minutes')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  -- Interest registrations for scenario 2
  INSERT INTO public.bid_interests (request_id, provider_profile_id, status)
  VALUES
    (v_req2, v_pp2, 'interested'),
    (v_req2, v_pp3, 'interested')
  ON CONFLICT (request_id, provider_profile_id) DO NOTHING;

  -- ─────────────────────────────────────────────────────────────────────────
  -- SCENARIO 3: Bidding Arena — 3 active bids
  -- Another emergency plumbing; bidding open, closes in ~40 minutes.
  -- Rajan bid 18c, Kumaran bid 20c, Mani bid 15c.
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.service_requests
    (id, customer_id, type, category_id, area_id, title, description,
     offered_price, min_price, preferred_start, status,
     bidding_opened_at, bidding_closes_at,
     provider_preference, images, created_at, updated_at)
  VALUES
    (v_req3, v_cust1, 'emergency', v_cat_pl, v_area_rs,
     'Burst Pipe — Bathroom Flooded',
     'A pipe under the bathroom sink burst and water is pooling on the floor. Need someone urgently.',
     1200, 900,
     v_now + INTERVAL '2 hours',
     'bidding_open',
     v_now - INTERVAL '5 minutes',
     v_now + INTERVAL '40 minutes',
     'either',
     ARRAY[]::TEXT[],
     v_now - INTERVAL '25 minutes', v_now - INTERVAL '5 minutes')
  ON CONFLICT (id) DO UPDATE SET
    status            = EXCLUDED.status,
    bidding_opens_at  = EXCLUDED.bidding_opened_at,
    bidding_closes_at = EXCLUDED.bidding_closes_at;

  INSERT INTO public.bids (request_id, provider_profile_id, coins, status, note)
  VALUES
    (v_req3, v_pp1, 18, 'active', 'I can arrive within 30 minutes. Experienced with burst pipes.'),
    (v_req3, v_pp2, 20, 'active', 'Available now. Will bring extra joints and sealant.'),
    (v_req3, v_pp3, 15, 'active', 'Closest to your location. Quick fix guaranteed.')
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────────────────
  -- SCENARIO 4: Completed job — review window open
  -- Priya booked Kumaran for deep cleaning. Both marked complete 35 min ago.
  -- Review window opens now. Neither has submitted their review yet.
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.service_requests
    (id, customer_id, type, category_id, area_id, title, description,
     offered_price, min_price, preferred_start, status,
     assigned_provider_profile_id, created_at, updated_at)
  VALUES
    (v_req4, v_cust1, 'ordinary', v_cat_el, v_area_rs,
     'Full House Electrical Inspection',
     'Annual safety inspection of all sockets, DB board and earthing. 3-bedroom apartment.',
     1100, 900,
     v_now - INTERVAL '2 days',
     'completed', v_pp2,
     v_now - INTERVAL '3 days', v_now - INTERVAL '35 minutes')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.bookings
    (id, request_id, provider_profile_id, status,
     time_range,
     provider_marked_complete_at, customer_marked_complete_at,
     review_opens_at, created_at)
  VALUES
    (v_bk4, v_req4, v_pp2, 'confirmed',
     tstzrange(v_now - INTERVAL '2 days', v_now - INTERVAL '2 days' + INTERVAL '3 hours', '[)'),
     v_now - INTERVAL '35 minutes',
     v_now - INTERVAL '35 minutes',
     v_now - INTERVAL '5 minutes',  -- review window opened 5 minutes ago
     v_now - INTERVAL '3 days')
  ON CONFLICT (id) DO UPDATE SET
    provider_marked_complete_at = EXCLUDED.provider_marked_complete_at,
    customer_marked_complete_at = EXCLUDED.customer_marked_complete_at,
    review_opens_at             = EXCLUDED.review_opens_at;

  -- Emergency fee payment for req4 (it was an ordinary job but we add one for revenue demo)
  INSERT INTO public.emergency_fee_payments (request_id, customer_id, amount, status, created_at)
  VALUES
    (v_req3, v_cust1, 50.00, 'paid', v_now - INTERVAL '25 minutes')
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────────────────
  -- SCENARIO 5: No-show history item
  -- Arun booked Vinoth (ordinary plumbing). Vinoth didn't show up.
  -- Dispute filed. Vinoth penalised: −10 coins, 3-day ban.
  -- Booking status: disputed. Request status: disputed.
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.service_requests
    (id, customer_id, type, category_id, area_id, title, description,
     offered_price, min_price, preferred_start, status,
     assigned_provider_profile_id, created_at, updated_at)
  VALUES
    (v_req5, v_cust2, 'ordinary', v_cat_pl, v_area_gp,
     'Shower Head Replacement',
     'Old shower head broken, need replacement with a rain-shower model. Parts can be bought from nearby hardware.',
     500, 350,
     v_now - INTERVAL '5 days',
     'disputed', v_pp5,
     v_now - INTERVAL '6 days', v_now - INTERVAL '5 days')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  INSERT INTO public.bookings
    (id, request_id, provider_profile_id, status,
     time_range, noshow_claimed_at, created_at)
  VALUES
    (v_bk5, v_req5, v_pp5, 'disputed',
     tstzrange(v_now - INTERVAL '5 days', v_now - INTERVAL '5 days' + INTERVAL '2 hours', '[)'),
     v_now - INTERVAL '4 days 20 hours',
     v_now - INTERVAL '6 days')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, noshow_claimed_at = EXCLUDED.noshow_claimed_at;

  -- Vinoth's ban (already partially consumed — still 1 day left)
  UPDATE public.provider_profiles
    SET bid_banned_until = v_now + INTERVAL '1 day'
  WHERE id = v_pp5;

  -- Dispute record
  INSERT INTO public.disputes
    (request_id, raised_by, category, description, status)
  VALUES
    (v_req5, v_cust2, 'noshow',
     'Provider Vinoth Anand did not arrive at the scheduled time (09:00 AM). No prior notice or cancellation was given.',
     'investigating')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅  HomeCrew demo seed applied successfully.';
  RAISE NOTICE '    Scenario 1: req % — Pending ordinary job (plumbing, RS Puram)', v_req1;
  RAISE NOTICE '    Scenario 2: req % — Emergency interest window (electrical, Gandhipuram)', v_req2;
  RAISE NOTICE '    Scenario 3: req % — Bidding open, 3 active bids (plumbing, RS Puram)', v_req3;
  RAISE NOTICE '    Scenario 4: req % — Completed, review window open (electrical, RS Puram)', v_req4;
  RAISE NOTICE '    Scenario 5: req % — No-show history, dispute filed (plumbing, Gandhipuram)', v_req5;

END;
$$;

COMMIT;
