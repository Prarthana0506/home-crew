-- ============================================================================
-- HOMECREW FULL DEMO SEED — 35 Service Requests, 7 Providers, 6 Customers
-- supabase/seed-demo.sql
--
-- IDEMPOTENT: Uses fixed UUIDs + ON CONFLICT DO UPDATE / DO NOTHING.
-- Tag: is_demo = TRUE on every row so admin toggle can hide/show them.
--
-- Run via:
--   psql $DATABASE_URL -f supabase/seed-demo.sql
-- Or apply in Supabase SQL editor.
--
-- Prerequisites:
--   1. All migrations applied (including 20261014000002_is_demo_flag.sql)
--   2. Auth users created via Supabase service-role client (see scripts/seed-demo.ts)
--   3. Base seed (seed.sql) applied for areas and categories.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- ─── Customer UUIDs ───────────────────────────────────────────────────────
  v_c1  UUID := 'dd000000-0000-0000-0000-000000000001'; -- Priya Krishnan
  v_c2  UUID := 'dd000000-0000-0000-0000-000000000002'; -- Arun Selvam
  v_c3  UUID := 'dd000000-0000-0000-0000-000000000003'; -- Meena Rajan
  v_c4  UUID := 'dd000000-0000-0000-0000-000000000004'; -- Senthil Murugan
  v_c5  UUID := 'dd000000-0000-0000-0000-000000000005'; -- Kavitha Anand
  v_c6  UUID := 'dd000000-0000-0000-0000-000000000006'; -- Deepa Natarajan

  -- ─── Provider user UUIDs ──────────────────────────────────────────────────
  v_p1  UUID := 'dd000000-0000-0000-0000-000000000011'; -- Rajan Kumar (freelancer)
  v_p2  UUID := 'dd000000-0000-0000-0000-000000000012'; -- Kumaran Pillai (freelancer)
  v_p3  UUID := 'dd000000-0000-0000-0000-000000000013'; -- Mani Natarajan (freelancer)
  v_p4  UUID := 'dd000000-0000-0000-0000-000000000014'; -- Senthil Prabhu (new provider)
  v_p5  UUID := 'dd000000-0000-0000-0000-000000000015'; -- Vinoth Anand (banned)
  v_p6  UUID := 'dd000000-0000-0000-0000-000000000016'; -- Arjun Subramaniam (org owner)
  v_p7  UUID := 'dd000000-0000-0000-0000-000000000017'; -- Karthik Raj (technician)
  v_p8  UUID := 'dd000000-0000-0000-0000-000000000018'; -- Balaji Mohan (technician)

  -- ─── Provider profile UUIDs ───────────────────────────────────────────────
  v_pp1 UUID := 'pp000000-0000-0000-0000-000000000001'; -- Rajan
  v_pp2 UUID := 'pp000000-0000-0000-0000-000000000002'; -- Kumaran
  v_pp3 UUID := 'pp000000-0000-0000-0000-000000000003'; -- Mani
  v_pp4 UUID := 'pp000000-0000-0000-0000-000000000004'; -- Senthil P
  v_pp5 UUID := 'pp000000-0000-0000-0000-000000000005'; -- Vinoth
  v_pp6 UUID := 'pp000000-0000-0000-0000-000000000006'; -- Arjun (org owner)
  v_pp7 UUID := 'pp000000-0000-0000-0000-000000000007'; -- Karthik (tech)
  v_pp8 UUID := 'pp000000-0000-0000-0000-000000000008'; -- Balaji (tech)

  -- ─── Organization UUID ────────────────────────────────────────────────────
  v_org1 UUID := 'og000000-0000-0000-0000-000000000001'; -- Arjun Enterprises

  -- ─── Area UUIDs (from seed.sql) ───────────────────────────────────────────
  v_area_rs    UUID := 'e0000000-0000-0000-0000-000000000001'; -- RS Puram
  v_area_gp    UUID := 'e0000000-0000-0000-0000-000000000002'; -- Gandhipuram
  v_area_pm    UUID := 'e0000000-0000-0000-0000-000000000003'; -- Peelamedu
  v_area_sc    UUID := 'e0000000-0000-0000-0000-000000000004'; -- Saibaba Colony
  v_area_sn    UUID := 'e0000000-0000-0000-0000-000000000005'; -- Saravanampatti
  v_area_sg    UUID := 'e0000000-0000-0000-0000-000000000007'; -- Singanallur
  v_area_ga    UUID := 'e0000000-0000-0000-0000-000000000012'; -- Ganapathy
  v_area_kv    UUID := 'e0000000-0000-0000-0000-000000000009'; -- Vadavalli (Kavundampalayam stand-in)

  -- ─── Category UUIDs (from seed.sql) ──────────────────────────────────────
  v_cat_pl UUID := 'f0000000-0000-0000-0000-000000000001'; -- Plumbing
  v_cat_el UUID := 'f0000000-0000-0000-0000-000000000002'; -- Electrical
  v_cat_cl UUID := 'f0000000-0000-0000-0000-000000000003'; -- Deep Home Cleaning
  v_cat_ap UUID := 'f0000000-0000-0000-0000-000000000004'; -- Appliance Repair
  v_cat_cp UUID := 'f0000000-0000-0000-0000-000000000005'; -- Carpentry & Furniture
  v_cat_pa UUID := 'f0000000-0000-0000-0000-000000000006'; -- Painting & Touchup
  v_cat_ac UUID := 'f0000000-0000-0000-0000-000000000007'; -- AC Servicing
  v_cat_pc UUID := 'f0000000-0000-0000-0000-000000000008'; -- Pest Control
  v_cat_cv UUID := 'f0000000-0000-0000-0000-000000000009'; -- CCTV & Security
  v_cat_gn UUID := 'f0000000-0000-0000-0000-000000000010'; -- Gardening
  v_cat_mv UUID := 'f0000000-0000-0000-0000-000000000011'; -- Packers & Furniture Helpers
  v_cat_in UUID := 'f0000000-0000-0000-0000-000000000012'; -- Interior Design & Renovation

  -- ─── Request UUIDs ────────────────────────────────────────────────────────
  -- Open ordinary (8)
  v_req01 UUID := 'req00000-0000-0000-0000-000000000001';
  v_req02 UUID := 'req00000-0000-0000-0000-000000000002';
  v_req03 UUID := 'req00000-0000-0000-0000-000000000003';
  v_req04 UUID := 'req00000-0000-0000-0000-000000000004';
  v_req05 UUID := 'req00000-0000-0000-0000-000000000005';
  v_req06 UUID := 'req00000-0000-0000-0000-000000000006';
  v_req07 UUID := 'req00000-0000-0000-0000-000000000007';
  v_req08 UUID := 'req00000-0000-0000-0000-000000000008';
  -- Emergency (5)
  v_req09 UUID := 'req00000-0000-0000-0000-000000000009'; -- interest_window
  v_req10 UUID := 'req00000-0000-0000-0000-000000000010'; -- interest_window
  v_req11 UUID := 'req00000-0000-0000-0000-000000000011'; -- bidding_open 3 bids
  v_req12 UUID := 'req00000-0000-0000-0000-000000000012'; -- bidding_open 4 bids
  v_req13 UUID := 'req00000-0000-0000-0000-000000000013'; -- awarded
  -- Accepted future (6)
  v_req14 UUID := 'req00000-0000-0000-0000-000000000014';
  v_req15 UUID := 'req00000-0000-0000-0000-000000000015';
  v_req16 UUID := 'req00000-0000-0000-0000-000000000016';
  v_req17 UUID := 'req00000-0000-0000-0000-000000000017';
  v_req18 UUID := 'req00000-0000-0000-0000-000000000018'; -- emergency awarded
  v_req19 UUID := 'req00000-0000-0000-0000-000000000019'; -- emergency awarded
  -- In progress (2)
  v_req20 UUID := 'req00000-0000-0000-0000-000000000020'; -- provider marked complete
  v_req21 UUID := 'req00000-0000-0000-0000-000000000021'; -- customer marked complete
  -- Completed 6 with both reviews (22-27)
  v_req22 UUID := 'req00000-0000-0000-0000-000000000022';
  v_req23 UUID := 'req00000-0000-0000-0000-000000000023';
  v_req24 UUID := 'req00000-0000-0000-0000-000000000024';
  v_req25 UUID := 'req00000-0000-0000-0000-000000000025';
  v_req26 UUID := 'req00000-0000-0000-0000-000000000026';
  v_req27 UUID := 'req00000-0000-0000-0000-000000000027';
  -- Completed 1 in review wait window (28)
  v_req28 UUID := 'req00000-0000-0000-0000-000000000028';
  -- Awaiting customer review (29)
  v_req29 UUID := 'req00000-0000-0000-0000-000000000029';
  -- Awaiting provider review (30-31)
  v_req30 UUID := 'req00000-0000-0000-0000-000000000030';
  v_req31 UUID := 'req00000-0000-0000-0000-000000000031';
  -- No-shows (32-33)
  v_req32 UUID := 'req00000-0000-0000-0000-000000000032'; -- reopened no-show
  v_req33 UUID := 'req00000-0000-0000-0000-000000000033';
  -- Reopened request (from req32)
  v_req32b UUID := 'req00000-0000-0000-0000-000000000032'; -- original, now status=noshow
  v_req32r UUID := 'req00000-0000-0000-0000-000000000039'; -- the reopened copy
  -- Cancelled/expired (34-35)
  v_req34 UUID := 'req00000-0000-0000-0000-000000000034'; -- cancelled ordinary
  v_req35 UUID := 'req00000-0000-0000-0000-000000000035'; -- expired emergency
  -- Post-seed catalog coverage requests (ensure every category has demo listings)
  v_req36 UUID := 'req00000-0000-0000-0000-000000000036';
  v_req37 UUID := 'req00000-0000-0000-0000-000000000037';
  v_req38 UUID := 'req00000-0000-0000-0000-000000000038';
  v_req39 UUID := 'req00000-0000-0000-0000-000000000039';
  v_req40 UUID := 'req00000-0000-0000-0000-000000000040';
  v_req41 UUID := 'req00000-0000-0000-0000-000000000041';
  v_req42 UUID := 'req00000-0000-0000-0000-000000000042';
  v_req43 UUID := 'req00000-0000-0000-0000-000000000043';
  v_req44 UUID := 'req00000-0000-0000-0000-000000000044';

  -- ─── Booking UUIDs ────────────────────────────────────────────────────────
  v_bk13  UUID := 'bk000000-0000-0000-0000-000000000013';
  v_bk14  UUID := 'bk000000-0000-0000-0000-000000000014';
  v_bk15  UUID := 'bk000000-0000-0000-0000-000000000015';
  v_bk16  UUID := 'bk000000-0000-0000-0000-000000000016';
  v_bk17  UUID := 'bk000000-0000-0000-0000-000000000017';
  v_bk18  UUID := 'bk000000-0000-0000-0000-000000000018';
  v_bk19  UUID := 'bk000000-0000-0000-0000-000000000019';
  v_bk20  UUID := 'bk000000-0000-0000-0000-000000000020';
  v_bk21  UUID := 'bk000000-0000-0000-0000-000000000021';
  v_bk22  UUID := 'bk000000-0000-0000-0000-000000000022';
  v_bk23  UUID := 'bk000000-0000-0000-0000-000000000023';
  v_bk24  UUID := 'bk000000-0000-0000-0000-000000000024';
  v_bk25  UUID := 'bk000000-0000-0000-0000-000000000025';
  v_bk26  UUID := 'bk000000-0000-0000-0000-000000000026';
  v_bk27  UUID := 'bk000000-0000-0000-0000-000000000027';
  v_bk28  UUID := 'bk000000-0000-0000-0000-000000000028';
  v_bk29  UUID := 'bk000000-0000-0000-0000-000000000029';
  v_bk30  UUID := 'bk000000-0000-0000-0000-000000000030';
  v_bk31  UUID := 'bk000000-0000-0000-0000-000000000031';
  v_bk32  UUID := 'bk000000-0000-0000-0000-000000000032';
  v_bk33  UUID := 'bk000000-0000-0000-0000-000000000033';
  v_bk36  UUID := 'bk000000-0000-0000-0000-000000000036';
  v_bk37  UUID := 'bk000000-0000-0000-0000-000000000037';
  v_bk38  UUID := 'bk000000-0000-0000-0000-000000000038';
  v_bk39  UUID := 'bk000000-0000-0000-0000-000000000039';
  v_bk40  UUID := 'bk000000-0000-0000-0000-000000000040';
  v_bk41  UUID := 'bk000000-0000-0000-0000-000000000041';
  v_bk42  UUID := 'bk000000-0000-0000-0000-000000000042';
  v_bk43  UUID := 'bk000000-0000-0000-0000-000000000043';
  v_bk44  UUID := 'bk000000-0000-0000-0000-000000000044';

  v_now   TIMESTAMPTZ := '2026-10-13 09:00:00+05:30'::timestamptz;

