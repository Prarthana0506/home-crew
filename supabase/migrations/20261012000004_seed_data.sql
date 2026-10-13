-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 4: SEED DATA
-- Business settings, Coimbatore areas with PostGIS, 12 categories, demo users
-- ============================================================================

-- 1. SEED SETTINGS (Every business rule number from the master context)
INSERT INTO public.settings (key, value, description)
VALUES
    ('emergency_multiplier', '{"value": 1.3}'::jsonb, 'Price multiplier for emergency dispatch jobs (+30%)'),
    ('emergency_fee', '{"value": 50.0}'::jsonb, 'Platform emergency dispatch fee in Rupees'),
    ('min_gap_hours', '{"value": 8.0}'::jsonb, 'Mandatory gap between consecutive jobs on provider calendar'),
    ('bidding_min_rating', '{"value": 3.5}'::jsonb, 'Minimum average customer rating required for emergency bidding'),
    ('bidding_min_reviews', '{"value": 3}'::jsonb, 'Minimum completed review count required for emergency bidding'),
    ('bidding_min_coins', '{"value": 35}'::jsonb, 'Minimum coin balance required for emergency bidding'),
    ('emergency_radius_tier_1_km', '{"value": 13.0}'::jsonb, 'Initial search radius for emergency technician notifications in km'),
    ('emergency_radius_tier_2_km', '{"value": 20.0}'::jsonb, 'Secondary widened search radius in km'),
    ('emergency_radius_tier_3_km', '{"value": 30.0}'::jsonb, 'Tertiary widest search radius in km before escalation'),
    ('emergency_min_lead_hours', '{"value": 2.0}'::jsonb, 'Minimum lead time required when booking emergency service'),
    ('bidding_open_wait_minutes', '{"value": 45}'::jsonb, 'Maximum minutes to wait for 10 interested bidders before opening auction'),
    ('bidding_close_cutoff_hours', '{"value": 1.0}'::jsonb, 'Auction must close at least this many hours prior to job start'),
    ('bidding_max_interested', '{"value": 10}'::jsonb, 'Maximum number of interested providers allowed into bidding room'),
    ('withdraw_penalty_coin_pct', '{"value": 50}'::jsonb, 'Percentage of winning bid coins forfeited on withdrawal or no-show'),
    ('withdraw_penalty_rating', '{"value": 0.1}'::jsonb, 'Rating points deducted on provider withdrawal or no-show'),
    ('withdraw_ban_days', '{"value": 3}'::jsonb, 'Days suspended from emergency bidding room on withdrawal'),
    ('auto_complete_provider_hours', '{"value": 48}'::jsonb, 'Hours after provider completion before job auto-completes if customer silent'),
    ('auto_complete_customer_hours', '{"value": 24}'::jsonb, 'Hours after customer completion before job auto-completes if provider silent'),
    ('review_open_delay_minutes', '{"value": 30}'::jsonb, 'Minutes after mutual completion before compulsory review screen opens'),
    ('review_blind_window_days', '{"value": 7}'::jsonb, 'Days reviews remain blind until both submit or window expires'),
    ('completion_base_coins', '{"value": 20}'::jsonb, 'Base coins rewarded to provider upon successful job completion'),
    ('star_bonus_1', '{"value": 0}'::jsonb, 'Bonus coins for 1-star customer rating'),
    ('star_bonus_2', '{"value": 1}'::jsonb, 'Bonus coins for 2-star customer rating'),
    ('star_bonus_3', '{"value": 2}'::jsonb, 'Bonus coins for 3-star customer rating'),
    ('star_bonus_4', '{"value": 3}'::jsonb, 'Bonus coins for 4-star customer rating'),
    ('star_bonus_5', '{"value": 5}'::jsonb, 'Bonus coins for 5-star customer rating'),
    ('chat_retention_days', '{"value": 7}'::jsonb, 'Days chat remains accessible in read-only mode after completion'),
    ('ordinary_start_time_earliest', '{"value": "08:00:00"}'::jsonb, 'Earliest allowable start time for ordinary home services'),
    ('ordinary_start_time_latest', '{"value": "19:00:00"}'::jsonb, 'Latest allowable start time for ordinary home services'),
    ('ordinary_advance_min_days', '{"value": 2}'::jsonb, 'Minimum days in advance ordinary jobs must be scheduled'),
    ('ordinary_advance_max_days', '{"value": 30}'::jsonb, 'Maximum days in advance ordinary jobs can be scheduled')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- 2. SEED COIMBATORE AREAS WITH POSTGIS COORDINATES
