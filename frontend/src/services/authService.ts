import { api, clearApiCache } from './api';
import { supabase } from './supabase';
import {
  AuthResponse,
  CitizenRegisterData,
  LoginCredentials,
  ManagerRegisterData,
  PendingApproval,
  StaffMember,
  StaffRegisterData,
  UserProfile,
} from '../types/auth';
import { STORAGE_KEYS } from '../utils/constants';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/v1/auth/login', credentials);
    if (res.access_token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, res.access_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
      if (credentials.portal) {
        localStorage.setItem(STORAGE_KEYS.PORTAL, credentials.portal);
      }
    }
    return res;
  },

  async signInWithGoogle(requestedRole?: string): Promise<void> {
    if (requestedRole) {
      localStorage.setItem('awm_oauth_role', requestedRole);
    } else {
      localStorage.removeItem('awm_oauth_role');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      throw error;
    }
  },

  async syncGoogleUser(
    token: string,
    payload?: { requested_role?: string; full_name?: string }
  ): Promise<UserProfile> {
    const res = await api.post<{
      success: boolean;
      message: string;
      user: UserProfile;
    }>('/api/v1/auth/google-sync', payload || {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.user) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    }
    return res.user;
  },

  async registerCitizen(data: CitizenRegisterData): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/v1/auth/register-citizen', data);
    if (res.access_token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, res.access_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
      localStorage.setItem(STORAGE_KEYS.PORTAL, 'citizen');
    }
    return res;
  },

  async registerStaff(data: StaffRegisterData): Promise<{ success: boolean; message: string; user: Partial<UserProfile> }> {
    return api.post('/api/v1/auth/register-staff', data);
  },

  async registerManager(data: ManagerRegisterData): Promise<{ success: boolean; message: string; user: Partial<UserProfile> }> {
    return api.post('/api/v1/auth/register-manager', data);
  },

  async setupInitialManager(data: {
    email: string;
    password: string;
    full_name: string;
    organization?: string;
    district?: string;
    designation?: string;
    setup_key?: string;
  }): Promise<{ success: boolean; message: string }> {
    return api.post('/api/v1/auth/setup-initial-manager', data);
  },

  async getCurrentUser(): Promise<UserProfile> {
    const res = await api.get<{ success: boolean; user: UserProfile }>('/api/v1/auth/me');
    if (res.user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    }
    return res.user;
  },

  async getPendingApprovals(): Promise<PendingApproval[]> {
    const res = await api.get<{ success: boolean; count: number; pending_approvals: PendingApproval[] }>(
      '/api/v1/auth/pending-approvals'
    );
    return res.pending_approvals || [];
  },

  async reviewApproval(
    userId: string,
    action: 'approve' | 'reject',
    rejectionReason?: string
  ): Promise<{ success: boolean; message: string }> {
    return api.post('/api/v1/auth/review-approval', {
      user_id: userId,
      action,
      rejection_reason: rejectionReason,
    });
  },

  async getStaffList(): Promise<StaffMember[]> {
    const res = await api.get<{ success: boolean; count: number; staff: StaffMember[] }>(
      '/api/v1/auth/staff-list'
    );
    return res.staff || [];
  },

  async checkHealth(): Promise<{ status: string; service: string }> {
    return api.get<{ status: string; service: string }>('/health');
  },

  logout(): void {
    clearApiCache();
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    // Note: preserve PORTAL preference if desired or remove
  },

  getStoredToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  getStoredUser(): UserProfile | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },
};
