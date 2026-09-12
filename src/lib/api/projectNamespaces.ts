import apiClient from './client';
import type { ProjectNamespace, CreateProjectNamespaceInput, UpdateProjectNamespaceInput } from '@/types';

interface ProjectNamespaceListResponse {
  data: ProjectNamespace[];
}

export const projectNamespacesApi = {
  list: async (projectId: string): Promise<ProjectNamespace[]> => {
    const response = await apiClient.get<ProjectNamespaceListResponse>(`/projects/${projectId}/namespaces`);
    return response.data.data;
  },

  get: async (projectId: string, namespaceId: string): Promise<ProjectNamespace> => {
    const response = await apiClient.get<ProjectNamespace>(`/projects/${projectId}/namespaces/${namespaceId}`);
    return response.data;
  },

  create: async (projectId: string, data: CreateProjectNamespaceInput): Promise<ProjectNamespace> => {
    const response = await apiClient.post<ProjectNamespace>(`/projects/${projectId}/namespaces`, data);
    return response.data;
  },

  update: async (projectId: string, namespaceId: string, data: UpdateProjectNamespaceInput): Promise<ProjectNamespace> => {
    const response = await apiClient.patch<ProjectNamespace>(`/projects/${projectId}/namespaces/${namespaceId}`, data);
    return response.data;
  },

  delete: async (projectId: string, namespaceId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/namespaces/${namespaceId}`);
  },

  ensureReferenceGrant: async (projectId: string, namespaceId: string): Promise<ProjectNamespace> => {
    const response = await apiClient.post<ProjectNamespace>(`/projects/${projectId}/namespaces/${namespaceId}/ensure-reference-grant`);
    return response.data;
  },
};