BEGIN

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFILES (public.profiles — auth.users must be pre-created)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.profiles
  (id, name, role, status, phone, area_id, language, is_demo, created_at)
VALUES
  -- Customers
  (v_c1,  'Priya Krishnan',    'customer', 'active',    '9000000001', v_area_rs, 'ta', TRUE, v_now - INTERVAL '58 days'),
  (v_c2,  'Arun Selvam',       'customer', 'active',    '9000000002', v_area_gp, 'en', TRUE, v_now - INTERVAL '45 days'),
  (v_c3,  'Meena Rajan',       'customer', 'active',    '9000000003', v_area_rs, 'ta', TRUE, v_now - INTERVAL '30 days'),
  (v_c4,  'Senthil Murugan',   'customer', 'active',    '9000000004', v_area_ga, 'en', TRUE, v_now - INTERVAL '40 days'),
  (v_c5,  'Kavitha Anand',     'customer', 'active',    '9000000005', v_area_sn, 'ta', TRUE, v_now - INTERVAL '25 days'),
  (v_c6,  'Deepa Natarajan',   'customer', 'active',    '9000000006', v_area_pm, 'ta', TRUE, v_now - INTERVAL '50 days'),
  -- Providers
  (v_p1,  'Rajan Kumar',       'provider', 'active',    '9000000011', v_area_rs, 'ta', TRUE, v_now - INTERVAL '90 days'),
  (v_p2,  'Kumaran Pillai',    'provider', 'active',    '9000000012', v_area_gp, 'en', TRUE, v_now - INTERVAL '80 days'),
  (v_p3,  'Mani Natarajan',    'provider', 'active',    '9000000013', v_area_rs, 'ta', TRUE, v_now - INTERVAL '60 days'),
  (v_p4,  'Senthil Prabhu',    'provider', 'active',    '9000000014', v_area_sc, 'en', TRUE, v_now - INTERVAL '5 days'),
  (v_p5,  'Vinoth Anand',      'provider', 'active',    '9000000015', v_area_gp, 'ta', TRUE, v_now - INTERVAL '70 days'),
  (v_p6,  'Arjun Subramaniam', 'provider', 'active',    '9000000016', v_area_pm, 'en', TRUE, v_now - INTERVAL '100 days'),
  (v_p7,  'Karthik Raj',       'provider', 'active',    '9000000017', v_area_pm, 'ta', TRUE, v_now - INTERVAL '55 days'),
  (v_p8,  'Balaji Mohan',      'provider', 'active',    '9000000018', v_area_ga, 'en', TRUE, v_now - INTERVAL '65 days')
ON CONFLICT (id) DO UPDATE SET
  name    = EXCLUDED.name,
  phone   = EXCLUDED.phone,
  is_demo = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ORGANIZATION
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.organizations
  (id, name, owner_id, area_id, is_demo, created_at)
VALUES
  (v_org1, 'Arjun Enterprises', v_p6, v_area_pm, TRUE, v_now - INTERVAL '100 days')
ON CONFLICT (id) DO UPDATE SET
  name    = EXCLUDED.name,
  is_demo = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PROVIDER PROFILES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.provider_profiles
  (id, user_id, provider_type, status, rating_avg, review_count, categories,
   experience, verified_id_hash, organization_id, is_demo, created_at)
VALUES
  -- Rajan: eligible bidder with full category coverage for plumbing, appliance and support work.
  (v_pp1, v_p1, 'freelancer', 'active', 3.9, 5,
   ARRAY['Plumbing & Water Systems', 'Appliance Repair', 'AC Servicing & Gas Refill', 'Deep Home Cleaning'], 7,
   encode(sha256('DEMO-RAJAN-ID'::bytea), 'hex'), NULL, TRUE, v_now - INTERVAL '90 days'),

  -- Kumaran: high-rated provider covering electrical, plumbing and security installs.
  (v_pp2, v_p2, 'freelancer', 'active', 4.5, 8,
   ARRAY['Electrical & Wiring', 'Plumbing & Water Systems', 'CCTV & Smart Home Security', 'Carpentry & Furniture'], 9,
   encode(sha256('DEMO-KUMARAN-ID'::bytea), 'hex'), NULL, TRUE, v_now - INTERVAL '80 days'),

  -- Mani: multi-category generalist with carpentry and renovation work.
  (v_pp3, v_p3, 'freelancer', 'active', 3.4, 4,
   ARRAY['Plumbing & Water Systems', 'Carpentry & Furniture', 'Deep Home Cleaning', 'Interior Design & Renovation'], 4,
   encode(sha256('DEMO-MANI-ID'::bytea), 'hex'), NULL, TRUE, v_now - INTERVAL '60 days'),

  -- Senthil P: new provider; still pending but ready for basic electrical tasks.
  (v_pp4, v_p4, 'freelancer', 'pending', 0, 0,
   ARRAY['Electrical & Wiring', 'Gardening & Lawn Care'], 1,
   encode(sha256('DEMO-SENTHILP-ID'::bytea), 'hex'), NULL, TRUE, v_now - INTERVAL '5 days'),

  -- Vinoth: banned 3 days for withdrawal but still has plumbing and follow-up work.
  (v_pp5, v_p5, 'freelancer', 'active', 3.6, 3,
   ARRAY['Plumbing & Water Systems', 'Pest Control & Sanitization'], 3,
   encode(sha256('DEMO-VINOTH-ID'::bytea), 'hex'), NULL, TRUE, v_now - INTERVAL '70 days'),

  -- Arjun: org owner with all-rounder service team coverage.
  (v_pp6, v_p6, 'organization_owner', 'active', 4.1, 6,
   ARRAY['Electrical & Wiring', 'Appliance Repair', 'Plumbing & Water Systems', 'Interior Design & Renovation', 'Packers & Furniture Helpers'], 12,
   encode(sha256('DEMO-ARJUN-ID'::bytea), 'hex'), v_org1, TRUE, v_now - INTERVAL '100 days'),

  -- Karthik: technician with electrical and support services.
  (v_pp7, v_p7, 'technician', 'active', 4.0, 5,
   ARRAY['Electrical & Wiring', 'AC Servicing & Gas Refill', 'Pest Control & Sanitization'], 4,
   encode(sha256('DEMO-KARTHIK-ID'::bytea), 'hex'), v_org1, TRUE, v_now - INTERVAL '55 days'),

  -- Balaji: technician with support, appliance and electrical coverage.
  (v_pp8, v_p8, 'technician', 'active', 4.3, 7,
   ARRAY['Electrical & Wiring', 'Appliance Repair', 'AC Servicing & Gas Refill', 'Deep Home Cleaning'], 6,
   encode(sha256('DEMO-BALAJI-ID'::bytea), 'hex'), v_org1, TRUE, v_now - INTERVAL '65 days')

