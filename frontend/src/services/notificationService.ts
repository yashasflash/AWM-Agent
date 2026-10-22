import { api } from './api';
import { NotificationsResponse } from '../types/notification';

export const notificationService = {
  getNotifications: async (limit: number = 50): Promise<NotificationsResponse> => {
    return api.get<NotificationsResponse>('/api/v1/notifications/', {
      params: { limit },
    });
  },

  markAsRead: async (notificationId: string): Promise<{ success: boolean; unread_count: number }> => {
    return api.patch<{ success: boolean; unread_count: number }>(
      `/api/v1/notifications/${notificationId}/read`
    );
  },

  markAllAsRead: async (): Promise<{ success: boolean; marked_count: number; unread_count: number }> => {
    return api.patch<{ success: boolean; marked_count: number; unread_count: number }>(
      '/api/v1/notifications/read-all'
    );
  },
};
