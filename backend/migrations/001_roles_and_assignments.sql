-- ==============================================================================
-- Migration: 001_roles_and_assignments.sql
-- Project: Autonomous Waste Management (AWM) MVP
-- Description: Architectural documentation and optional direct SQL schema extension
--              for 3-role access control (citizen, municipal_staff, manager)
--              and staff assignment storage.
-- ==============================================================================

-- 1. ROLE-BASED ACCESS CONTROL (RBAC) ARCHITECTURE:
-- In Supabase Auth, user roles are stored directly in `auth.users.app_metadata`:
--   - "citizen": Default for all registered civic users.
--   - "municipal_staff": Field cleansing, sanitation, and collection crews.
--   - "manager": Operations directors with assignment, triage, and role privileges.
-- App metadata is protected by Supabase and cannot be modified by browser users.
-- Only the backend service-role API can assign or promote user roles.

-- 2. REPORT ASSIGNMENTS (COLLECTION_TASKS TABLE):
-- Staff assignments are tracked using the existing `collection_tasks` table:
--   - `report_id`: Foreign key reference to `waste_reports.id`.
--   - `assigned_vehicle`: Stores the assigned staff member's identifier / email.
--   - `task_title`: Stores the staff assignment label (e.g. "Assigned to Marcus Chen").
--   - `department`: Operational department (e.g. "Solid Waste Management").
--   - `status`: Lifecycle dispatch status ("PENDING", "IN_PROGRESS", "COMPLETED").
--   - `description`: Manager dispatch instructions and staff field resolution notes.

-- 3. OPTIONAL SCHEMA EXTENSION (SAFE & REVERSIBLE):
-- If you wish to also store direct assignment references directly on `waste_reports`:

DO $$
BEGIN
    -- Add assigned_staff_id to waste_reports if not already present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'waste_reports'
          AND column_name = 'assigned_staff_id'
    ) THEN
        ALTER TABLE public.waste_reports
        ADD COLUMN assigned_staff_id UUID NULL;
    END IF;

    -- Add assigned_staff_email to waste_reports if not already present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'waste_reports'
          AND column_name = 'assigned_staff_email'
    ) THEN
        ALTER TABLE public.waste_reports
        ADD COLUMN assigned_staff_email TEXT NULL;
    END IF;
END $$;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR CITIZEN ISOLATION:
-- Ensure citizens only query their own reports while staff and managers can access operational data:

ALTER TABLE public.waste_reports ENABLE ROW LEVEL SECURITY;

-- Citizen read policy: Citizens read only their own reports
DROP POLICY IF EXISTS "Citizens can view own reports" ON public.waste_reports;
CREATE POLICY "Citizens can view own reports"
ON public.waste_reports
FOR SELECT
TO authenticated
USING (
    citizen_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('municipal_staff', 'manager', 'admin')
);

-- Citizen insert policy: Citizens can insert their own reports
DROP POLICY IF EXISTS "Citizens can insert reports" ON public.waste_reports;
CREATE POLICY "Citizens can insert reports"
ON public.waste_reports
FOR INSERT
TO authenticated
WITH CHECK (
    citizen_id = auth.uid()
);