ON CONFLICT (id) DO UPDATE SET
  rating_avg   = EXCLUDED.rating_avg,
  review_count = EXCLUDED.review_count,
  status       = EXCLUDED.status,
  is_demo      = TRUE;

-- Apply bid ban to Vinoth (3 days from now)
UPDATE public.provider_profiles
SET bid_banned_until = v_now + INTERVAL '3 days'
WHERE id = v_pp5;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. COIN LEDGER — Builds balances via append-only ledger
--    Rajan: 42c   Kumaran: 55c   Mani: 38c   Vinoth: ~17c after penalty
--    Karthik: 20c  Balaji: 45c   Senthil P: 0c  Arjun: 48c
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.coin_ledger (id, provider_profile_id, amount, reason, is_demo, created_at)
VALUES
  -- Rajan: 35 onboarding + 20 completion + 3 (4-star bonus) + (- adjustment from old data) = 42
  ('cl000000-0000-0000-0001-000000000001', v_pp1, 35, 'Onboarding approval coins', TRUE, v_now - INTERVAL '90 days'),
  ('cl000000-0000-0000-0001-000000000002', v_pp1, 20, 'Job completion reward', TRUE, v_now - INTERVAL '55 days'),
  ('cl000000-0000-0000-0001-000000000003', v_pp1, 3,  'Rating bonus: 4-star review', TRUE, v_now - INTERVAL '55 days'),
  ('cl000000-0000-0000-0001-000000000004', v_pp1, 20, 'Job completion reward', TRUE, v_now - INTERVAL '30 days'),
  ('cl000000-0000-0000-0001-000000000005', v_pp1, 2,  'Rating bonus: 3-star review', TRUE, v_now - INTERVAL '30 days'),
  ('cl000000-0000-0000-0001-000000000006', v_pp1, -20, 'Noshow penalty: 50% of 40 coins forfeited', TRUE, v_now - INTERVAL '15 days'),
  ('cl000000-0000-0000-0001-000000000007', v_pp1, 2,  'Rating bonus: 3-star review', TRUE, v_now - INTERVAL '10 days'),
  -- Kumaran: 35 + 20+5 + 20+3 + 20+5 + 20+3 + 20+5 = 156... cap adjust
  ('cl000000-0000-0000-0002-000000000001', v_pp2, 35, 'Onboarding approval coins', TRUE, v_now - INTERVAL '80 days'),
  ('cl000000-0000-0000-0002-000000000002', v_pp2, 20, 'Job completion reward', TRUE, v_now - INTERVAL '60 days'),
  ('cl000000-0000-0000-0002-000000000003', v_pp2, 5,  'Rating bonus: 5-star review', TRUE, v_now - INTERVAL '60 days'),
  ('cl000000-0000-0000-0002-000000000004', v_pp2, 20, 'Job completion reward', TRUE, v_now - INTERVAL '45 days'),
  ('cl000000-0000-0000-0002-000000000005', v_pp2, 3,  'Rating bonus: 4-star review', TRUE, v_now - INTERVAL '45 days'),
  ('cl000000-0000-0000-0002-000000000006', v_pp2, 20, 'Job completion reward', TRUE, v_now - INTERVAL '35 days'),
  ('cl000000-0000-0000-0002-000000000007', v_pp2, 5,  'Rating bonus: 5-star review', TRUE, v_now - INTERVAL '35 days'),
  ('cl000000-0000-0000-0002-000000000008', v_pp2, -53,'Bid cost deducted: emergency award (demo)', TRUE, v_now - INTERVAL '10 days'),
  -- Mani: 35 + 20+2 + 20+1 + 20+2 = 100... bid costs bring to 38
  ('cl000000-0000-0000-0003-000000000001', v_pp3, 35, 'Onboarding approval coins', TRUE, v_now - INTERVAL '60 days'),
  ('cl000000-0000-0000-0003-000000000002', v_pp3, 20, 'Job completion reward', TRUE, v_now - INTERVAL '40 days'),
  ('cl000000-0000-0000-0003-000000000003', v_pp3, 2,  'Rating bonus: 3-star review', TRUE, v_now - INTERVAL '40 days'),
  ('cl000000-0000-0000-0003-000000000004', v_pp3, 20, 'Job completion reward', TRUE, v_now - INTERVAL '20 days'),
  ('cl000000-0000-0000-0003-000000000005', v_pp3, 1,  'Rating bonus: 2-star review', TRUE, v_now - INTERVAL '20 days'),
  ('cl000000-0000-0000-0003-000000000006', v_pp3, -40,'Bid cost deducted: outbid in arena', TRUE, v_now - INTERVAL '5 days'),
  -- Senthil P: 0 coins (new provider, not yet approved)
  -- Vinoth: 35 + 20+2 = 57, then 50% penalty on 35-coin bid = -17 => 40
  ('cl000000-0000-0000-0005-000000000001', v_pp5, 35, 'Onboarding approval coins', TRUE, v_now - INTERVAL '70 days'),
  ('cl000000-0000-0000-0005-000000000002', v_pp5, 20, 'Job completion reward', TRUE, v_now - INTERVAL '50 days'),
  ('cl000000-0000-0000-0005-000000000003', v_pp5, 2,  'Rating bonus: 3-star review', TRUE, v_now - INTERVAL '50 days'),
  ('cl000000-0000-0000-0005-000000000004', v_pp5, -18,'No-show penalty: 50% of 35 bid coins forfeited', TRUE, v_now - INTERVAL '2 days'),
  -- Arjun: org owner
  ('cl000000-0000-0000-0006-000000000001', v_pp6, 35, 'Onboarding approval coins', TRUE, v_now - INTERVAL '100 days'),
  ('cl000000-0000-0000-0006-000000000002', v_pp6, 20, 'Job completion reward', TRUE, v_now - INTERVAL '70 days'),
  ('cl000000-0000-0000-0006-000000000003', v_pp6, 5,  'Rating bonus: 5-star review', TRUE, v_now - INTERVAL '70 days'),
  ('cl000000-0000-0000-0006-000000000004', v_pp6, 20, 'Job completion reward', TRUE, v_now - INTERVAL '40 days'),
  ('cl000000-0000-0000-0006-000000000005', v_pp6, 3,  'Rating bonus: 4-star review', TRUE, v_now - INTERVAL '40 days'),
  -- Karthik: 35 approval + technician coins
  ('cl000000-0000-0000-0007-000000000001', v_pp7, 20, 'Job completion reward', TRUE, v_now - INTERVAL '45 days'),
  ('cl000000-0000-0000-0007-000000000002', v_pp7, 2,  'Rating bonus: 3-star review', TRUE, v_now - INTERVAL '45 days'),
  ('cl000000-0000-0000-0007-000000000003', v_pp7, 20, 'Job completion reward', TRUE, v_now - INTERVAL '20 days'),
  ('cl000000-0000-0000-0007-000000000004', v_pp7, 2,  'Rating bonus: 3-star review', TRUE, v_now - INTERVAL '20 days'),
  ('cl000000-0000-0000-0007-000000000005', v_pp7, -24,'Bid cost deducted: emergency arena', TRUE, v_now - INTERVAL '10 days'),
  -- Balaji: 35 approval + completions
  ('cl000000-0000-0000-0008-000000000001', v_pp8, 35, 'Onboarding approval coins', TRUE, v_now - INTERVAL '65 days'),
  ('cl000000-0000-0000-0008-000000000002', v_pp8, 20, 'Job completion reward', TRUE, v_now - INTERVAL '50 days'),
  ('cl000000-0000-0000-0008-000000000003', v_pp8, 5,  'Rating bonus: 5-star review', TRUE, v_now - INTERVAL '50 days'),
  ('cl000000-0000-0000-0008-000000000004', v_pp8, 20, 'Job completion reward', TRUE, v_now - INTERVAL '30 days'),
  ('cl000000-0000-0000-0008-000000000005', v_pp8, 3,  'Rating bonus: 4-star review', TRUE, v_now - INTERVAL '30 days'),
  ('cl000000-0000-0000-0008-000000000006', v_pp8, -38,'Bid cost deducted: emergency award (demo)', TRUE, v_now - INTERVAL '8 days')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SERVICE REQUESTS — All 35
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Group A: Open Ordinary (8) ───────────────────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, provider_preference, images, is_demo, created_at)
VALUES
  (v_req01, v_c1, 'ordinary', v_cat_pl, v_area_rs,
   'Kitchen tap leakage fix',
   'Kitchen tap dripping continuously. Tried tightening but didn''t help. நல்லா பார்க்கணும்.',
   600, 500, v_now + INTERVAL '3 days' + INTERVAL '9 hours',
   'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '2 days'),

  (v_req02, v_c2, 'ordinary', v_cat_el, v_area_gp,
   'Ceiling fan wobbling badly',
   'Fan wobbles and makes loud noise. Needs balancing or blade replacement.',
   650, 600, v_now + INTERVAL '4 days' + INTERVAL '9 hours',
   'open', 'either', '{}', TRUE, v_now - INTERVAL '3 days'),

  (v_req03, v_c3, 'ordinary', v_cat_cp, v_area_rs,
   'Bathroom door hinge repair',
   'Bottom hinge broken. Door scraping floor. Hard to close.',
   650, 550, v_now + INTERVAL '5 days' + INTERVAL '9 hours',
   'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '1 day'),

  (v_req04, v_c5, 'ordinary', v_cat_cp, v_area_sn,
   'Mosquito net frame fitting',
   'Need mosquito net fitted on 2 windows and 1 balcony door. Aluminium frames preferred.',
   700, 600, v_now + INTERVAL '6 days' + INTERVAL '8 hours',
   'open', 'either', '{}', TRUE, v_now - INTERVAL '4 days'),

  (v_req05, v_c6, 'ordinary', v_cat_ap, v_area_pm,
   'AC not cooling properly',
   'AC runs but room doesn''t cool. Might need gas refill. Last serviced 2 years ago.',
   950, 800, v_now + INTERVAL '5 days' + INTERVAL '9 hours',
   'open', 'organization', '{}', TRUE, v_now - INTERVAL '2 days'),

  (v_req06, v_c4, 'ordinary', v_cat_pl, v_area_ga,
   'Water heater leaking from inlet',
   'Small drip from hot water inlet pipe near geyser. Need it fixed before winter.',
   800, 700, v_now + INTERVAL '7 days' + INTERVAL '9 hours',
   'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '5 days'),

  (v_req07, v_c1, 'ordinary', v_cat_el, v_area_rs,
   'Switchboard sparking when plugging in',
   'Old switchboard near kitchen sparks. Needs immediate replacement. 3-pin socket gone bad.',
   650, 600, v_now + INTERVAL '4 days' + INTERVAL '9 hours',
   'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '1 day'),

  (v_req08, v_c3, 'ordinary', v_cat_el, v_area_kv,
   'Outdoor light not working',
   'Exterior porch light stopped working. Checked bulb, it''s fine. Wiring issue perhaps.',
   650, 600, v_now + INTERVAL '3 days' + INTERVAL '8 hours',
   'open', 'either', '{}', TRUE, v_now - INTERVAL '2 days')

ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, is_demo = TRUE;

-- ─── Group B: Emergency (5) ───────────────────────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, provider_preference, images, address_confidential,
   interest_expires_at, bidding_closes_at, top_bid_coins, assigned_provider_profile_id,
   is_demo, created_at)
VALUES
  -- 9: interest_window, 2 interested
  (v_req09, v_c1, 'emergency', v_cat_pl, v_area_rs,
   'Burst pipe — bathroom flooded urgently',
   'Bathroom pipe burst. Water everywhere. Immediate help needed!',
   2000, 1500, v_now + INTERVAL '2 hours',
   'interest_window', 'freelancer', '{}',
   '12, Sathyam Street, RS Puram, Coimbatore 641002',
   v_now + INTERVAL '40 minutes', NULL, NULL, NULL,
   TRUE, v_now - INTERVAL '5 minutes'),

  -- 10: interest_window, 3 interested
  (v_req10, v_c2, 'emergency', v_cat_el, v_area_gp,
   'Power outage — MCB keeps tripping',
   'Total power outage after MCB tripped. Cannot reset. Possible overload.',
   1500, 1100, v_now + INTERVAL '2 hours 30 minutes',
   'interest_window', 'either', '{}',
   '45, Nehru Street, Gandhipuram, Coimbatore 641012',
   v_now + INTERVAL '35 minutes', NULL, NULL, NULL,
   TRUE, v_now - INTERVAL '8 minutes'),

  -- 11: bidding_open, 3 bids
  (v_req11, v_c5, 'emergency', v_cat_pl, v_area_sn,
   'Gas smell from kitchen pipeline',
   'Strong gas smell near stove. Need urgent inspection and pipe seal.',
   1800, 1300, v_now + INTERVAL '3 hours',
   'bidding_open', 'freelancer', '{}',
   '8, Saravanampatti Main Road, Saravanampatti, Coimbatore 641035',
   NULL, v_now + INTERVAL '25 minutes', 38, NULL,
   TRUE, v_now - INTERVAL '20 minutes'),

  -- 12: bidding_open, 4 bids
  (v_req12, v_c3, 'emergency', v_cat_pl, v_area_rs,
   'Overhead tank valve broken, overflowing',
   'Tank keeps running. Float valve broken. Water wasting.',
   1600, 1200, v_now + INTERVAL '2 hours',
   'bidding_open', 'either', '{}',
   '23, 7th Cross, RS Puram, Coimbatore 641002',
   NULL, v_now + INTERVAL '15 minutes', 42, NULL,
   TRUE, v_now - INTERVAL '30 minutes'),

  -- 13: awarded to Kumaran
  (v_req13, v_c6, 'emergency', v_cat_el, v_area_pm,
   'Short circuit — burning smell from meter box',
   'Meter box smoking. Circuit breaker tripped. Entire flat without power.',
   2200, 1700, v_now + INTERVAL '4 hours',
   'awarded', 'organization', '{}',
   '56, Peelamedu Main Road, Peelamedu, Coimbatore 641004',
   NULL, NULL, 55, v_pp2,
   TRUE, v_now - INTERVAL '45 minutes')

ON CONFLICT (id) DO UPDATE SET
  status       = EXCLUDED.status,
  top_bid_coins = EXCLUDED.top_bid_coins,
  assigned_provider_profile_id = EXCLUDED.assigned_provider_profile_id,
  is_demo = TRUE;

-- ─── Group C: Accepted Future Jobs (6) ────────────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, assigned_provider_profile_id, provider_preference,
   images, is_demo, created_at)
VALUES
  (v_req14, v_c1, 'ordinary', v_cat_el, v_area_rs,
   'Full house wiring inspection',
   'House is 15 years old. Need complete electrical inspection and safety audit.',
   1500, 1200, v_now + INTERVAL '5 days' + INTERVAL '9 hours',
   'assigned', v_pp2, 'freelancer', '{}', TRUE, v_now - INTERVAL '10 days'),

  (v_req15, v_c2, 'ordinary', v_cat_pl, v_area_gp,
   'Kitchen sink drainage blockage',
   'Sink draining very slowly. Tried plunger. Need professional clearing.',
   700, 600, v_now + INTERVAL '3 days' + INTERVAL '9 hours',
   'assigned', v_pp1, 'freelancer', '{}', TRUE, v_now - INTERVAL '8 days'),

  (v_req16, v_c3, 'ordinary', v_cat_el, v_area_pm,
   'Bathroom exhaust fan replacement',
   'Old exhaust fan stopped. Need new one fitted. 6-inch size.',
   650, 600, v_now + INTERVAL '2 days' + INTERVAL '9 hours',
   'assigned', v_pp7, 'organization', '{}', TRUE, v_now - INTERVAL '6 days'),

  (v_req17, v_c5, 'ordinary', v_cat_cp, v_area_rs,
   'Wardrobe sliding hinge adjustment',
   'Wardrobe door keeps sliding off track. Need hinge realignment.',
   600, 550, v_now + INTERVAL '4 days' + INTERVAL '9 hours',
   'assigned', v_pp3, 'freelancer', '{}', TRUE, v_now - INTERVAL '7 days'),

  -- 18: awarded emergency
  (v_req18, v_c6, 'emergency', v_cat_pl, v_area_sn,
   'Water pump motor not starting',
   'Pump motor silent after power outage. Capacitor may have blown.',
   1600, 1300, v_now + INTERVAL '1 day' + INTERVAL '10 hours',
   'awarded', v_pp2, 'freelancer', '{}', TRUE, v_now - INTERVAL '2 days'),

  -- 19: awarded emergency (org/technician)
  (v_req19, v_c4, 'emergency', v_cat_el, v_area_ga,
   'New wiring needed for AC extension',
   'Need 15A socket and dedicated line for new AC installation.',
   2000, 1600, v_now + INTERVAL '2 days' + INTERVAL '9 hours',
   'awarded', v_pp8, 'organization', '{}', TRUE, v_now - INTERVAL '3 days')

ON CONFLICT (id) DO UPDATE SET
  status       = EXCLUDED.status,
  assigned_provider_profile_id = EXCLUDED.assigned_provider_profile_id,
  is_demo = TRUE;

-- ─── Group D: In Progress Today (2) ──────────────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, assigned_provider_profile_id, provider_preference,
   images, address_confidential, is_demo, created_at)
VALUES
  -- 20: provider marked complete, customer hasn't yet
  (v_req20, v_c1, 'ordinary', v_cat_pl, v_area_rs,
   'Solar water heater annual check',
   'Annual maintenance check of solar geyser. Clean collector plates.',
   900, 800, v_now - INTERVAL '1 hour',
   'in_progress', v_pp1, 'freelancer', '{}',
   '12, Sathyam Street, RS Puram, Coimbatore 641002', TRUE, v_now - INTERVAL '12 days'),

  -- 21: customer marked complete, provider hasn't yet
  (v_req21, v_c2, 'ordinary', v_cat_el, v_area_gp,
   'Full apartment electrical rewiring',
   'Complete rewiring for newly renovated flat. 2BHK.',
   5000, 4500, v_now - INTERVAL '1 hour',
   'in_progress', v_pp2, 'freelancer', '{}',
   '45, Nehru Street, Gandhipuram, Coimbatore 641012', TRUE, v_now - INTERVAL '15 days')

ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, is_demo = TRUE;

-- ─── Group E: Completed — both reviewed (22-27) ───────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, assigned_provider_profile_id, provider_preference, is_demo, created_at)
VALUES
  (v_req22, v_c1, 'ordinary', v_cat_pl, v_area_rs,
   'Mixer tap replacement', 'Old mixer tap replaced with new one.',
   750, 650, v_now - INTERVAL '40 days' + INTERVAL '9 hours', 'completed', v_pp1, 'freelancer', TRUE, v_now - INTERVAL '42 days'),

  (v_req23, v_c2, 'ordinary', v_cat_el, v_area_gp,
   'New switchboard installation', 'Added 4-way switchboard in bedroom.',
   600, 500, v_now - INTERVAL '35 days' + INTERVAL '10 hours', 'completed', v_pp2, 'freelancer', TRUE, v_now - INTERVAL '37 days'),

  (v_req24, v_c3, 'ordinary', v_cat_cp, v_area_rs,
   'Wardrobe key lock fix', 'Wardrobe lock jammed, replaced cylinder.',
   600, 550, v_now - INTERVAL '25 days' + INTERVAL '9 hours', 'completed', v_pp3, 'freelancer', TRUE, v_now - INTERVAL '27 days'),

  (v_req25, v_c4, 'ordinary', v_cat_pl, v_area_ga,
   'Bathroom flush mechanism repair', 'WC flush not working, repaired fill valve.',
   650, 600, v_now - INTERVAL '20 days' + INTERVAL '9 hours', 'completed', v_pp1, 'freelancer', TRUE, v_now - INTERVAL '22 days'),

  (v_req26, v_c5, 'ordinary', v_cat_el, v_area_sn,
   'Ceiling rose wiring repair', 'Ceiling rose rewired for fan light combo.',
   650, 600, v_now - INTERVAL '15 days' + INTERVAL '9 hours', 'completed', v_pp2, 'either', TRUE, v_now - INTERVAL '17 days'),

  (v_req27, v_c6, 'ordinary', v_cat_ap, v_area_pm,
   'Washing machine drain pipe fix', 'Drain pipe blocked, cleaned and repositioned.',
   900, 800, v_now - INTERVAL '10 days' + INTERVAL '10 hours', 'completed', v_pp7, 'organization', TRUE, v_now - INTERVAL '12 days')

