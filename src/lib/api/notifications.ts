import apiClient from './client';
import type { Notification, PaginatedResponse } from '@/types';

export const notificationsApi = {
  list: async (
    page = 1,
    limit = 20,
    unread = false
  ): Promise<PaginatedResponse<Notification>> => {
    const response = await apiClient.get<PaginatedResponse<Notification>>(
      '/notifications',
      { params: { page, limit, unread: unread ? 'true' : undefined } }
    );
    return response.data;
  },

  countUnread: async (): Promise<{ unread: number }> => {
    const response = await apiClient.get<{ unread: number }>('/notifications/count');
    return response.data;
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    await apiClient.put(`/notifications/${notificationId}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/notifications/read-all');
  },
};
