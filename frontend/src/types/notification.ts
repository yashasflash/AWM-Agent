export type NotificationType =
  | 'REPORT_SUBMITTED'
  | 'WORK_ASSIGNED'
  | 'WORK_ACCEPTED'
  | 'WORK_STARTED'
  | 'WORK_COMPLETED'
  | 'VERIFICATION_REQUIRED'
  | 'RESOLUTION_REJECTED'
  | 'REPORT_RESOLVED';

export interface AppNotification {
  id: string;
  recipient_id: string;
  recipient_role: 'citizen' | 'municipal_staff' | 'manager';
  type: NotificationType;
  title: string;
  message: string;
  report_id?: string | null;
  report_number?: number | null;
  task_id?: string | null;
  created_at: string;
  is_read: number | boolean;
  read_at?: string | null;
}

export interface NotificationsResponse {
  success: boolean;
  count: number;
  unread_count: number;
  notifications: AppNotification[];
}
