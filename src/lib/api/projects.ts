import apiClient from './client';
import type { Project, CreateProjectInput, UpdateProjectInput, User, PaginatedResponse, ProjectCapabilities, ApprovalPolicy } from '@/types';

export const projectsApi = {
  list: async (page = 1, limit = 20, labels?: string, search?: string): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get<PaginatedResponse<Project>>('/projects', {
      params: { page, limit, labels, search },
    });
    return response.data;
  },

  get: async (id: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${id}`);
    return response.data;
  },

  create: async (data: CreateProjectInput): Promise<Project> => {
    const response = await apiClient.post<Project>('/projects', data);
    return response.data;
  },

  update: async (id: string, data: UpdateProjectInput): Promise<Project> => {
    const response = await apiClient.patch<Project>(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  testConnection: async (id: string): Promise<{ success: boolean; message: string; kubernetesVersion?: string }> => {
    const response = await apiClient.post(`/projects/${id}/test-connection`);
    return response.data;
  },

  listAdmins: async (projectId: string): Promise<User[]> => {
    const response = await apiClient.get<User[]>(`/projects/${projectId}/admins`);
    return response.data;
  },

  addAdmin: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.post(`/projects/${projectId}/admins`, { userId });
  },

  removeAdmin: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/admins/${userId}`);
  },

  getCapabilities: async (id: string): Promise<ProjectCapabilities> => {
    const response = await apiClient.get<ProjectCapabilities>(`/projects/${id}/capabilities`);
    return response.data;
  },

  listMembers: async (projectId: string, search?: string): Promise<User[]> => {
    const response = await apiClient.get<User[]>(
      `/projects/${projectId}/members`,
      { params: search ? { search } : {} }
    );
    return response.data;
  },

  // Approval policy CRUD
  listApprovalPolicies: async (projectId: string): Promise<ApprovalPolicy[]> => {
    const response = await apiClient.get<ApprovalPolicy[]>(`/projects/${projectId}/approval-policies`);
    return response.data;
  },

  getApprovalPolicy: async (projectId: string, policyId: string): Promise<ApprovalPolicy> => {
    const response = await apiClient.get<ApprovalPolicy>(`/projects/${projectId}/approval-policies/${policyId}`);
    return response.data;
  },

  createApprovalPolicy: async (projectId: string, data: {
    entityType: string;
    action?: string | null;
    stages: { order: number; requiredPermission: string; teamScope: string; minApprovers: number }[];
  }): Promise<ApprovalPolicy> => {
    const response = await apiClient.post<ApprovalPolicy>(`/projects/${projectId}/approval-policies`, data);
    return response.data;
  },

  updateApprovalPolicy: async (projectId: string, policyId: string, data: {
    entityType: string;
    action?: string | null;
    stages: { order: number; requiredPermission: string; teamScope: string; minApprovers: number }[];
  }): Promise<ApprovalPolicy> => {
    const response = await apiClient.put<ApprovalPolicy>(`/projects/${projectId}/approval-policies/${policyId}`, data);
    return response.data;
  },

  deleteApprovalPolicy: async (projectId: string, policyId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/approval-policies/${policyId}`);
  },
};
