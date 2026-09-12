import apiClient from './client';
import { ProjectPermissions } from '@/types';

export const permissionsApi = {
  // Get current user's permissions for a project
  getProjectPermissions: async (projectId: string): Promise<ProjectPermissions> => {
    const response = await apiClient.get(`/projects/${projectId}/permissions`);
    return response.data;
  },
};
