-- ============================================================================
-- SAMPLE LISTINGS SEED
-- Adds real-looking open service requests across all 12 categories
-- so the customer and provider apps have data to display.
-- All rows tagged is_demo = TRUE — controlled by admin Demo Mode toggle.
-- Run in Supabase SQL Editor AFTER migrations and demo user seed.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Customer UUIDs (from seed-demo.sql)
  v_c1  UUID := 'dd000000-0000-0000-0000-000000000001'; -- Priya Krishnan
  v_c2  UUID := 'dd000000-0000-0000-0000-000000000002'; -- Arun Selvam
  v_c3  UUID := 'dd000000-0000-0000-0000-000000000003'; -- Meena Rajan
  v_c4  UUID := 'dd000000-0000-0000-0000-000000000004'; -- Senthil Murugan
  v_c5  UUID := 'dd000000-0000-0000-0000-000000000005'; -- Kavitha Anand
  v_c6  UUID := 'dd000000-0000-0000-0000-000000000006'; -- Deepa Natarajan

  -- Category UUIDs
  v_cat_pl  UUID := 'f0000000-0000-0000-0000-000000000001'; -- Plumbing
  v_cat_el  UUID := 'f0000000-0000-0000-0000-000000000002'; -- Electrical
  v_cat_cl  UUID := 'f0000000-0000-0000-0000-000000000003'; -- Deep Cleaning
  v_cat_ap  UUID := 'f0000000-0000-0000-0000-000000000004'; -- Appliance Repair
  v_cat_cp  UUID := 'f0000000-0000-0000-0000-000000000005'; -- Carpentry
  v_cat_pa  UUID := 'f0000000-0000-0000-0000-000000000006'; -- Painting
  v_cat_ac  UUID := 'f0000000-0000-0000-0000-000000000007'; -- AC Servicing
  v_cat_pc  UUID := 'f0000000-0000-0000-0000-000000000008'; -- Pest Control
  v_cat_cc  UUID := 'f0000000-0000-0000-0000-000000000009'; -- CCTV
  v_cat_gd  UUID := 'f0000000-0000-0000-0000-000000000010'; -- Gardening
  v_cat_mv  UUID := 'f0000000-0000-0000-0000-000000000011'; -- Movers
  v_cat_in  UUID := 'f0000000-0000-0000-0000-000000000012'; -- Interior

  -- Area UUIDs
  v_rs  UUID := 'e0000000-0000-0000-0000-000000000001'; -- RS Puram
  v_gp  UUID := 'e0000000-0000-0000-0000-000000000002'; -- Gandhipuram
  v_pm  UUID := 'e0000000-0000-0000-0000-000000000003'; -- Peelamedu
  v_sc  UUID := 'e0000000-0000-0000-0000-000000000004'; -- Saibaba Colony
  v_sn  UUID := 'e0000000-0000-0000-0000-000000000005'; -- Saravanampatti
  v_sg  UUID := 'e0000000-0000-0000-0000-000000000007'; -- Singanallur
  v_ga  UUID := 'e0000000-0000-0000-0000-000000000012'; -- Ganapathy
  v_rc  UUID := 'e0000000-0000-0000-0000-000000000014'; -- Race Course

  v_now TIMESTAMPTZ := now();

BEGIN

-- ─── PLUMBING (4 listings) ────────────────────────────────────────────────
INSERT INTO public.service_requests
  (id, customer_id, type, category_id, area_id, title, description,
   offered_price, min_price, preferred_start, status, provider_preference,
   images, is_demo, created_at)
