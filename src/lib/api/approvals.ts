import apiClient from './client';
import type { ApprovalRequest, PaginatedResponse, ApprovalDiff } from '@/types';

export const approvalsApi = {
  list: async (
    projectId: string,
    page = 1,
    limit = 20,
    status = ''
  ): Promise<PaginatedResponse<ApprovalRequest>> => {
    const response = await apiClient.get<PaginatedResponse<ApprovalRequest>>(
      `/projects/${projectId}/approvals`,
      { params: { page, limit, status } }
    );
    return response.data;
  },

  get: async (projectId: string, approvalId: string): Promise<ApprovalRequest> => {
    const response = await apiClient.get<ApprovalRequest>(
      `/projects/${projectId}/approvals/${approvalId}`
    );
    return response.data;
  },

  approve: async (projectId: string, approvalId: string, stageId: string): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApprovalRequest>(
      `/projects/${projectId}/approvals/${approvalId}/stages/${stageId}/approve`
    );
    return response.data;
  },

  reject: async (projectId: string, approvalId: string, stageId: string, comment: string): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApprovalRequest>(
      `/projects/${projectId}/approvals/${approvalId}/stages/${stageId}/reject`,
      { comment }
    );
    return response.data;
  },

  cancel: async (projectId: string, approvalId: string): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApprovalRequest>(
      `/projects/${projectId}/approvals/${approvalId}/cancel`
    );
    return response.data;
  },

  getDiff: async (projectId: string, approvalId: string): Promise<ApprovalDiff> => {
    const response = await apiClient.get<ApprovalDiff>(`/projects/${projectId}/approvals/${approvalId}/diff`);
    return response.data;
  },
};