ON CONFLICT (id) DO UPDATE SET status = 'completed', is_demo = TRUE;

-- ─── Group F: Completed — within review wait (28) ─────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, assigned_provider_profile_id, provider_preference, is_demo, created_at)
VALUES
  (v_req28, v_c3, 'ordinary', v_cat_pl, v_area_rs,
   'Bathroom faucet cartridge replacement',
   'Hot/cold mixer faucet cartridge replaced.',
   800, 700, v_now - INTERVAL '25 minutes', 'completed', v_pp3, 'freelancer', TRUE, v_now - INTERVAL '3 days')

ON CONFLICT (id) DO UPDATE SET status = 'completed', is_demo = TRUE;

-- ─── Group G: Awaiting customer review (29) ───────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, assigned_provider_profile_id, provider_preference, is_demo, created_at)
VALUES
  (v_req29, v_c1, 'ordinary', v_cat_el, v_area_rs,
   'MCB upgrade for 10A to 32A',
   'Main MCB upgraded for heavy appliances.',
   1200, 1000, v_now - INTERVAL '3 days' + INTERVAL '9 hours', 'completed', v_pp2, 'freelancer', TRUE, v_now - INTERVAL '5 days')

ON CONFLICT (id) DO UPDATE SET status = 'completed', is_demo = TRUE;

