import apiClient from './client';
import type { ProjectVersionInfo } from '@/types/project-versions';

export const projectVersionsApi = {
  get: async (projectId: string): Promise<ProjectVersionInfo> => {
    const response = await apiClient.get<ProjectVersionInfo>(`/projects/${projectId}/versions`);
    return response.data;
  },

  refresh: async (projectId: string): Promise<ProjectVersionInfo> => {
    const response = await apiClient.post<ProjectVersionInfo>(`/projects/${projectId}/versions/refresh`);
    return response.data;
  },
};
