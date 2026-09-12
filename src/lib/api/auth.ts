import apiClient, { setTokens, clearTokens } from './client';
import type { LoginRequest, LoginResponse, User, ApiToken, ApiTokenCapabilities, ChangePasswordRequest } from '@/types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    setTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  listApiTokens: async (): Promise<ApiToken[]> => {
    const response = await apiClient.get<ApiToken[]>('/auth/tokens');
    return response.data;
  },

  createApiToken: async (name: string, expiresAt?: string): Promise<{ token: string } & ApiToken> => {
    const response = await apiClient.post('/auth/tokens', {
      name,
      expiresAt: expiresAt ? `${expiresAt}T00:00:00Z` : undefined,
    });
    return response.data;
  },

  revokeApiToken: async (tokenId: string): Promise<void> => {
    await apiClient.delete(`/auth/tokens/${tokenId}`);
  },

  getApiTokenCapabilities: async (): Promise<ApiTokenCapabilities> => {
    const response = await apiClient.get<ApiTokenCapabilities>('/auth/tokens/capabilities');
    return response.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.put('/auth/password', data);
  },
};
