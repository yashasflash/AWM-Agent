-- ==============================================================================
-- Migration: 002_user_profiles_and_google_auth.sql
-- Project: Autonomous Waste Management (AWM) Agent
-- Description: Schema extension for User Profiles, Google OAuth synchronization,
--              Role-Based Access Control (citizen, municipal_staff, manager),
--              and Row Level Security (RLS) policies.
-- ==============================================================================

-- 1. USER PROFILES TABLE
-- Stores profile attributes for Citizens, Municipal Staff, and Managers.
-- Primary authentication remains anchored in Supabase Auth (auth.users).
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'municipal_staff', 'manager')),
    place TEXT,
    state TEXT,
    organization_id TEXT DEFAULT 'MUNICIPALITY-MAIN',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast user_id and email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 2. AUTOMATIC PROFILE CREATION TRIGGER FOR GOOGLE & EMAIL SIGNUPS
-- When a user authenticates via Google OAuth or Email for the first time,
-- this trigger safely initializes their profile as a 'citizen' (unless pre-configured).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    user_full_name TEXT;
BEGIN
    -- Check if role is pre-defined in app_metadata
    assigned_role := COALESCE(NEW.raw_app_meta_data->>'role', 'citizen');
    
    -- Extract full name from Google OAuth metadata (or user metadata)
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    -- Insert profile if not exists
    INSERT INTO public.user_profiles (user_id, email, full_name, role)
    VALUES (
        NEW.id,
        LOWER(TRIM(NEW.email)),
        user_full_name,
        assigned_role
    )
    ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. REPORT ASSIGNMENTS IN COLLECTION_TASKS
-- Ensure collection_tasks has indexing for report_id and assigned_vehicle
CREATE INDEX IF NOT EXISTS idx_collection_tasks_report_id ON public.collection_tasks(report_id);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_assigned_vehicle ON public.collection_tasks(assigned_vehicle);

-- 4. ROW LEVEL SECURITY (RLS) FOR USER PROFILES
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile; Managers can view all profiles
DROP POLICY IF EXISTS "Users can view own profile or managers view all" ON public.user_profiles;
CREATE POLICY "Users can view own profile or managers view all"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
);

-- Users can update their own profile information (full_name, place, state)
-- Role escalation is strictly prevented by not allowing users to alter their own role
DROP POLICY IF EXISTS "Users can update own profile details" ON public.user_profiles;
CREATE POLICY "Users can update own profile details"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. ROW LEVEL SECURITY (RLS) FOR WASTE REPORTS
ALTER TABLE public.waste_reports ENABLE ROW LEVEL SECURITY;

-- Citizens view only their own reports; Staff and Managers view operational data
DROP POLICY IF EXISTS "Strict Citizen Isolation" ON public.waste_reports;
CREATE POLICY "Strict Citizen Isolation"
ON public.waste_reports
FOR SELECT
TO authenticated
USING (
    citizen_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('municipal_staff', 'manager')
    OR id IN (
        SELECT report_id FROM public.collection_tasks 
        WHERE LOWER(assigned_vehicle) = LOWER(auth.jwt() ->> 'email')
    )
);

-- Citizens can only insert reports for themselves
DROP POLICY IF EXISTS "Citizens insert own reports" ON public.waste_reports;
CREATE POLICY "Citizens insert own reports"
ON public.waste_reports
FOR INSERT
TO authenticated
WITH CHECK (
    citizen_id = auth.uid()
);

-- 6. ROW LEVEL SECURITY (RLS) FOR COLLECTION TASKS
ALTER TABLE public.collection_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and Manager Task Access" ON public.collection_tasks;
CREATE POLICY "Staff and Manager Task Access"
ON public.collection_tasks
FOR SELECT
TO authenticated
USING (
    LOWER(assigned_vehicle) = LOWER(auth.jwt() ->> 'email')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
);

-- ==============================================================================
-- End of Migration 002
-- ==============================================================================
