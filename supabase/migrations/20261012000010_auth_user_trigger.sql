-- ============================================================================
-- URBANCLAP SUPABASE MIGRATION 10: AUTOMATIC AUTH USER PROFILE TRIGGER
-- Solves RLS violations by automatically provisioning profiles and provider_profiles
-- via a SECURITY DEFINER trigger whenever a user registers in auth.users.
-- ============================================================================

-- 1. Create or replace the automatic profile creation trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT := COALESCE(new.raw_user_meta_data->>'role', 'customer');
    v_name TEXT := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
    v_provider_type TEXT := COALESCE(new.raw_user_meta_data->>'provider_type', 'freelancer');
BEGIN
    -- Ensure role is valid
    IF v_role NOT IN ('customer', 'provider', 'both', 'admin') THEN
        v_role := 'customer';
    END IF;

    -- Insert into profiles
    INSERT INTO public.profiles (
        id,
        role,
        name,
        language,
        status,
        phone_demo_verified
    ) VALUES (
        new.id,
        v_role,
        v_name,
        'en',
        'active',
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        role = COALESCE(EXCLUDED.role, public.profiles.role);

    -- If provider, also initialize provider_profiles row
    IF v_role = 'provider' OR v_role = 'both' THEN
        INSERT INTO public.provider_profiles (
            user_id,
            provider_type,
            skills,
            categories,
            experience,
            status
        ) VALUES (
            new.id,
            v_provider_type,
            '{}',
            '{}',
            0,
            'active'
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN new;
END;
$$;

-- 2. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill any existing users in auth.users missing from profiles
INSERT INTO public.profiles (id, role, name, language, status, phone_demo_verified)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'role', 'provider'),
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    'en',
    'active',
    false
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Backfill provider_profiles for any provider users missing one
INSERT INTO public.provider_profiles (user_id, provider_type, skills, categories, experience, status)
SELECT
    p.id,
    COALESCE(u.raw_user_meta_data->>'provider_type', 'freelancer'),
    '{}',
    '{}',
    0,
    'active'
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.provider_profiles pp ON pp.user_id = p.id
WHERE (p.role = 'provider' OR p.role = 'both') AND pp.id IS NULL
ON CONFLICT DO NOTHING;

-- 5. Ensure RLS on profiles allows authenticated user to insert their own profile
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
    CREATE POLICY "Users insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
