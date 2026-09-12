import apiClient from './client';
import type { PermissionPreset, CreatePresetInput, UpdatePresetInput } from '@/types';

export const presetsApi = {
  list: async (projectId: string): Promise<PermissionPreset[]> => {
    const response = await apiClient.get<PermissionPreset[]>(`/projects/${projectId}/presets`);
    return response.data;
  },

  get: async (projectId: string, presetId: string): Promise<PermissionPreset> => {
    const response = await apiClient.get<PermissionPreset>(`/projects/${projectId}/presets/${presetId}`);
    return response.data;
  },

  create: async (projectId: string, data: CreatePresetInput): Promise<PermissionPreset> => {
    const response = await apiClient.post<PermissionPreset>(`/projects/${projectId}/presets`, data);
    return response.data;
  },

  update: async (projectId: string, presetId: string, data: UpdatePresetInput): Promise<PermissionPreset> => {
    const response = await apiClient.patch<PermissionPreset>(`/projects/${projectId}/presets/${presetId}`, data);
    return response.data;
  },

  delete: async (projectId: string, presetId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/presets/${presetId}`);
  },
};
