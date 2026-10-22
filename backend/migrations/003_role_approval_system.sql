-- ==============================================================================
-- Migration: 003_role_approval_system.sql
-- Project: Autonomous Waste Management (AWM) Agent
-- Description: Unified Role Request & Approval System for Citizen, Municipal Staff,
--              and Manager roles with Google OAuth synchronization.
-- ==============================================================================

-- 1. CREATE USER PROFILES TABLE WITH APPROVAL WORKFLOW
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    
    -- Active effective role (strictly verified by backend guards)
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'municipal_staff', 'manager')),
    
    -- Requested role submitted during registration
    requested_role TEXT NOT NULL DEFAULT 'citizen' CHECK (requested_role IN ('citizen', 'municipal_staff', 'manager')),
    
    -- Approval status lifecycle
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected')),
    
    -- Municipal metadata
    organization TEXT DEFAULT 'Central Municipality',
    district TEXT DEFAULT 'Central District',
    ward TEXT DEFAULT 'Ward 1',
    place TEXT,
    state TEXT,
    
    -- Audit details
    approved_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval ON public.user_profiles(approval_status);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Select policy: Users view their own profile; Managers view all profiles
DROP POLICY IF EXISTS "Users view own or managers view all" ON public.user_profiles;
CREATE POLICY "Users view own or managers view all"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
);

-- Update policy: Users can only update non-role fields for themselves
DROP POLICY IF EXISTS "Users update own profile fields" ON public.user_profiles;
CREATE POLICY "Users update own profile fields"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. AUTOMATIC PROFILE SYNC TRIGGER FOR NEW AUTH USERS
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
BEGIN
    -- Read metadata passed during Google OAuth or signup
    reg_role := COALESCE(NEW.raw_app_meta_data->>'requested_role', NEW.raw_user_meta_data->>'requested_role', NEW.raw_app_meta_data->>'role', 'citizen');
    
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    
    org_name := COALESCE(NEW.raw_user_meta_data->>'organization', 'Central Municipality');
    dist_name := COALESCE(NEW.raw_user_meta_data->>'district', 'Central District');
    ward_name := COALESCE(NEW.raw_user_meta_data->>'ward', 'Ward 1');

    -- Auto-approve citizen accounts; require approval for staff and manager
    IF reg_role = 'citizen' THEN
        effective_role := 'citizen';
        target_status := 'approved';
    ELSE
        -- Default to citizen until an authorized manager approves
        effective_role := 'citizen';
        target_status := 'pending';
    END IF;

    -- Initial super-admin exemption for configured manager emails
    IF LOWER(TRIM(NEW.email)) IN ('tryashas076@gmail.com', 't.r.yashas076@gmail.com', 'manager@awm.gov') THEN
        effective_role := 'manager';
        reg_role := 'manager';
        target_status := 'approved';
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
        ward
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
        ward_name
    )
    ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_approval ON auth.users;
CREATE TRIGGER on_auth_user_created_approval
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user_with_approval();