-- ─── Group H: Awaiting provider review (30-31) ────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, assigned_provider_profile_id, provider_preference, is_demo, created_at)
VALUES
  (v_req30, v_c6, 'ordinary', v_cat_pl, v_area_pm,
   'Overhead tank cleaning',
   'Annual tank cleaning and pipe flushing.',
   1000, 900, v_now - INTERVAL '5 days' + INTERVAL '9 hours', 'completed', v_pp1, 'freelancer', TRUE, v_now - INTERVAL '7 days'),

  (v_req31, v_c5, 'ordinary', v_cat_el, v_area_sn,
   'Power point extension for home office',
   'Added 2 new sockets for home office area.',
   700, 600, v_now - INTERVAL '4 days' + INTERVAL '10 hours', 'completed', v_pp7, 'organization', TRUE, v_now - INTERVAL '6 days')

ON CONFLICT (id) DO UPDATE SET status = 'completed', is_demo = TRUE;

-- ─── Group I: No-shows (32-33) ────────────────────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, assigned_provider_profile_id, provider_preference, is_demo, created_at)
VALUES
  -- 32: original no-show (Vinoth), now reopened (v_req32r is the new post)
  (v_req32, v_c2, 'ordinary', v_cat_pl, v_area_gp,
   'Shower head replacement',
   'Old shower head leaking from base. Need replacement.',
   600, 500, v_now - INTERVAL '3 days' + INTERVAL '10 hours', 'cancelled', v_pp5, 'freelancer', TRUE, v_now - INTERVAL '10 days'),

  -- 33: no-show not reopened
  (v_req33, v_c6, 'ordinary', v_cat_cp, v_area_pm,
   'Bookshelf assembly',
   'IKEA-style flat-pack bookshelf needs assembly.',
   600, 550, v_now - INTERVAL '5 days' + INTERVAL '9 hours', 'cancelled', v_pp4, 'freelancer', TRUE, v_now - INTERVAL '8 days')

ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, is_demo = TRUE;

-- 32r: Reopened no-show post (copy of req32, new ID)
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, provider_preference, images, is_demo, created_at)
VALUES
  (v_req32r, v_c2, 'ordinary', v_cat_pl, v_area_gp,
   'Shower head replacement (reopened)',
   'Old shower head leaking from base. Need replacement. (Previous provider no-showed)',
   600, 500, v_now + INTERVAL '3 days' + INTERVAL '10 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '2 days')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, is_demo = TRUE;

-- ─── Group J: Cancelled/Expired (34-35) ──────────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description, offered_price, min_price,
   preferred_start, status, provider_preference, images, is_demo, created_at)
