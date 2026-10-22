import { api } from './api';
import {
  CitizenReportsResponse,
  CreateReportResponse,
  ManagerReportsResponse,
  SingleReportResponse,
  StaffReportsResponse,
  WasteReport,
  WasteReportCreate,
} from '../types/report';

export const reportService = {
  async uploadPhoto(file: File): Promise<{ success: boolean; message: string; file_path: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post('/api/v1/reports/upload-photo', formData);
  },

  async createReport(data: WasteReportCreate): Promise<CreateReportResponse> {
    return api.post<CreateReportResponse>('/api/v1/reports/', data);
  },

  async getCitizenReports(params?: {
    page?: number;
    limit?: number;
    status?: string;
    waste_category?: string;
    search?: string;
    sort?: 'newest' | 'oldest';
  }): Promise<CitizenReportsResponse> {
    return api.get<CitizenReportsResponse>('/api/v1/reports/', { params });
  },

  async getNearbyReports(params?: {
    ward?: string;
    status?: string;
    category?: string;
    limit?: number;
  }): Promise<{ success: boolean; ward: string; count: number; reports: WasteReport[] }> {
    return api.get('/api/v1/reports/nearby', { params });
  },

  async getStaffAssignedReports(params?: {
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<StaffReportsResponse> {
    return api.get<StaffReportsResponse>('/api/v1/reports/staff/assigned', { params });
  },

  async updateStaffReport(
    reportId: string | number,
    payload: { status: 'In Progress' | 'Resolved'; staff_note?: string }
  ): Promise<{ success: boolean; message: string; report: WasteReport }> {
    return api.patch(`/api/v1/reports/staff/${reportId}/update`, payload);
  },

  async acceptStaffAssignment(
    reportId: string | number
  ): Promise<{ success: boolean; message: string; report: WasteReport }> {
    return api.patch(`/api/v1/reports/staff/${reportId}/accept`, {});
  },

  async startStaffWork(
    reportId: string | number
  ): Promise<{ success: boolean; message: string; report: WasteReport }> {
    return api.patch(`/api/v1/reports/staff/${reportId}/start`, {});
  },

  async submitStaffResolution(
    reportId: string | number,
    payload: { staff_note: string; photo_url?: string; direct_resolve?: boolean }
  ): Promise<{ success: boolean; message: string; report: WasteReport }> {
    return api.patch(`/api/v1/reports/staff/${reportId}/resolve`, payload);
  },

  async verifyManagerResolution(
    reportId: string | number,
    payload: { action: 'approve' | 'reject'; manager_note?: string }
  ): Promise<{ success: boolean; message: string; report: WasteReport }> {
    return api.post(`/api/v1/reports/manager/${reportId}/verify`, payload);
  },

  async getManagerReports(params?: {
    page?: number;
    limit?: number;
    status?: string;
    ai_priority?: string;
    waste_category?: string;
    ward?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    sort?: 'newest' | 'oldest' | 'priority';
  }): Promise<ManagerReportsResponse> {
    return api.get<ManagerReportsResponse>('/api/v1/reports/manager/all', { params });
  },

  async assignReport(
    reportId: string | number,
    payload: {
      staff_email: string;
      staff_name?: string;
      department?: string;
      priority?: string;
      manager_note?: string;
    }
  ): Promise<{ success: boolean; message: string; report: WasteReport }> {
    return api.post(`/api/v1/reports/manager/${reportId}/assign`, payload);
  },

  async getReportDetail(reportId: string | number): Promise<SingleReportResponse> {
    return api.get<SingleReportResponse>(`/api/v1/reports/${reportId}`);
  },

  async getReportById(reportId: string | number): Promise<SingleReportResponse> {
    return this.getReportDetail(reportId);
  },

  async updateReportStatus(
    reportId: string | number,
    payload: {
      status: 'Submitted' | 'Under Review' | 'In Progress' | 'Resolved' | 'Rejected';
      department?: string;
      admin_note?: string;
      priority?: string;
    }
  ): Promise<{ success: boolean; message: string; report: WasteReport }> {
    return api.patch(`/api/v1/reports/${reportId}/status`, payload);
  },
};
