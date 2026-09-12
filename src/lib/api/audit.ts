import apiClient from './client';
import type { AuditLog, PaginatedResponse } from '@/types';

export const auditApi = {
  list: async (
    projectId: string,
    page = 1,
    limit = 20,
    resourceType?: string,
    action?: string,
    userId?: string
  ): Promise<PaginatedResponse<AuditLog>> => {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>(
      `/projects/${projectId}/audit`,
      { params: { page, limit, resourceType, action, userId } }
    );
    return response.data;
  },

  export: async (
    projectId: string,
    resourceType?: string,
    action?: string,
    userId?: string
  ): Promise<Blob> => {
    const response = await apiClient.get(
      `/projects/${projectId}/audit/export`,
      {
        params: { resourceType, action, userId },
        headers: { Accept: 'text/csv' },
        responseType: 'blob',
      }
    );
    return response.data;
  },

  cleanup: async (
    projectId: string,
    days: number
  ): Promise<{ deleted: number; message: string }> => {
    const response = await apiClient.delete<{ deleted: number; message: string }>(
      `/projects/${projectId}/audit/cleanup`,
      { data: { days } }
    );
    return response.data;
  },
};
