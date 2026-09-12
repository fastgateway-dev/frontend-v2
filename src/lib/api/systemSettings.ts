import apiClient from './client';
import type { SystemSettingsResponse, SystemSettingsInput } from '@/types';

export const systemSettingsApi = {
  get: async (): Promise<SystemSettingsResponse> => {
    const response = await apiClient.get<SystemSettingsResponse>('/settings/system');
    return response.data;
  },

  update: async (input: SystemSettingsInput): Promise<SystemSettingsResponse> => {
    const response = await apiClient.put<SystemSettingsResponse>('/settings/system', input);
    return response.data;
  },
};