INSERT INTO public.areas (id, name, pincode, latitude, longitude, location)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'RS Puram', '641002', 11.0088000, 76.9500000, ST_SetSRID(ST_MakePoint(76.9500000, 11.0088000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000002', 'Gandhipuram', '641012', 11.0176000, 76.9674000, ST_SetSRID(ST_MakePoint(76.9674000, 11.0176000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000003', 'Peelamedu', '641004', 11.0264000, 77.0125000, ST_SetSRID(ST_MakePoint(77.0125000, 11.0264000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000004', 'Saibaba Colony', '641011', 11.0315000, 76.9452000, ST_SetSRID(ST_MakePoint(76.9452000, 11.0315000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000005', 'Saravanampatti', '641035', 11.0797000, 76.9997000, ST_SetSRID(ST_MakePoint(76.9997000, 11.0797000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000006', 'Ramanathapuram', '641045', 10.9942000, 76.9856000, ST_SetSRID(ST_MakePoint(76.9856000, 10.9942000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000007', 'Singanallur', '641005', 10.9992000, 77.0263000, ST_SetSRID(ST_MakePoint(77.0263000, 10.9992000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000008', 'Hopes College', '641004', 11.0287000, 77.0028000, ST_SetSRID(ST_MakePoint(77.0028000, 11.0287000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000009', 'Vadavalli', '641041', 11.0183000, 76.9022000, ST_SetSRID(ST_MakePoint(76.9022000, 11.0183000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000010', 'Kovaipudur', '641042', 10.9392000, 76.9461000, ST_SetSRID(ST_MakePoint(76.9461000, 10.9392000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000011', 'Thudiyalur', '641034', 11.0805000, 76.9389000, ST_SetSRID(ST_MakePoint(76.9389000, 11.0805000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000012', 'Ganapathy', '641006', 11.0378000, 76.9744000, ST_SetSRID(ST_MakePoint(76.9744000, 11.0378000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000013', 'Town Hall', '641001', 10.9967000, 76.9628000, ST_SetSRID(ST_MakePoint(76.9628000, 10.9967000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000014', 'Race Course', '641018', 11.0028000, 76.9742000, ST_SetSRID(ST_MakePoint(76.9742000, 11.0028000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000015', 'Kuniyamuthur', '641008', 10.9634000, 76.9547000, ST_SetSRID(ST_MakePoint(76.9547000, 10.9634000), 4326)::geography),
    ('e0000000-0000-0000-0000-000000000016', 'Ondipudur', '641016', 10.9947000, 77.0503000, ST_SetSRID(ST_MakePoint(77.0503000, 10.9947000), 4326)::geography)
ON CONFLICT (name) DO UPDATE
SET pincode = EXCLUDED.pincode,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    location = EXCLUDED.location;

-- 3. SEED THE 12 SERVICE CATEGORIES WITH BASE PRICES FROM OLD DB.TS
INSERT INTO public.service_categories (id, slug, name, name_ta, base_price, icon, default_image, description)
VALUES
    (
        'f0000000-0000-0000-0000-000000000001',
        'cat_plumbing',
        'Plumbing & Water Systems',
        'குழாய் மற்றும் நீர் அமைப்புகள்',
        500,
        'Wrench',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''130'' y=''30'' width=''40'' height=''110'' fill=''%231b4f59'' rx=''4''/%3E%3Crect x=''90'' y=''70'' width=''120'' height=''25'' fill=''%23e29b38'' rx=''4''/%3E%3Ccircle cx=''150'' cy=''82'' r=''10'' fill=''%23d94e38''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Plumbing%3C/text%3E%3C/svg%3E',
        'Leakage repairs, pipe installations, tap fixes and bathroom fittings'
    ),
    (
        'f0000000-0000-0000-0000-000000000002',
        'cat_electrical',
        'Electrical & Wiring',
        'மின்சாரம் மற்றும் வயரிங்',
        600,
        'Zap',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Ccircle cx=''150'' cy=''85'' r=''45'' fill=''%23e29b38''/%3E%3Cpolygon points=''150,55 130,95 155,95 145,120 175,80 150,80'' fill=''%23d94e38''/%3E%3Crect x=''135'' y=''130'' width=''30'' height=''15'' fill=''%231b4f59''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Electrical%3C/text%3E%3C/svg%3E',
        'Short circuit emergency, socket replacement, fuse box and MCB setup'
    ),
    (
        'f0000000-0000-0000-0000-000000000003',
        'cat_cleaning',
        'Deep Home Cleaning',
        'வீட்டு ஆழமான துப்புரவு',
        1200,
        'Sparkles',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''100'' y=''60'' width=''50'' height=''70'' fill=''%231b4f59'' rx=''4''/%3E%3Cpath d=''M170 40 L195 130 L160 130 Z'' fill=''%23e29b38''/%3E%3Ccircle cx=''210'' cy=''70'' r=''12'' fill=''%23e29b38''/%3E%3Ccircle cx=''225'' cy=''50'' r=''8'' fill=''%23d94e38''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Deep Cleaning%3C/text%3E%3C/svg%3E',
        'Kitchen deep sanitization, sofa shampooing, full apartment restoration'
    ),
    (
        'f0000000-0000-0000-0000-000000000004',
        'cat_appliance',
        'Appliance Repair',
        'வீட்டு உபகரணங்கள் பழுது',
        800,
        'Tv',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''105'' y=''35'' width=''90'' height=''120'' fill=''%231b4f59'' rx=''6''/%3E%3Ccircle cx=''150'' cy=''95'' r=''28'' fill=''%23e29b38''/%3E%3Ccircle cx=''150'' cy=''95'' r=''18'' fill=''%23fbf5e9''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Appliance%3C/text%3E%3C/svg%3E',
        'AC servicing, refrigerator cooling fix, washing machine diagnosis'
    ),
    (
        'f0000000-0000-0000-0000-000000000005',
        'cat_carpentry',
        'Carpentry & Furniture',
        'தச்சு மற்றும் தளபாடங்கள்',
        550,
        'Hammer',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''70'' y=''75'' width=''160'' height=''20'' fill=''%23e29b38'' rx=''2''/%3E%3Crect x=''85'' y=''95'' width=''16'' height=''55'' fill=''%23e29b38''/%3E%3Crect x=''195'' y=''95'' width=''16'' height=''55'' fill=''%23e29b38''/%3E%3Crect x=''140'' y=''35'' width=''14'' height=''40'' fill=''%231b4f59''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Carpentry%3C/text%3E%3C/svg%3E',
        'Door lock replacement, modular cabinet assembly and chair restoration'
    ),
    (
        'f0000000-0000-0000-0000-000000000006',
        'cat_painting',
        'Wall Painting & Touchup',
        'சுவர் ஓவியம் மற்றும் நீர்ப்புகாப்பு',
        1500,
        'Paintbrush',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''110'' y=''40'' width=''80'' height=''35'' fill=''%23d94e38'' rx=''4''/%3E%3Crect x=''145'' y=''75'' width=''10'' height=''70'' fill=''%231b4f59''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Painting%3C/text%3E%3C/svg%3E',
        'Waterproof patch treatment, texture wall paint and interior coating'
    ),
    (
        'f0000000-0000-0000-0000-000000000007',
        'cat_ac_service',
        'AC Servicing & Gas Refill',
        'ஏசி சேவை மற்றும் எரிவாயு நிரப்புதல்',
        900,
        'Wind',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''70'' y=''50'' width=''160'' height=''60'' fill=''%231b4f59'' rx=''4''/%3E%3Cline x1=''85'' y1=''85'' x2=''215'' y2=''85'' stroke=''%23fbf5e9'' stroke-width=''3''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: AC Servicing%3C/text%3E%3C/svg%3E',
        'Filter cleaning, refrigerant top-up, compressor inspection and jet wash'
    ),
    (
        'f0000000-0000-0000-0000-000000000008',
        'cat_pest_control',
        'Pest Control & Sanitization',
        'பூச்சி கட்டுப்பாடு மற்றும் சுத்திகரிப்பு',
        850,
        'ShieldAlert',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Ccircle cx=''150'' cy=''85'' r=''30'' fill=''%23d94e38''/%3E%3Cline x1=''125'' y1=''85'' x2=''100'' y2=''75'' stroke=''%231b4f59'' stroke-width=''3''/%3E%3Cline x1=''175'' y1=''85'' x2=''200'' y2=''75'' stroke=''%231b4f59'' stroke-width=''3''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Pest Control%3C/text%3E%3C/svg%3E',
        'Termite protection, cockroach gel treatment, mosquito and rodent control'
    ),
    (
        'f0000000-0000-0000-0000-000000000009',
        'cat_cctv',
        'CCTV & Smart Home Security',
        'சிசிடிவி மற்றும் ஸ்மார்ட் ஹோம் பாதுகாப்பு',
        1100,
        'Camera',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''110'' y=''70'' width=''80'' height=''55'' fill=''%231b4f59'' rx=''6''/%3E%3Ccircle cx=''150'' cy=''97'' r=''18'' fill=''%23e29b38''/%3E%3Ccircle cx=''150'' cy=''97'' r=''8'' fill=''%23d94e38''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: CCTV Security%3C/text%3E%3C/svg%3E',
        'IP camera setup, DVR configuration, smart lock installation and wiring'
    ),
    (
        'f0000000-0000-0000-0000-000000000010',
        'cat_gardening',
        'Gardening & Lawn Care',
        'தோட்டக்கலை மற்றும் புல்வெளி பராமரிப்பு',
        450,
        'Flower2',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Ccircle cx=''150'' cy=''80'' r=''35'' fill=''%231b4f59''/%3E%3Crect x=''145'' y=''100'' width=''10'' height=''50'' fill=''%23e29b38'' rx=''2''/%3E%3Ccircle cx=''150'' cy=''80'' r=''12'' fill=''%23d94e38''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Gardening%3C/text%3E%3C/svg%3E',
        'Lawn mowing, plant trimming, organic soil fertilizing and pot maintenance'
    ),
    (
        'f0000000-0000-0000-0000-000000000011',
        'cat_movers',
        'Packers & Furniture Helpers',
        'பேக்கர்ஸ் மற்றும் தளபாடங்கள் உதவியாளர்கள்',
        1600,
        'Truck',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''80'' y=''60'' width=''100'' height=''65'' fill=''%231b4f59'' rx=''4''/%3E%3Crect x=''180'' y=''80'' width=''45'' height=''45'' fill=''%23e29b38'' rx=''4''/%3E%3Ccircle cx=''110'' cy=''135'' r=''14'' fill=''%23d94e38''/%3E%3Ccircle cx=''200'' cy=''135'' r=''14'' fill=''%23d94e38''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Packers & Helpers%3C/text%3E%3C/svg%3E',
        'Heavy furniture shifting, bubble packing, loading and unloading support'
    ),
    (
        'f0000000-0000-0000-0000-000000000012',
        'cat_interior',
        'Interior Design & Renovation',
        'உட்புற வடிவமைப்பு மற்றும் புதுப்பித்தல்',
        2000,
        'Layout',
        'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 300 200''%3E%3Crect width=''300'' height=''200'' fill=''%23fbf5e9''/%3E%3Crect x=''90'' y=''50'' width=''120'' height=''90'' fill=''%231b4f59'' rx=''4''/%3E%3Cline x1=''90'' y1=''95'' x2=''210'' y2=''95'' stroke=''%23fbf5e9'' stroke-width=''3''/%3E%3Cline x1=''150'' y1=''50'' x2=''150'' y2=''140'' stroke=''%23fbf5e9'' stroke-width=''3''/%3E%3Ccircle cx=''120'' cy=''72'' r=''8'' fill=''%23e29b38''/%3E%3Ccircle cx=''180'' cy=''118'' r=''8'' fill=''%23d94e38''/%3E%3Ctext x=''150'' y=''180'' font-family=''sans-serif'' font-weight=''700'' font-size=''13'' fill=''%231b4f59'' text-anchor=''middle''%3ESample image: Interior Renovation%3C/text%3E%3C/svg%3E',
        '3D layout design, false ceiling setup, kitchen modeling and tile replacement'
    )
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    name_ta = EXCLUDED.name_ta,
    base_price = EXCLUDED.base_price,
    icon = EXCLUDED.icon,
    default_image = EXCLUDED.default_image,
    description = EXCLUDED.description;

-- 4. SEED DEMO USERS IN AUTH.USERS AND PROFILES
-- (2 Customers, 4 Freelancers, 1 Organization with 2 Technicians, 1 Admin)

DO $$
BEGIN
    -- Only seed auth.users if auth schema exists (standard Supabase environment)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN

        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES
            -- 2 Customers
            ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aarav@urbanclap.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"customer"}'::jsonb, '{"name":"Aarav Sharma"}'::jsonb, now(), now()),
            ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya@urbanclap.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"customer"}'::jsonb, '{"name":"Priya Verma"}'::jsonb, now(), now()),

            -- 4 Freelancers
            ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vikram@craftsman.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"provider"}'::jsonb, '{"name":"Vikram Singh"}'::jsonb, now(), now()),
            ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'suresh@plumbing.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"provider"}'::jsonb, '{"name":"Suresh Pro"}'::jsonb, now(), now()),
            ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rohan@handy.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"provider"}'::jsonb, '{"name":"Rohan Newbie"}'::jsonb, now(), now()),
            ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'karthik@cleaning.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"provider"}'::jsonb, '{"name":"Karthik Selvan"}'::jsonb, now(), now()),

            -- 1 Organization Owner + 2 Technicians
            ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rajesh@quickfix.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"both"}'::jsonb, '{"name":"Rajesh QuickFix Services"}'::jsonb, now(), now()),
            ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kavita@quickfix.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"provider"}'::jsonb, '{"name":"Kavita Rao"}'::jsonb, now(), now()),
            ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sunil@quickfix.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"provider"}'::jsonb, '{"name":"Sunil Kumar"}'::jsonb, now(), now()),

            -- 1 Admin
            ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@urbanclap.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb, '{"name":"UrbanClap Ops Admin"}'::jsonb, now(), now())
        ON CONFLICT (id) DO NOTHING;

    END IF;
END $$;

-- 5. SEED PROFILES
INSERT INTO public.profiles (id, role, name, phone, phone_demo_verified, language, area_id, avatar, status, address_confidential)
VALUES
    -- 2 Customers
    ('a0000000-0000-0000-0000-000000000001', 'customer', 'Aarav Sharma', '+91 98765 43210', true, 'en', 'e0000000-0000-0000-0000-000000000001', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%231b4f59''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '42, West Sambandam Road, RS Puram, Coimbatore'),
    ('a0000000-0000-0000-0000-000000000002', 'customer', 'Priya Verma', '+91 99887 76655', true, 'en', 'e0000000-0000-0000-0000-000000000003', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%231b4f59''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '18, Avinashi Road, Peelamedu, Coimbatore'),

    -- 4 Freelancers
    ('b0000000-0000-0000-0000-000000000001', 'provider', 'Vikram Singh (Master Electrician)', '+91 98451 11223', true, 'en', 'e0000000-0000-0000-0000-000000000002', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%23d94e38''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '12, Cross Cut Road, Gandhipuram, Coimbatore'),
    ('b0000000-0000-0000-0000-000000000002', 'provider', 'Suresh Pro Plumbers', '+91 98452 22334', true, 'en', 'e0000000-0000-0000-0000-000000000004', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%23d94e38''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '55, NSR Road, Saibaba Colony, Coimbatore'),
    ('b0000000-0000-0000-0000-000000000003', 'provider', 'Rohan Newbie Handy', '+91 98453 33445', true, 'en', 'e0000000-0000-0000-0000-000000000002', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%23d94e38''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '88, 7th Street, Gandhipuram, Coimbatore'),
    ('b0000000-0000-0000-0000-000000000004', 'provider', 'Karthik Selvan Cleaning', '+91 98454 44556', true, 'en', 'e0000000-0000-0000-0000-000000000005', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%23d94e38''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '104, Sathy Road, Saravanampatti, Coimbatore'),

    -- 1 Organization Owner + 2 Technicians
    ('c0000000-0000-0000-0000-000000000001', 'both', 'Rajesh QuickFix Services', '+91 98455 55667', true, 'en', 'e0000000-0000-0000-0000-000000000001', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%23d94e38''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '15, DB Road, RS Puram, Coimbatore'),
    ('c0000000-0000-0000-0000-000000000002', 'provider', 'Kavita Rao', '+91 98451 23456', true, 'en', 'e0000000-0000-0000-0000-000000000001', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%23d94e38''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '15, DB Road, RS Puram, Coimbatore'),
    ('c0000000-0000-0000-0000-000000000003', 'provider', 'Sunil Kumar', '+91 97412 89012', true, 'en', 'e0000000-0000-0000-0000-000000000001', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%23d94e38''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', '15, DB Road, RS Puram, Coimbatore'),

    -- 1 Admin
    ('d0000000-0000-0000-0000-000000000001', 'admin', 'UrbanClap Ops Admin', '+91 99000 00000', true, 'en', 'e0000000-0000-0000-0000-000000000014', 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 40 40''%3E%3Crect width=''40'' height=''40'' fill=''%231b4f59''/%3E%3Ccircle cx=''20'' cy=''15'' r=''7'' fill=''%23fbf5e9''/%3E%3Cpath d=''M8 35 C8 26 14 24 20 24 C26 24 32 26 32 35 Z'' fill=''%23fbf5e9''/%3E%3C/svg%3E', 'active', 'Headquarters, Race Course Road, Coimbatore')
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    area_id = EXCLUDED.area_id,
    address_confidential = EXCLUDED.address_confidential;

-- 6. SEED ORGANIZATIONS
INSERT INTO public.organizations (id, name, owner_id, business_type, gst_number, contact_phone, contact_email, address, area_id)
VALUES
    ('o0000000-0000-0000-0000-000000000001', 'Rajesh QuickFix Services Pvt Ltd', 'c0000000-0000-0000-0000-000000000001', 'Private Limited', '33AABCR1234F1Z5', '+91 98455 55667', 'rajesh@quickfix.com', '15, DB Road, RS Puram, Coimbatore', 'e0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    gst_number = EXCLUDED.gst_number;

-- 7. SEED PROVIDER PROFILES
-- Freelancers, Org Owner, and Technicians
INSERT INTO public.provider_profiles (id, user_id, organization_id, provider_type, skills, categories, experience, rating_avg, review_count, status, verified_id_hash, id_proof_url)
VALUES
    -- Vikram (Eligible for emergency bidding, high rating and reviews)
    ('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', NULL, 'freelancer', ARRAY['Switchboard Repair', 'MCB Replacement', 'Inverter Wiring'], ARRAY['cat_electrical'], 8, 4.80, 18, 'active', encode(digest('Aadhaar:9876-1234-5678', 'sha256'), 'hex'), 'secure/proofs/vikram_id.png'),

    -- Suresh (Eligible for emergency bidding, good rating)
    ('p0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', NULL, 'freelancer', ARRAY['Pipe Fitting', 'Tap Repair', 'Flush Valve Fixing'], ARRAY['cat_plumbing'], 6, 4.50, 12, 'active', encode(digest('Aadhaar:8765-2345-6789', 'sha256'), 'hex'), 'secure/proofs/suresh_id.png'),

    -- Rohan (Newbie, rating 3.2, 0 coins start)
    ('p0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', NULL, 'freelancer', ARRAY['Basic Cleaning', 'Balcony Wash'], ARRAY['cat_cleaning'], 1, 3.20, 2, 'active', encode(digest('Aadhaar:7654-3456-7890', 'sha256'), 'hex'), 'secure/proofs/rohan_id.png'),

    -- Karthik (New provider, 0 coins start)
    ('p0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', NULL, 'freelancer', ARRAY['Washing Machine Repair', 'Refrigerator Diagnosis'], ARRAY['cat_appliance'], 3, 4.00, 4, 'active', encode(digest('Aadhaar:6543-4567-8901', 'sha256'), 'hex'), 'secure/proofs/karthik_id.png'),

    -- Rajesh (Organization Owner)
    ('p0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 'o0000000-0000-0000-0000-000000000001', 'organization_owner', ARRAY['General Contracting', 'Emergency Team Lead'], ARRAY['cat_plumbing', 'cat_electrical', 'cat_appliance'], 12, 4.90, 45, 'active', encode(digest('Aadhaar:5432-5678-9012', 'sha256'), 'hex'), 'secure/proofs/rajesh_id.png'),

    -- Kavita (Technician under Rajesh QuickFix)
    ('p0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 'o0000000-0000-0000-0000-000000000001', 'technician', ARRAY['Switchboard Repair', 'Concealed Wiring'], ARRAY['cat_electrical'], 4, 4.70, 9, 'active', encode(digest('Aadhaar:8492-4810-9301', 'sha256'), 'hex'), 'secure/proofs/kavita_id.png'),

    -- Sunil (Technician under Rajesh QuickFix, pending approval status)
    ('p0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000003', 'o0000000-0000-0000-0000-000000000001', 'technician', ARRAY['Drain Unclogging', 'Water Tank Cleaning'], ARRAY['cat_plumbing'], 3, 0.00, 0, 'pending', encode(digest('Aadhaar:3194-8201-4452', 'sha256'), 'hex'), 'secure/proofs/sunil_id.png')
ON CONFLICT (id) DO UPDATE
SET rating_avg = EXCLUDED.rating_avg,
    review_count = EXCLUDED.review_count,
    status = EXCLUDED.status;

-- 8. SEED COIN LEDGER (COMPLETED HISTORY ROWS SO BID ARENA CAN BE DEMOED)
-- Vikram (+75 coins), Suresh (+45 coins), Rajesh (+50 coins)
-- Rohan (0 coins), Karthik (0 coins), Technicians (0 coins)
INSERT INTO public.coin_ledger (provider_profile_id, amount, reason, created_at)
VALUES
    -- Vikram completed history rows
    ('p0000000-0000-0000-0000-000000000001', 20, 'Job completion base reward: Ceiling Light Wiring', timezone('utc'::text, now() - INTERVAL '10 days')),
    ('p0000000-0000-0000-0000-000000000001', 5, '5-star bonus reward: Ceiling Light Wiring', timezone('utc'::text, now() - INTERVAL '10 days')),
    ('p0000000-0000-0000-0000-000000000001', 20, 'Job completion base reward: Distribution Box Setup', timezone('utc'::text, now() - INTERVAL '6 days')),
    ('p0000000-0000-0000-0000-000000000001', 5, '5-star bonus reward: Distribution Box Setup', timezone('utc'::text, now() - INTERVAL '6 days')),
    ('p0000000-0000-0000-0000-000000000001', 20, 'Job completion base reward: Inverter Wiring Fix', timezone('utc'::text, now() - INTERVAL '2 days')),
    ('p0000000-0000-0000-0000-000000000001', 5, '5-star bonus reward: Inverter Wiring Fix', timezone('utc'::text, now() - INTERVAL '2 days')),

    -- Suresh completed history rows
    ('p0000000-0000-0000-0000-000000000002', 20, 'Job completion base reward: Kitchen Sink Leak Fix', timezone('utc'::text, now() - INTERVAL '8 days')),
    ('p0000000-0000-0000-0000-000000000002', 5, '5-star bonus reward: Kitchen Sink Leak Fix', timezone('utc'::text, now() - INTERVAL '8 days')),
    ('p0000000-0000-0000-0000-000000000002', 20, 'Job completion base reward: Bathroom Tap Replacement', timezone('utc'::text, now() - INTERVAL '3 days')),

    -- Rajesh Organization Owner completed history rows
    ('p0000000-0000-0000-0000-000000000010', 25, 'Organization milestone reward', timezone('utc'::text, now() - INTERVAL '15 days')),
    ('p0000000-0000-0000-0000-000000000010', 25, 'Emergency dispatch performance reward', timezone('utc'::text, now() - INTERVAL '5 days'))
ON CONFLICT DO NOTHING;

-- 9. SEED SAMPLE SERVICE REQUESTS, BIDS, AND BOOKINGS
-- Request 1: Emergency Pipe Burst in Kitchen (Active Bidding Arena)
INSERT INTO public.emergency_fee_payments (id, customer_id, amount, status, fee_version, payment_method, transaction_ref)
VALUES
    ('ef000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 50.0, 'paid', 1, 'UPI', 'UPI-TXN-EMERG-9821')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_requests (
    id, customer_id, type, category_id, area_id, title, description,
    offered_price, min_price, preferred_start, estimated_duration_hours,
    status, provider_preference, fee_payment_id, address_confidential
)
VALUES
    (
        'sr000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'emergency',
        'f0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        'EMERGENCY: Major Pipe Burst in Kitchen Sink',
        'Water leaking rapidly under main sink. Need immediate shutoff and copper pipe replacement today.',
        650, 650,
        timezone('utc'::text, now() + INTERVAL '3 hours'),
        2.0,
        'bidding_active',
        'either',
        'ef000000-0000-0000-0000-000000000001',
        '42, West Sambandam Road, RS Puram, Coimbatore'
    ),
    (
        'sr000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000002',
        'ordinary',
        'f0000000-0000-0000-0000-000000000007',
        'e0000000-0000-0000-0000-000000000003',
        'AC Servicing & Gas Refill for Living Room Split Unit',
        'Annual cooling inspection and jet pump filter cleaning scheduled within standard working hours.',
        900, 900,
        timezone('utc'::text, date_trunc('day', now() + INTERVAL '2 days') + INTERVAL '4 hours 30 minutes'), -- 10:00 AM IST (04:30 UTC)
        2.0,
        'assigned',
        'freelancer',
        NULL,
        '18, Avinashi Road, Peelamedu, Coimbatore'
    )
ON CONFLICT (id) DO NOTHING;

-- Seed Bid Interests and Bids on Emergency Request
INSERT INTO public.bid_interests (request_id, provider_profile_id, status)
VALUES
    ('sr000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 'interested'),
    ('sr000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000010', 'interested')
ON CONFLICT DO NOTHING;

INSERT INTO public.bids (id, request_id, provider_profile_id, coins, status, note)
VALUES
    ('bd000000-0000-0000-0000-000000000001', 'sr000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 36, 'active', 'Can arrive in 25 mins with heavy duty replacement seals.'),
    ('bd000000-0000-0000-0000-000000000002', 'sr000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000010', 38, 'active', 'Emergency team ready with copper welder and backup pump.')
ON CONFLICT (id) DO NOTHING;

-- Seed Booking for Request 2 (AC Service assigned to Vikram)
INSERT INTO public.bookings (id, request_id, provider_profile_id, time_range, status)
VALUES
    (
        'bk000000-0000-0000-0000-000000000001',
        'sr000000-0000-0000-0000-000000000002',
        'p0000000-0000-0000-0000-000000000001',
        tstzrange(
            timezone('utc'::text, date_trunc('day', now() + INTERVAL '2 days') + INTERVAL '4 hours 30 minutes'),
            timezone('utc'::text, date_trunc('day', now() + INTERVAL '2 days') + INTERVAL '6 hours 30 minutes'),
            '[)'
        ),
        'confirmed'
    )
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Messages
INSERT INTO public.messages (request_id, sender_id, content, message_type)
VALUES
    ('sr000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Hello, water is leaking under the cabinet. Should I turn off the main valve?', 'text'),
    ('sr000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Yes, please rotate the brass handle clockwise immediately while we dispatch the technician.', 'text')
ON CONFLICT DO NOTHING;
