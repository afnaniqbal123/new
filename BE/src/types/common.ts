import { NotificationType } from 'src/constants/notification';

export interface SendNotificationType {
  receiverId: string;
  senderId: string;
  type: NotificationType;
  projectId?: string;
  title?: string;
}

export interface CustomRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: string;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  message: string;
  status: number;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
