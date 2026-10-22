export type UserRole = 'citizen' | 'municipal_staff' | 'manager';

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  requested_role: UserRole;
  approval_status: ApprovalStatus;
  is_pending_approval: boolean;
  staff_id?: string | null;
  manager_id?: string | null;
  designation?: string | null;
  place?: string;
  state?: string;
  municipality?: string;
  organization?: string;
  district?: string;
  ward?: string;
  is_profile_complete?: boolean;
  is_manager: boolean;
  is_staff: boolean;
  is_citizen: boolean;
  is_admin: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user: UserProfile;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface LoginCredentials {
  identifier: string; // Email or Registered ID (e.g. STF-XXXXX, MGR-XXXXX)
  password: string;
  portal?: 'citizen' | 'municipal_staff' | 'manager';
  full_name?: string;
  place?: string;
}

export interface CitizenRegisterData {
  full_name: string;
  place_ward: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface StaffRegisterData {
  full_name: string;
  place_municipality: string;
  email: string;
  password: string;
  confirm_password: string;
  organization: string;
  district: string;
  designation: string;
}

export interface ManagerRegisterData {
  full_name: string;
  place_municipality: string;
  email: string;
  password: string;
  confirm_password: string;
  organization: string;
  district: string;
  designation: string;
}

export interface PendingApproval {
  user_id: string;
  email: string;
  full_name: string;
  requested_role: string;
  organization: string;
  district: string;
  ward: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  staff_id: string | null;
  designation: string;
  municipality: string;
  role: string;
}
