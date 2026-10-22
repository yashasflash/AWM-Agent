export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  detail?: string;
}

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FilterOptions {
  search?: string;
  status?: string;
  category?: string;
  priority?: string;
  ward?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'priority';
}
