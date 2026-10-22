-- ==============================================================================
-- Migration: 005_performance_indexes.sql
-- Project: Autonomous Waste Management (AWM) Agent
-- Description: Composite and single-column indexes for fast dashboard retrieval,
--              filtering, sorting, and lifecycle tracking.
-- ==============================================================================

-- 1. Waste Reports Performance Indexes
CREATE INDEX IF NOT EXISTS idx_waste_reports_citizen_id ON public.waste_reports (citizen_id);
CREATE INDEX IF NOT EXISTS idx_waste_reports_status ON public.waste_reports (status);
CREATE INDEX IF NOT EXISTS idx_waste_reports_created_at_desc ON public.waste_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waste_reports_ward ON public.waste_reports (ward);
CREATE INDEX IF NOT EXISTS idx_waste_reports_ai_priority ON public.waste_reports (ai_priority);
CREATE INDEX IF NOT EXISTS idx_waste_reports_report_number ON public.waste_reports (report_number);
CREATE INDEX IF NOT EXISTS idx_waste_reports_citizen_status ON public.waste_reports (citizen_id, status);

-- 2. Collection Tasks Performance Indexes
CREATE INDEX IF NOT EXISTS idx_collection_tasks_report_id ON public.collection_tasks (report_id);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_assigned_vehicle ON public.collection_tasks (assigned_vehicle);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_status ON public.collection_tasks (status);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_vehicle_status ON public.collection_tasks (assigned_vehicle, status);
