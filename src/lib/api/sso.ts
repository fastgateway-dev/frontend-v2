import apiClient from './client';
import type { SSOPublicConfig, SSOConfig, SSOConfigInput } from '@/types';

export const ssoApi = {
  // Public - get SSO status for login page (no auth required)
  getPublicConfig: async (): Promise<SSOPublicConfig> => {
    const response = await apiClient.get<SSOPublicConfig>('/auth/sso/config');
    return response.data;
  },

  // Admin - get full SSO config (owner only)
  getConfig: async (): Promise<SSOConfig> => {
    const response = await apiClient.get<SSOConfig>('/settings/sso');
    return response.data;
  },

  // Admin - update SSO config (owner only)
  updateConfig: async (input: SSOConfigInput): Promise<SSOConfig> => {
    const response = await apiClient.put<SSOConfig>('/settings/sso', input);
    return response.data;
  },

  // Admin - disable SSO (owner only)
  disable: async (): Promise<void> => {
    await apiClient.delete('/settings/sso');
  },

  // Get authorize URL (for SSO login redirect)
  getAuthorizeUrl: (): string => {
    return '/api/v1/auth/sso/authorize';
  },
};
