-- ==============================================================================
-- Migration: 004_registered_ids_and_designations.sql
-- Project: Autonomous Waste Management (AWM) Agent
-- Description: Extends public.user_profiles with unique registered IDs for
--              approved Municipal Staff (staff_id) and Managers (manager_id),
--              along with designation fields.
-- ==============================================================================

-- 1. ADD NEW COLUMNS TO USER PROFILES (IF TABLE EXISTS)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        ALTER TABLE public.user_profiles
        ADD COLUMN IF NOT EXISTS staff_id TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS manager_id TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS designation TEXT;

        CREATE INDEX IF NOT EXISTS idx_user_profiles_staff_id ON public.user_profiles(staff_id);
        CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id ON public.user_profiles(manager_id);
    END IF;
END $$;

-- 2. UPDATE TRIGGER FUNCTION TO SUPPORT DESIGNATIONS AND UNIQUE IDS
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_with_approval()
RETURNS TRIGGER AS $$
DECLARE
    reg_role TEXT;
    target_status TEXT;
    effective_role TEXT;
    user_name TEXT;
    org_name TEXT;
    dist_name TEXT;
    ward_name TEXT;
    desig_name TEXT;
    assigned_staff_id TEXT;
    assigned_mgr_id TEXT;
BEGIN
    reg_role := COALESCE(NEW.raw_app_meta_data->>'requested_role', NEW.raw_user_meta_data->>'requested_role', NEW.raw_app_meta_data->>'role', 'citizen');
    
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    
    org_name := COALESCE(NEW.raw_user_meta_data->>'organization', 'Central Municipality');
    dist_name := COALESCE(NEW.raw_user_meta_data->>'district', 'Central District');
    ward_name := COALESCE(NEW.raw_user_meta_data->>'ward', 'Ward 1');
    desig_name := COALESCE(NEW.raw_user_meta_data->>'designation', NULL);
    assigned_staff_id := COALESCE(NEW.raw_app_meta_data->>'staff_id', NEW.raw_user_meta_data->>'staff_id', NULL);
    assigned_mgr_id := COALESCE(NEW.raw_app_meta_data->>'manager_id', NEW.raw_user_meta_data->>'manager_id', NULL);

    IF reg_role = 'citizen' THEN
        effective_role := 'citizen';
        target_status := 'approved';
    ELSE
        effective_role := 'citizen';
        target_status := 'pending';
    END IF;

    -- Super-admin exemption for configured manager emails
    IF LOWER(TRIM(NEW.email)) IN ('tryashas076@gmail.com', 't.r.yashas076@gmail.com', 'manager@awm.gov') THEN
        effective_role := 'manager';
        reg_role := 'manager';
        target_status := 'approved';
        IF assigned_mgr_id IS NULL THEN
            assigned_mgr_id := 'MGR-80101';
        END IF;
    END IF;

    INSERT INTO public.user_profiles (
        user_id,
        email,
        full_name,
        role,
        requested_role,
        approval_status,
        organization,
        district,
        ward,
        designation,
        staff_id,
        manager_id
    )
    VALUES (
        NEW.id,
        LOWER(TRIM(NEW.email)),
        user_name,
        effective_role,
        reg_role,
        target_status,
        org_name,
        dist_name,
        ward_name,
        desig_name,
        assigned_staff_id,
        assigned_mgr_id
    )
    ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
        staff_id = COALESCE(public.user_profiles.staff_id, EXCLUDED.staff_id),
        manager_id = COALESCE(public.user_profiles.manager_id, EXCLUDED.manager_id),
        designation = COALESCE(public.user_profiles.designation, EXCLUDED.designation),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