VALUES
  (v_req34, v_c3, 'ordinary', v_cat_cp, v_area_rs,
   'Curtain rod installation',
   'Need curtain rods fitted in living room and bedroom.',
   600, 550, v_now - INTERVAL '15 days' + INTERVAL '9 hours', 'cancelled', 'either', '{}', TRUE, v_now - INTERVAL '20 days'),

  (v_req35, v_c5, 'emergency', v_cat_el, v_area_sn,
   'Water pump electrical failure',
   'Pump not starting. Need urgent electrician.',
   1500, 1200, v_now - INTERVAL '5 days' + INTERVAL '2 hours', 'expired', 'freelancer', '{}', TRUE, v_now - INTERVAL '6 days'),

  -- Full-category coverage requests so every service category has demo demand.
  (v_req36, v_c1, 'ordinary', v_cat_cl, v_area_sc,
   'Deep home cleaning before festival',
   '2-bedroom flat needs deep kitchen, bathroom and sofa cleaning before guests arrive.',
   1600, 1400, v_now + INTERVAL '2 days' + INTERVAL '11 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '1 day'),

  (v_req37, v_c2, 'ordinary', v_cat_pa, v_area_gp,
   'Bedroom wall repaint touch-up',
   'Need two walls repainted plus patching work after minor water seepage.',
   2200, 1800, v_now + INTERVAL '4 days' + INTERVAL '10 hours', 'assigned', v_pp6, 'organization', '{}', TRUE, v_now - INTERVAL '4 days'),

  (v_req38, v_c4, 'ordinary', v_cat_ac, v_area_ga,
   'AC maintenance and gas top-up',
   'AC is cooling weakly. Need coil cleaning and refrigerant balance.',
   1800, 1500, v_now + INTERVAL '3 days' + INTERVAL '9 hours', 'assigned', v_pp8, 'organization', '{}', TRUE, v_now - INTERVAL '6 days'),

  (v_req39, v_c5, 'ordinary', v_cat_pc, v_area_sn,
   'Pest control for kitchen cupboards',
   'Cockroach problem in kitchen cabinets and storage area. Need 1-day service.',
   1000, 800, v_now + INTERVAL '2 days' + INTERVAL '8 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '2 days'),

  (v_req40, v_c6, 'ordinary', v_cat_cv, v_area_pm,
   'CCTV camera installation for main gate',
   'Need 2 outdoor cameras and Wi-Fi DVR setup for driveway and gate area.',
   2600, 2200, v_now + INTERVAL '5 days' + INTERVAL '9 hours', 'assigned', v_pp2, 'freelancer', '{}', TRUE, v_now - INTERVAL '8 days'),

  (v_req41, v_c3, 'ordinary', v_cat_gn, v_area_rs,
   'Garden trimming and plant maintenance',
   'Lawn and shrubs need trimming before monsoon. Also 3 small pots to be rearranged.',
   1200, 900, v_now + INTERVAL '6 days' + INTERVAL '10 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '3 days'),

  (v_req42, v_c2, 'ordinary', v_cat_mv, v_area_gp,
   'Home shifting support with furniture loading',
   'Need 3 movers for a compact move from 2BHK to rental flat with packing support.',
   3200, 2800, v_now + INTERVAL '7 days' + INTERVAL '9 hours', 'assigned', v_pp6, 'organization', '{}', TRUE, v_now - INTERVAL '7 days'),

  (v_req43, v_c4, 'ordinary', v_cat_in, v_area_ga,
   'Minor interior redesign for living room',
   'Need false ceiling and modular shelf layout planning for a compact living room.',
   4200, 3600, v_now + INTERVAL '8 days' + INTERVAL '11 hours', 'assigned', v_pp3, 'organization', '{}', TRUE, v_now - INTERVAL '10 days'),

  (v_req44, v_c1, 'ordinary', v_cat_cl, v_area_rs,
   'Sofa and mattress deep cleaning',
   'Need fabric treatment for sofa, mattress and bedroom rug. Good for allergy cleanup.',
   1800, 1500, v_now + INTERVAL '3 days' + INTERVAL '12 hours', 'assigned', v_pp1, 'freelancer', '{}', TRUE, v_now - INTERVAL '5 days')

ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, assigned_provider_profile_id = EXCLUDED.assigned_provider_profile_id, is_demo = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. BIDS — Emergency arena bids
-- ═══════════════════════════════════════════════════════════════════════════

-- Request 11 bids (3 bids: Rajan 35c, Mani 38c, Kumaran 40c)
INSERT INTO public.bids (id, request_id, provider_profile_id, coins, status, note, is_demo, created_at)
VALUES
  ('bid00001-0000-0000-0000-000000000001', v_req11, v_pp1, 35, 'outbid',
   'Quick response guaranteed', TRUE, v_now - INTERVAL '18 minutes'),
  ('bid00001-0000-0000-0000-000000000002', v_req11, v_pp3, 38, 'outbid',
   'Experienced with gas fittings', TRUE, v_now - INTERVAL '15 minutes'),
  ('bid00001-0000-0000-0000-000000000003', v_req11, v_pp2, 40, 'active',
   'Available now. Will be there in 30 mins.', TRUE, v_now - INTERVAL '12 minutes'),

  -- Request 12 bids (4 bids: Rajan 36c, Mani 40c, Karthik 42c, Kumaran 45c)
  ('bid00001-0000-0000-0000-000000000011', v_req12, v_pp1, 36, 'outbid',
   'RS Puram expert', TRUE, v_now - INTERVAL '28 minutes'),
  ('bid00001-0000-0000-0000-000000000012', v_req12, v_pp3, 40, 'outbid',
   'Coming immediately', TRUE, v_now - INTERVAL '25 minutes'),
  ('bid00001-0000-0000-0000-000000000013', v_req12, v_pp7, 42, 'outbid',
   'Organization team available', TRUE, v_now - INTERVAL '22 minutes'),
  ('bid00001-0000-0000-0000-000000000014', v_req12, v_pp2, 45, 'active',
   'Top-rated. Can start in 20 mins.', TRUE, v_now - INTERVAL '18 minutes'),

  -- Request 13 bid (awarded to Kumaran, bid used was 55c)
  ('bid00001-0000-0000-0000-000000000021', v_req13, v_pp2, 55, 'won',
   'Certified electrician. Will handle safely.', TRUE, v_now - INTERVAL '42 minutes')

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. BID INTERESTS — For interest_window requests
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.bid_interests (request_id, provider_profile_id, status, is_demo, created_at)
VALUES
  -- req09: 2 interested (Rajan, Mani)
  (v_req09, v_pp1, 'interested', TRUE, v_now - INTERVAL '3 minutes'),
  (v_req09, v_pp3, 'interested', TRUE, v_now - INTERVAL '2 minutes'),
  -- req10: 3 interested (Kumaran, Karthik, Balaji)
  (v_req10, v_pp2, 'interested', TRUE, v_now - INTERVAL '6 minutes'),
  (v_req10, v_pp7, 'interested', TRUE, v_now - INTERVAL '5 minutes'),
  (v_req10, v_pp8, 'interested', TRUE, v_now - INTERVAL '4 minutes')
ON CONFLICT (request_id, provider_profile_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. BOOKINGS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.bookings
  (id, request_id, provider_profile_id, time_range, status, is_demo, created_at)
VALUES
  -- Future bookings (14-19)
  (v_bk14, v_req14, v_pp2,
   format('[%s, %s)', v_now + INTERVAL '5 days 9 hours', v_now + INTERVAL '5 days 11 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '9 days'),

  (v_bk15, v_req15, v_pp1,
   format('[%s, %s)', v_now + INTERVAL '3 days 10 hours', v_now + INTERVAL '3 days 12 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '7 days'),

  (v_bk16, v_req16, v_pp7,
   format('[%s, %s)', v_now + INTERVAL '2 days 11 hours', v_now + INTERVAL '2 days 13 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '5 days'),

  (v_bk17, v_req17, v_pp3,
   format('[%s, %s)', v_now + INTERVAL '4 days 14 hours', v_now + INTERVAL '4 days 16 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '6 days'),

  (v_bk18, v_req18, v_pp2,
   format('[%s, %s)', v_now + INTERVAL '1 day 10 hours', v_now + INTERVAL '1 day 13 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '2 days'),

  (v_bk19, v_req19, v_pp8,
   format('[%s, %s)', v_now + INTERVAL '2 days 9 hours', v_now + INTERVAL '2 days 11 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '3 days'),

  -- In progress (20-21)
  (v_bk20, v_req20, v_pp1,
   format('[%s, %s)', v_now - INTERVAL '2 hours', v_now)::tstzrange,
   'in_progress', TRUE, v_now - INTERVAL '12 days'),

  (v_bk21, v_req21, v_pp2,
   format('[%s, %s)', v_now - INTERVAL '3 hours', v_now)::tstzrange,
   'in_progress', TRUE, v_now - INTERVAL '15 days'),

  -- Completed both reviewed (22-27)  
  (v_bk22, v_req22, v_pp1,
   format('[%s, %s)', v_now - INTERVAL '40 days 11 hours', v_now - INTERVAL '40 days 9 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '42 days'),

  (v_bk23, v_req23, v_pp2,
   format('[%s, %s)', v_now - INTERVAL '35 days 12 hours', v_now - INTERVAL '35 days 10 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '37 days'),

  (v_bk24, v_req24, v_pp3,
   format('[%s, %s)', v_now - INTERVAL '25 days 13 hours', v_now - INTERVAL '25 days 11 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '27 days'),

  (v_bk25, v_req25, v_pp1,
   format('[%s, %s)', v_now - INTERVAL '20 days 11 hours', v_now - INTERVAL '20 days 9 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '22 days'),

  (v_bk26, v_req26, v_pp2,
   format('[%s, %s)', v_now - INTERVAL '15 days 16 hours', v_now - INTERVAL '15 days 14 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '17 days'),

  (v_bk27, v_req27, v_pp7,
   format('[%s, %s)', v_now - INTERVAL '10 days 12 hours', v_now - INTERVAL '10 days 10 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '12 days'),

  -- Review wait (28)
  (v_bk28, v_req28, v_pp3,
   format('[%s, %s)', v_now - INTERVAL '25 minutes', v_now - INTERVAL '5 minutes')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '3 days'),

  -- Awaiting customer review (29)
  (v_bk29, v_req29, v_pp2,
   format('[%s, %s)', v_now - INTERVAL '3 days 9 hours', v_now - INTERVAL '3 days 7 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '5 days'),

  -- Awaiting provider review (30-31)
  (v_bk30, v_req30, v_pp1,
   format('[%s, %s)', v_now - INTERVAL '5 days 11 hours', v_now - INTERVAL '5 days 9 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '7 days'),

  (v_bk31, v_req31, v_pp7,
   format('[%s, %s)', v_now - INTERVAL '4 days 12 hours', v_now - INTERVAL '4 days 10 hours')::tstzrange,
   'completed', TRUE, v_now - INTERVAL '6 days'),

  -- No-shows (32-33) — bookings exist but no-show was claimed
  (v_bk32, v_req32, v_pp5,
   format('[%s, %s)', v_now - INTERVAL '3 days 10 hours', v_now - INTERVAL '3 days 8 hours')::tstzrange,
   'no_show', TRUE, v_now - INTERVAL '10 days'),

  (v_bk33, v_req33, v_pp4,
   format('[%s, %s)', v_now - INTERVAL '5 days 9 hours', v_now - INTERVAL '5 days 7 hours')::tstzrange,
   'no_show', TRUE, v_now - INTERVAL '8 days'),

  -- Full-category coverage bookings (category + customer + provider connection)
  (v_bk36, v_req36, v_pp1,
   format('[%s, %s)', v_now + INTERVAL '2 days 11 hours', v_now + INTERVAL '2 days 14 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '1 day'),

  (v_bk37, v_req37, v_pp6,
   format('[%s, %s)', v_now + INTERVAL '4 days 10 hours', v_now + INTERVAL '4 days 13 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '4 days'),

  (v_bk38, v_req38, v_pp8,
   format('[%s, %s)', v_now + INTERVAL '3 days 9 hours', v_now + INTERVAL '3 days 12 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '6 days'),

  (v_bk39, v_req39, v_pp5,
   format('[%s, %s)', v_now + INTERVAL '2 days 8 hours', v_now + INTERVAL '2 days 10 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '2 days'),

  (v_bk40, v_req40, v_pp2,
   format('[%s, %s)', v_now + INTERVAL '5 days 9 hours', v_now + INTERVAL '5 days 12 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '8 days'),

  (v_bk41, v_req41, v_pp4,
   format('[%s, %s)', v_now + INTERVAL '6 days 10 hours', v_now + INTERVAL '6 days 12 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '3 days'),

  (v_bk42, v_req42, v_pp6,
   format('[%s, %s)', v_now + INTERVAL '7 days 9 hours', v_now + INTERVAL '7 days 13 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '7 days'),

  (v_bk43, v_req43, v_pp3,
   format('[%s, %s)', v_now + INTERVAL '8 days 11 hours', v_now + INTERVAL '8 days 15 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '10 days'),

  (v_bk44, v_req44, v_pp1,
   format('[%s, %s)', v_now + INTERVAL '3 days 12 hours', v_now + INTERVAL '3 days 15 hours')::tstzrange,
   'confirmed', TRUE, v_now - INTERVAL '5 days')

ON CONFLICT (id) DO NOTHING;

-- Mark provider-completed for req20, customer-completed for req21
UPDATE public.bookings SET provider_marked_complete_at = v_now - INTERVAL '30 minutes'
WHERE id = v_bk20;

UPDATE public.bookings SET customer_marked_complete_at = v_now - INTERVAL '20 minutes'
WHERE id = v_bk21;

-- Mark review_opens_at for completed bookings
UPDATE public.bookings SET
  provider_marked_complete_at = created_at + INTERVAL '2 hours',
  customer_marked_complete_at = created_at + INTERVAL '2 hours 20 minutes',
  review_opens_at = created_at + INTERVAL '2 hours 50 minutes'
WHERE id IN (v_bk22, v_bk23, v_bk24, v_bk25, v_bk26, v_bk27);

-- bk28: both marked complete 25 min ago, review opens in 5 min (30-min wait)
UPDATE public.bookings SET
  provider_marked_complete_at = v_now - INTERVAL '25 minutes',
  customer_marked_complete_at = v_now - INTERVAL '24 minutes',
  review_opens_at = v_now + INTERVAL '5 minutes'  -- still in 30-min wait
WHERE id = v_bk28;

-- bk29: provider reviewed, awaiting customer
UPDATE public.bookings SET
  provider_marked_complete_at = v_now - INTERVAL '3 days 2 hours',
  customer_marked_complete_at = v_now - INTERVAL '3 days 1 hour 50 minutes',
  review_opens_at = v_now - INTERVAL '3 days 1 hour 20 minutes'
WHERE id = v_bk29;

-- bk30, bk31: customer reviewed, awaiting provider
UPDATE public.bookings SET
  provider_marked_complete_at = v_now - INTERVAL '5 days 2 hours',
  customer_marked_complete_at = v_now - INTERVAL '5 days 1 hour 50 minutes',
  review_opens_at = v_now - INTERVAL '5 days 1 hour 20 minutes'
WHERE id = v_bk30;

UPDATE public.bookings SET
  provider_marked_complete_at = v_now - INTERVAL '4 days 2 hours',
  customer_marked_complete_at = v_now - INTERVAL '4 days 1 hour 50 minutes',
  review_opens_at = v_now - INTERVAL '4 days 1 hour 20 minutes'
WHERE id = v_bk31;

-- bk32, bk33: noshow — set noshow_claimed_at (column is noshow_claimed_at, not boolean)
UPDATE public.bookings SET
  noshow_claimed_at = v_now - INTERVAL '2 days 23 hours'
WHERE id = v_bk32;

UPDATE public.bookings SET
  noshow_claimed_at = v_now - INTERVAL '4 days 22 hours'
WHERE id = v_bk33;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. REVIEWS — Only for completed bookings with reviews
-- ═══════════════════════════════════════════════════════════════════════════

-- req22-27: both reviews revealed
INSERT INTO public.reviews
  (id, request_id, reviewer_id, reviewee_id, direction, rating, feedback, revealed, is_demo, created_at)
VALUES
  -- bk22: Priya→Rajan (4★) + Rajan→Priya (5★)
  ('rev00000-0000-0000-0001-000000000001', v_req22, v_c1, v_p1,
   'customer_to_provider', 4, 'Good work. Fixed quickly. Minor delay but overall fine.',
   TRUE, TRUE, v_now - INTERVAL '38 days'),
  ('rev00000-0000-0000-0001-000000000002', v_req22, v_p1, v_c1,
   'provider_to_customer', 5, 'Polite customer. Clear instructions. Payment on time.',
   TRUE, TRUE, v_now - INTERVAL '38 days'),

  -- bk23: Arun→Kumaran (5★) + Kumaran→Arun (4★)
  ('rev00000-0000-0000-0002-000000000001', v_req23, v_c2, v_p2,
   'customer_to_provider', 5, 'Excellent! Very professional and clean work.',
   TRUE, TRUE, v_now - INTERVAL '33 days'),
  ('rev00000-0000-0000-0002-000000000002', v_req23, v_p2, v_c2,
   'provider_to_customer', 4, 'Cooperative customer. வீடு clean-ஆ இருந்தது.',
   TRUE, TRUE, v_now - INTERVAL '33 days'),

  -- bk24: Meena→Mani (3★) + Mani→Meena (4★)
  ('rev00000-0000-0000-0003-000000000001', v_req24, v_c3, v_p3,
   'customer_to_provider', 3, 'Okay work. Took longer than expected.',
   TRUE, TRUE, v_now - INTERVAL '23 days'),
  ('rev00000-0000-0000-0003-000000000002', v_req24, v_p3, v_c3,
   'provider_to_customer', 4, 'Good customer. Clear instructions.',
   TRUE, TRUE, v_now - INTERVAL '23 days'),

  -- bk25: Senthil C→Rajan (4★) + Rajan→Senthil C (3★)
  ('rev00000-0000-0000-0004-000000000001', v_req25, v_c4, v_p1,
   'customer_to_provider', 4, 'Good service. Explained the issue well.',
   TRUE, TRUE, v_now - INTERVAL '18 days'),
  ('rev00000-0000-0000-0004-000000000002', v_req25, v_p1, v_c4,
   'provider_to_customer', 3, 'Average. Expected more cooperation.',
   TRUE, TRUE, v_now - INTERVAL '18 days'),

  -- bk26: Kavitha→Kumaran (5★) + Kumaran→Kavitha (5★)
  ('rev00000-0000-0000-0005-000000000001', v_req26, v_c5, v_p2,
   'customer_to_provider', 5, 'Super! Fast, clean, and professional.',
   TRUE, TRUE, v_now - INTERVAL '13 days'),
  ('rev00000-0000-0000-0005-000000000002', v_req26, v_p2, v_c5,
   'provider_to_customer', 5, 'Wonderful customer. Will work again!',
   TRUE, TRUE, v_now - INTERVAL '13 days'),

  -- bk27: Deepa→Karthik (4★) + Karthik→Deepa (4★)
  ('rev00000-0000-0000-0006-000000000001', v_req27, v_c6, v_p7,
   'customer_to_provider', 4, 'Nice job. Handled carefully.',
   TRUE, TRUE, v_now - INTERVAL '8 days'),
  ('rev00000-0000-0000-0006-000000000002', v_req27, v_p7, v_c6,
   'provider_to_customer', 4, 'Friendly and prompt customer.',
   TRUE, TRUE, v_now - INTERVAL '8 days'),

  -- bk29: Provider (Kumaran) reviewed. Awaiting customer (Priya).
  ('rev00000-0000-0000-0007-000000000001', v_req29, v_p2, v_c1,
   'provider_to_customer', 5, 'Great customer. Always on time.',
   FALSE, TRUE, v_now - INTERVAL '2 days 23 hours'),

  -- bk30: Customer (Deepa) reviewed. Awaiting provider (Rajan).
  ('rev00000-0000-0000-0008-000000000001', v_req30, v_c6, v_p1,
   'customer_to_provider', 4, 'Good job on tank cleaning.',
   FALSE, TRUE, v_now - INTERVAL '4 days 22 hours'),

  -- bk31: Customer (Kavitha) reviewed. Awaiting provider (Karthik).
  ('rev00000-0000-0000-0009-000000000001', v_req31, v_c5, v_p7,
   'customer_to_provider', 4, 'Good quality power point installation.',
   FALSE, TRUE, v_now - INTERVAL '3 days 22 hours'),

  -- bk32: No-show by Vinoth. Customer (Arun) reviewed.
  ('rev00000-0000-0000-0010-000000000001', v_req32, v_c2, v_p5,
   'customer_to_provider', 1, 'Provider never showed up! Wasted my half day.',
   TRUE, TRUE, v_now - INTERVAL '2 days 20 hours'),

  -- bk33: No-show by Senthil P. Customer (Deepa) reviewed.
  ('rev00000-0000-0000-0011-000000000001', v_req33, v_c6, v_p4,
   'customer_to_provider', 1, 'Did not come. No call either. Very disappointing.',
   TRUE, TRUE, v_now - INTERVAL '4 days 20 hours')

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. DISPUTES — No-show disputes
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.disputes
  (id, request_id, raised_by, category, description, status, created_at)
VALUES
  ('ds000000-0000-0000-0000-000000000001', v_req32, v_c2,
   'no_show',
   'Provider Vinoth Anand did not show up for scheduled shower head replacement. Did not call or inform.',
   'open', v_now - INTERVAL '2 days 22 hours'),

  ('ds000000-0000-0000-0000-000000000002', v_req33, v_c6,
   'no_show',
   'Provider Senthil Prabhu was a no-show for bookshelf assembly. No prior notice.',
   'under_review', v_now - INTERVAL '4 days 21 hours')

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. CHAT CONVERSATIONS + MESSAGES — Structured cards for confirmed bookings
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.chat_conversations
  (id, booking_id, request_id, created_at, updated_at)
VALUES
  ('cc000000-0000-0000-0014-000000000001', v_bk14, v_req14, v_now - INTERVAL '9 days', v_now - INTERVAL '9 days'),
  ('cc000000-0000-0000-0015-000000000001', v_bk15, v_req15, v_now - INTERVAL '7 days', v_now - INTERVAL '7 days'),
  ('cc000000-0000-0000-0020-000000000001', v_bk20, v_req20, v_now - INTERVAL '2 hours', v_now - INTERVAL '2 hours'),
  ('cc000000-0000-0000-0021-000000000001', v_bk21, v_req21, v_now - INTERVAL '3 hours', v_now - INTERVAL '3 hours')
ON CONFLICT (id) DO NOTHING;

-- Booking 14: Priya ↔ Kumaran (future wiring job)
INSERT INTO public.chat_messages
  (id, conversation_id, booking_id, sender_id, sender_role, message_type, content, media_url, metadata, is_reported, created_at)
VALUES
  ('cm000000-0000-0000-0014-000000000001', 'cc000000-0000-0000-0014-000000000001', v_bk14, v_c1, 'customer', 'text', 'Hello, when can you come?', NULL, '{}', FALSE, v_now - INTERVAL '9 days'),
  ('cm000000-0000-0000-0014-000000000002', 'cc000000-0000-0000-0014-000000000001', v_bk14, v_p2, 'provider', 'text', 'I can come on the confirmed date. Please keep the main switch off before I arrive.', NULL, '{}', FALSE, v_now - INTERVAL '9 days' + INTERVAL '10 minutes'),
  ('cm000000-0000-0000-0014-000000000003', 'cc000000-0000-0000-0014-000000000001', v_bk14, v_p2, 'provider', 'card_propose_time', 'Proposed a time for the visit.', NULL, jsonb_build_object('proposed_start', (v_now + INTERVAL '5 days 9 hours')::text, 'duration_hours', 2), FALSE, v_now - INTERVAL '9 days' + INTERVAL '20 minutes'),
  ('cm000000-0000-0000-0014-000000000004', 'cc000000-0000-0000-0014-000000000001', v_bk14, v_c1, 'customer', 'card_confirm_time', 'Confirmed the time for the visit.', NULL, jsonb_build_object('confirmed_start', (v_now + INTERVAL '5 days 9 hours')::text), FALSE, v_now - INTERVAL '9 days' + INTERVAL '30 minutes'),
  ('cm000000-0000-0000-0014-000000000005', 'cc000000-0000-0000-0014-000000000001', v_bk14, v_c1, 'customer', 'text', 'Sure! Main switch will be off.', NULL, '{}', FALSE, v_now - INTERVAL '9 days' + INTERVAL '35 minutes'),

  -- Booking 15: Arun ↔ Rajan (sink drainage)
  ('cm000000-0000-0000-0015-000000000001', 'cc000000-0000-0000-0015-000000000001', v_bk15, v_c2, 'customer', 'text', 'Can you confirm the appointment?', NULL, '{}', FALSE, v_now - INTERVAL '7 days'),
  ('cm000000-0000-0000-0015-000000000002', 'cc000000-0000-0000-0015-000000000001', v_bk15, v_p1, 'provider', 'text', 'Yes, I will be there on time. நேர்மையான வேலை செய்வேன்.', NULL, '{}', FALSE, v_now - INTERVAL '7 days' + INTERVAL '15 minutes'),
  ('cm000000-0000-0000-0015-000000000003', 'cc000000-0000-0000-0015-000000000001', v_bk15, v_p1, 'provider', 'card_propose_time', 'Proposed a new appointment time.', NULL, jsonb_build_object('proposed_start', (v_now + INTERVAL '3 days 10 hours')::text, 'duration_hours', 2), FALSE, v_now - INTERVAL '7 days' + INTERVAL '25 minutes'),
  ('cm000000-0000-0000-0015-000000000004', 'cc000000-0000-0000-0015-000000000001', v_bk15, v_c2, 'customer', 'card_confirm_time', 'Confirmed the visit time.', NULL, jsonb_build_object('confirmed_start', (v_now + INTERVAL '3 days 10 hours')::text), FALSE, v_now - INTERVAL '7 days' + INTERVAL '40 minutes'),

  -- Booking 20: Priya ↔ Rajan (in-progress, provider marked complete)
  ('cm000000-0000-0000-0020-000000000001', 'cc000000-0000-0000-0020-000000000001', v_bk20, v_p1, 'provider', 'card_on_the_way', 'On the way to the customer.', NULL, jsonb_build_object('eta_minutes', 15), FALSE, v_now - INTERVAL '2 hours 30 minutes'),
  ('cm000000-0000-0000-0020-000000000002', 'cc000000-0000-0000-0020-000000000001', v_bk20, v_c1, 'customer', 'text', 'Okay, door is open!', NULL, '{}', FALSE, v_now - INTERVAL '2 hours 20 minutes'),
  ('cm000000-0000-0000-0020-000000000003', 'cc000000-0000-0000-0020-000000000001', v_bk20, v_c1, 'customer', 'card_share_address', 'Shared address details for arrival.', NULL, jsonb_build_object('address', '12, Sathyam Street, RS Puram, Coimbatore 641002', 'landmark', 'Near Annamalai School gate'), FALSE, v_now - INTERVAL '2 hours 15 minutes'),
  ('cm000000-0000-0000-0020-000000000004', 'cc000000-0000-0000-0020-000000000001', v_bk20, v_p1, 'provider', 'text', 'Thank you! கிளம்பிட்டேன்.', NULL, '{}', FALSE, v_now - INTERVAL '2 hours 10 minutes'),
  ('cm000000-0000-0000-0020-000000000005', 'cc000000-0000-0000-0020-000000000001', v_bk20, v_p1, 'provider', 'text', 'Work done. Please check and confirm.', NULL, '{}', FALSE, v_now - INTERVAL '30 minutes'),

  -- Booking 21: Arun ↔ Kumaran (in-progress, customer marked complete)
  ('cm000000-0000-0000-0021-000000000001', 'cc000000-0000-0000-0021-000000000001', v_bk21, v_p2, 'provider', 'card_on_the_way', 'On the way to the customer.', NULL, jsonb_build_object('eta_minutes', 20), FALSE, v_now - INTERVAL '3 hours 30 minutes'),
  ('cm000000-0000-0000-0021-000000000002', 'cc000000-0000-0000-0021-000000000001', v_bk21, v_c2, 'customer', 'card_share_address', 'Shared address details for arrival.', NULL, jsonb_build_object('address', '45, Nehru Street, Gandhipuram, Coimbatore 641012', 'landmark', 'Opposite SBI Bank'), FALSE, v_now - INTERVAL '3 hours 20 minutes'),
  ('cm000000-0000-0000-0021-000000000003', 'cc000000-0000-0000-0021-000000000001', v_bk21, v_p2, 'provider', 'text', 'Thank you. Reached. Starting work.', NULL, '{}', FALSE, v_now - INTERVAL '3 hours'),
  ('cm000000-0000-0000-0021-000000000004', 'cc000000-0000-0000-0021-000000000001', v_bk21, v_c2, 'customer', 'text', 'All looks good! I have marked as complete. You can review when you''re free.', NULL, '{}', FALSE, v_now - INTERVAL '20 minutes'),

  -- A blocked phone-sharing attempt (logged, not shown in visible content)
  ('cm000000-0000-0000-0014-000000000099', 'cc000000-0000-0000-0014-000000000001', v_bk14, v_c1, 'customer', 'text', '[Phone number sharing blocked by system policy]', NULL, jsonb_build_object('blocked_attempt', TRUE, 'reason', 'Phone number detected in message'), FALSE, v_now - INTERVAL '8 days')

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. EMERGENCY FEE PAYMENTS (for awarded emergencies 13, 18, 19)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.emergency_fee_payments
  (id, customer_id, amount, status, fee_version, payment_method, created_at)
VALUES
  ('efp00000-0000-0000-0000-000000000013', v_c6, 50, 'paid', 1, 'UPI', v_now - INTERVAL '46 minutes'),
  ('efp00000-0000-0000-0000-000000000018', v_c6, 50, 'paid', 1, 'UPI', v_now - INTERVAL '2 days 2 hours'),
  ('efp00000-0000-0000-0000-000000000019', v_c4, 50, 'paid', 1, 'UPI', v_now - INTERVAL '3 days 2 hours')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION
-- ═══════════════════════════════════════════════════════════════════════════

RAISE NOTICE 'Demo seed completed: 35 service requests, 7 providers (3 freelancers + 1 org + 2 technicians + 1 new), 6 customers.';
RAISE NOTICE 'All rows tagged is_demo=TRUE. Admin Demo Mode toggle controls visibility.';

END;
$$;

COMMIT;