VALUES
  ('ls000001-0000-0000-0000-000000000001', v_c1, 'ordinary', v_cat_pl, v_rs,
   'Bathroom tap leaking at the base',
   'My bathroom tap has been dripping from the base for 3 days. Tried tightening but water keeps coming. Need a plumber to replace the washer or the tap itself.',
   650, 550, v_now + INTERVAL '3 days 10 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '1 day'),

  ('ls000001-0000-0000-0000-000000000002', v_c2, 'ordinary', v_cat_pl, v_gp,
   'Kitchen sink blocked — slow drain',
   'Kitchen sink is draining very slowly. Tried a plunger and drain cleaner, did not help. Must be a deep blockage. Please bring your own tools.',
   700, 600, v_now + INTERVAL '4 days 9 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '2 days'),

  ('ls000001-0000-0000-0000-000000000003', v_c4, 'ordinary', v_cat_pl, v_ga,
   'Overhead tank ball valve broken',
   'The float valve in overhead tank is stuck open — water keeps running and overflowing. Urgently need repair.',
   800, 700, v_now + INTERVAL '2 days 11 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '3 hours'),

  ('ls000001-0000-0000-0000-000000000004', v_c3, 'ordinary', v_cat_pl, v_pm,
   'New shower installation in bathroom',
   'Old shower head removed. Need new overhead rain shower fitted with arm and flange. I have the shower unit already purchased.',
   900, 800, v_now + INTERVAL '5 days 10 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '5 hours'),

-- ─── ELECTRICAL (4 listings) ──────────────────────────────────────────────
  ('ls000002-0000-0000-0000-000000000001', v_c5, 'ordinary', v_cat_el, v_sn,
   'Switchboard replacement — 6-way modular',
   'Old wooden switchboard in hall needs to be replaced with a new modular 6-way board. Wiring seems fine. Just the board and switches needed.',
   550, 450, v_now + INTERVAL '3 days 11 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '6 hours'),

  ('ls000002-0000-0000-0000-000000000002', v_c6, 'ordinary', v_cat_el, v_sg,
   'Ceiling fan installation in bedroom',
   'Need a new ceiling fan installed. I have the fan and rod. Just need an electrician to do the wiring and balancing. Ceiling hook already in place.',
   400, 350, v_now + INTERVAL '4 days 9 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '8 hours'),

  ('ls000002-0000-0000-0000-000000000003', v_c1, 'ordinary', v_cat_el, v_rs,
   'MCB keeps tripping — needs inspection',
   'Main MCB trips every time heavy appliances like AC and geyser run together. Need an electrician to check load, rewire if needed, and suggest a fix.',
   1200, 1000, v_now + INTERVAL '6 days 10 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '4 hours'),

  ('ls000002-0000-0000-0000-000000000004', v_c2, 'ordinary', v_cat_el, v_gp,
   'Power socket for new AC — 15A dedicated line',
   'Getting a new 1.5-ton split AC. Need a separate 15A socket and dedicated wire run from the distribution box (approx 8 metres).',
   1500, 1200, v_now + INTERVAL '7 days 9 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '1 day'),

-- ─── DEEP HOME CLEANING (3 listings) ─────────────────────────────────────
  ('ls000003-0000-0000-0000-000000000001', v_c3, 'ordinary', v_cat_cl, v_pm,
   'Full 2BHK deep cleaning before house warming',
   'Moving into a newly built flat. Need thorough cleaning of floors, bathrooms, kitchen (chimney, shelves), windows inside and balcony. Approx 950 sqft.',
   2500, 2000, v_now + INTERVAL '5 days 8 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '2 days'),

  ('ls000003-0000-0000-0000-000000000002', v_c4, 'ordinary', v_cat_cl, v_sc,
   'Sofa and carpet shampooing — 3-seater + 5x8 rug',
   'My sofa and carpet need deep shampooing. There are stains from a child spill. Sofa is a 3-seater fabric type. Carpet is 5×8 ft woollen.',
   1200, 1000, v_now + INTERVAL '4 days 10 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '3 hours'),

  ('ls000003-0000-0000-0000-000000000003', v_c5, 'ordinary', v_cat_cl, v_sn,
   'Post-renovation dust cleaning — 3BHK',
   'Renovation just finished. Cement dust, paint spots, and debris everywhere. Need complete post-construction cleaning for a 3BHK flat (1300 sqft).',
   3500, 3000, v_now + INTERVAL '3 days 8 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '5 hours'),

-- ─── APPLIANCE REPAIR (3 listings) ───────────────────────────────────────
  ('ls000004-0000-0000-0000-000000000001', v_c6, 'ordinary', v_cat_ap, v_sg,
   'Washing machine not spinning — LG front-load',
   'LG front-load washing machine stops after the wash cycle and does not spin. Error code E9. Machine is 4 years old.',
   900, 750, v_now + INTERVAL '3 days 10 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '1 day'),

  ('ls000004-0000-0000-0000-000000000002', v_c1, 'ordinary', v_cat_ap, v_rs,
   'Refrigerator not cooling — Samsung 300L',
   'Samsung double-door fridge is running but not cooling. Freezer section fine but fridge compartment stays warm. Might be gas issue.',
   1100, 900, v_now + INTERVAL '2 days 9 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '6 hours'),

  ('ls000004-0000-0000-0000-000000000003', v_c2, 'ordinary', v_cat_ap, v_gp,
   'Microwave display working but not heating',
   'Microwave turns on, timer runs, but food does not heat at all. Might be a magnetron issue. Brand: IFB. Model 5 years old.',
   800, 650, v_now + INTERVAL '4 days 11 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '2 hours'),

-- ─── CARPENTRY (3 listings) ───────────────────────────────────────────────
  ('ls000005-0000-0000-0000-000000000001', v_c3, 'ordinary', v_cat_cp, v_pm,
   'Wardrobe door hinge and track repair',
   'Sliding wardrobe door has come off track. Bottom roller broken. Need carpenter to replace rollers and realign both doors.',
   600, 500, v_now + INTERVAL '3 days 14 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '4 hours'),

  ('ls000005-0000-0000-0000-000000000002', v_c5, 'ordinary', v_cat_cp, v_sn,
   'Flat-pack bookshelf assembly — IKEA Billy',
   'IKEA Billy bookshelf (4 units) need to be assembled and wall-anchored for safety. I have all the boxes and hardware.',
   700, 600, v_now + INTERVAL '5 days 10 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '1 day'),

  ('ls000005-0000-0000-0000-000000000003', v_c4, 'ordinary', v_cat_cp, v_ga,
   'Main door lock replacement — mortise lock',
   'Main door lock is jammed and key turns but does not open properly. Need mortise lock replaced. Door is 4 years old teak.',
   550, 450, v_now + INTERVAL '2 days 10 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '3 hours'),

-- ─── WALL PAINTING (2 listings) ───────────────────────────────────────────
  ('ls000006-0000-0000-0000-000000000001', v_c6, 'ordinary', v_cat_pa, v_rc,
   'Living room wall painting — accent wall',
   'Want one feature wall (approx 12×10 ft) painted in a textured dark colour. I need recommendations on colour and finish. Rest of room stays white.',
   2000, 1600, v_now + INTERVAL '10 days 8 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '1 day'),

  ('ls000006-0000-0000-0000-000000000002', v_c1, 'ordinary', v_cat_pa, v_rs,
   'Bathroom waterproof paint + wall patch',
   'Bathroom wall has damp patches and peeling paint near the shower area. Need waterproofing treatment and fresh paint for approx 80 sqft.',
   1500, 1200, v_now + INTERVAL '7 days 10 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '5 hours'),

-- ─── AC SERVICING (2 listings) ────────────────────────────────────────────
  ('ls000007-0000-0000-0000-000000000001', v_c2, 'ordinary', v_cat_ac, v_gp,
   'AC annual service + gas refill check',
   'Split AC not cooling as well as before. Last serviced 18 months ago. Need full service: filter clean, coil wash, gas level check.',
   950, 800, v_now + INTERVAL '4 days 10 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '8 hours'),

  ('ls000007-0000-0000-0000-000000000002', v_c3, 'ordinary', v_cat_ac, v_pm,
   'AC installation — new 1.5T split unit',
   'Brand new Daikin 1.5 ton split AC needs installation. First floor. Outdoor unit placement on window bracket. Pipe run approx 3 metres. Electrical socket already exists.',
   2500, 2000, v_now + INTERVAL '6 days 9 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '2 days'),

-- ─── PEST CONTROL (2 listings) ────────────────────────────────────────────
  ('ls000008-0000-0000-0000-000000000001', v_c4, 'ordinary', v_cat_pc, v_sc,
   'Cockroach gel treatment — 2BHK',
   'Cockroach problem in kitchen and bathroom. Have tried baits but still recurring. Need professional gel treatment for a 2BHK (800 sqft).',
   850, 700, v_now + INTERVAL '4 days 10 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '1 day'),

  ('ls000008-0000-0000-0000-000000000002', v_c5, 'ordinary', v_cat_pc, v_sn,
   'Termite inspection and treatment',
   'Noticed mud tunnels along living room skirting board. Need a professional termite inspection and treatment if required. 3BHK independent house.',
   1800, 1500, v_now + INTERVAL '8 days 9 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '3 hours'),

-- ─── CCTV & SECURITY (2 listings) ─────────────────────────────────────────
  ('ls000009-0000-0000-0000-000000000001', v_c6, 'ordinary', v_cat_cc, v_rc,
   '4-camera CCTV system installation',
   'Need 4 outdoor IP cameras installed around a ground-floor independent house. Need DVR, 1TB HDD and 30m cable. Supply and installation quote welcome.',
   4000, 3200, v_now + INTERVAL '10 days 10 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '2 days'),

  ('ls000009-0000-0000-0000-000000000002', v_c1, 'ordinary', v_cat_cc, v_rs,
   'Smart video doorbell setup',
   'Need a Eufy video doorbell installed and connected to my home WiFi. Existing wired doorbell in place. Need configuration and app setup help.',
   800, 650, v_now + INTERVAL '5 days 10 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '6 hours'),

-- ─── GARDENING (2 listings) ───────────────────────────────────────────────
  ('ls000010-0000-0000-0000-000000000001', v_c2, 'ordinary', v_cat_gd, v_gp,
   'Terrace garden setup — pots, soil and plants',
   'Want to set up a small terrace garden with about 15 pots. Need help selecting soil mix, arranging pots, and planting a mix of flowering and vegetable plants.',
   1200, 1000, v_now + INTERVAL '7 days 9 hours', 'open', 'either', '{}', TRUE, v_now - INTERVAL '1 day'),

  ('ls000010-0000-0000-0000-000000000002', v_c3, 'ordinary', v_cat_gd, v_pm,
   'Lawn mowing and hedge trimming',
   'Front lawn needs mowing and the hedge on the boundary needs trimming. Approx 30×15 ft lawn and 20 ft of hedge. Monthly service preferred.',
   600, 500, v_now + INTERVAL '3 days 8 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '4 hours'),

-- ─── PACKERS & MOVERS (2 listings) ────────────────────────────────────────
  ('ls000011-0000-0000-0000-000000000001', v_c4, 'ordinary', v_cat_mv, v_ga,
   'Local shifting — 2BHK within Coimbatore',
   'Moving from Ganapathy to RS Puram (approx 5 km). 2BHK household items. Need 2 helpers + small tempo. Date flexible within next 2 weeks.',
   3500, 3000, v_now + INTERVAL '12 days 8 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '2 days'),

  ('ls000011-0000-0000-0000-000000000002', v_c5, 'ordinary', v_cat_mv, v_sn,
   'Heavy furniture shifting within flat',
   'Want to reorganize furniture in a 3BHK — move a double bed, 2 wardrobes and a dining table to different rooms. Need 2 strong helpers for 2 hours.',
   800, 650, v_now + INTERVAL '5 days 10 hours', 'open', 'freelancer', '{}', TRUE, v_now - INTERVAL '5 hours'),

-- ─── INTERIOR DESIGN (2 listings) ─────────────────────────────────────────
  ('ls000012-0000-0000-0000-000000000001', v_c6, 'ordinary', v_cat_in, v_rc,
   'False ceiling + LED lighting design for living room',
   'Want a pop false ceiling with cove lighting in the living room (approx 18×12 ft). Need design suggestion and execution. Looking for elegant minimal style.',
   15000, 12000, v_now + INTERVAL '15 days 9 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '1 day'),

  ('ls000012-0000-0000-0000-000000000002', v_c1, 'ordinary', v_cat_in, v_rs,
   'Modular kitchen design and installation',
   'Need modular kitchen designed and installed in a 9×8 ft kitchen. Parallel layout preferred. Budget is flexible for quality work. Looking for experienced firm.',
   35000, 28000, v_now + INTERVAL '20 days 9 hours', 'open', 'organization', '{}', TRUE, v_now - INTERVAL '3 days')

ON CONFLICT (id) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  is_demo     = TRUE;

RAISE NOTICE 'Sample listings inserted: 30 open service requests across all 12 categories.';
END;
$$;

COMMIT;
