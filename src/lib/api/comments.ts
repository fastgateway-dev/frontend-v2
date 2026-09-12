import apiClient from './client';
import type { ApprovalComment } from '@/types';

export const commentsApi = {
  list: async (
    projectId: string,
    approvalId: string
  ): Promise<{ data: ApprovalComment[]; total: number }> => {
    const response = await apiClient.get<{ data: ApprovalComment[]; total: number }>(
      `/projects/${projectId}/approvals/${approvalId}/comments`
    );
    return response.data;
  },

  create: async (
    projectId: string,
    approvalId: string,
    body: string
  ): Promise<ApprovalComment> => {
    const response = await apiClient.post<ApprovalComment>(
      `/projects/${projectId}/approvals/${approvalId}/comments`,
      { body }
    );
    return response.data;
  },
};
