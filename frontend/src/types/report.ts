export type WasteCategory =
  | 'Garbage Overflow'
  | 'Waste Not Collected'
  | 'Illegal Dumping'
  | 'Street Waste'
  | 'Plastic Waste'
  | 'Bad Odour'
  | 'Other';

export type ReportStatus =
  | 'Submitted'
  | 'Assigned'
  | 'Under Review'
  | 'In Progress'
  | 'Resolved'
  | 'Rejected';

export type AIPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CollectionTask {
  id: string;
  task_number: string;
  report_id: string;
  incident_id?: string;
  task_title?: string;
  assigned_vehicle?: string; // stores assigned staff member email/id
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  description?: string;
  department?: string;
  created_at?: string;
  updated_at?: string;
}

export type LifecycleStage =
  | 'SUBMITTED'
  | 'AI_ANALYZED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'RESOLUTION_SUBMITTED'
  | 'RESOLVED';

export interface TimelineEvent {
  stage: string;
  title: string;
  status_label: string;
  state?: 'COMPLETED' | 'CURRENT' | 'PENDING';
  timestamp: string | null;
  description: string;
  completed: boolean;
  active: boolean;
  department?: string | null;
  officer?: string | null;
}

export interface WasteReport {
  id: string | number;
  report_number: number;
  waste_category: WasteCategory;
  description: string;
  photo_url?: string | null;
  photo_signed_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  ward?: string | null;
  status: ReportStatus;
  priority?: AIPriority | string | null;
  ai_category?: string | null;
  ai_priority?: AIPriority | string | null;
  ai_department?: string | null;
  ai_summary?: string | null;
  assigned_staff?: string | null;
  assigned_staff_id?: string | null;
  assigned_staff_name?: string | null;
  assigned_officer?: string | null;
  assigned_department?: string | null;
  assigned_instructions?: string | null;
  assigned_task?: CollectionTask | null;
  task_id?: string | null;
  task_number?: string | null;
  status_message?: string | null;
  last_updated_at?: string | null;
  lifecycle_stage?: LifecycleStage;
  timeline?: TimelineEvent[];
  resolution_notes?: string | null;
  resolution_photo_url?: string | null;
  resolution_photo_signed_url?: string | null;
  resolved_at?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
  citizen_id?: string;
}

export interface WasteReportCreate {
  waste_category: WasteCategory;
  description: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  ward?: string;
}

export interface AIAutomationResult {
  success: boolean;
  decision_source?: string;
  waste_category?: string;
  priority?: string;
  recommended_action?: string;
  assigned_department?: string;
  reason?: string;
  saved_to_supabase?: boolean;
  message?: string;
}

export interface CreateReportResponse {
  success: boolean;
  message?: string;
  report: WasteReport;
  automation_result?: AIAutomationResult;
}

export interface CitizenStats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
}

export interface CitizenReportsResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  stats: CitizenStats;
  reports: WasteReport[];
}

export interface StaffStats {
  total_assigned: number;
  awaiting_action: number;
  in_progress: number;
  completed: number;
}

export interface StaffReportsResponse {
  success: boolean;
  count: number;
  stats: StaffStats;
  reports: WasteReport[];
}

export interface ManagerStats {
  total: number;
  pending: number;
  under_review: number;
  in_progress: number;
  resolved: number;
  high_priority: number;
  assigned_to_staff: number;
}

export interface ManagerReportsResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  stats: ManagerStats;
  reports: WasteReport[];
}

export interface SingleReportResponse {
  success: boolean;
  report: WasteReport;
  tasks?: CollectionTask[];
}
