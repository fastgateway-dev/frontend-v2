import apiClient from './client';
import type {
  Client,
  CreateClientInput,
  UpdateClientInput,
  ClientIPAddress,
  CreateClientIPInput,
  ClientHeader,
  CreateClientHeaderInput,
  GenerateAPIKeyInput,
  GenerateAPIKeyResponse,
  ConfigureJWTInput,
  ConfigureJWTResponse,
  PaginatedResponse,
  MTLSSANEntry,
} from '@/types';

export interface UpdateClientMTLSInput {
  enabled: boolean;
  caName?: string;
  caPem?: string;
  sans?: MTLSSANEntry[];
  hashes?: string[];
}

export const clientsApi = {
  list: async (page = 1, limit = 20, teamId?: string): Promise<PaginatedResponse<Client>> => {
    const params: Record<string, string | number> = { page, limit };
    if (teamId) params.teamId = teamId;
    const response = await apiClient.get<PaginatedResponse<Client>>('/clients', { params });
    return response.data;
  },

  get: async (clientId: string): Promise<Client> => {
    const response = await apiClient.get<Client>(`/clients/${clientId}`);
    return response.data;
  },

  create: async (data: CreateClientInput): Promise<Client> => {
    const response = await apiClient.post<Client>('/clients', data);
    return response.data;
  },

  update: async (clientId: string, data: UpdateClientInput): Promise<Client> => {
    const response = await apiClient.patch<Client>(`/clients/${clientId}`, data);
    return response.data;
  },

  delete: async (clientId: string): Promise<void> => {
    await apiClient.delete(`/clients/${clientId}`);
  },

  listIPs: async (clientId: string): Promise<ClientIPAddress[]> => {
    const response = await apiClient.get<ClientIPAddress[]>(`/clients/${clientId}/ips`);
    return response.data;
  },

  addIP: async (clientId: string, data: CreateClientIPInput): Promise<ClientIPAddress> => {
    const response = await apiClient.post<ClientIPAddress>(`/clients/${clientId}/ips`, data);
    return response.data;
  },

  removeIP: async (clientId: string, ipId: string): Promise<void> => {
    await apiClient.delete(`/clients/${clientId}/ips/${ipId}`);
  },

  // Header Authorization Management
  listHeaders: async (clientId: string): Promise<ClientHeader[]> => {
    const response = await apiClient.get<ClientHeader[]>(`/clients/${clientId}/headers`);
    return response.data;
  },

  addHeader: async (clientId: string, data: CreateClientHeaderInput): Promise<ClientHeader> => {
    const response = await apiClient.post<ClientHeader>(`/clients/${clientId}/headers`, data);
    return response.data;
  },

  removeHeader: async (clientId: string, headerId: string): Promise<void> => {
    await apiClient.delete(`/clients/${clientId}/headers/${headerId}`);
  },

  // Method Authorization Management
  setAllowedMethods: async (clientId: string, methods: string[]): Promise<Client> => {
    const response = await apiClient.put<Client>(`/clients/${clientId}/methods`, { methods });
    return response.data;
  },

  // API Key Management
  generateAPIKey: async (clientId: string, data?: GenerateAPIKeyInput): Promise<GenerateAPIKeyResponse> => {
    const response = await apiClient.post<GenerateAPIKeyResponse>(`/clients/${clientId}/api-key`, data || {});
    return response.data;
  },

  revokeAPIKey: async (clientId: string): Promise<void> => {
    await apiClient.delete(`/clients/${clientId}/api-key`);
  },

  // JWT Authentication Management
  configureJWT: async (clientId: string, data: ConfigureJWTInput): Promise<ConfigureJWTResponse> => {
    const response = await apiClient.post<ConfigureJWTResponse>(`/clients/${clientId}/jwt`, data);
    return response.data;
  },

  updateJWT: async (clientId: string, data: ConfigureJWTInput): Promise<ConfigureJWTResponse> => {
    const response = await apiClient.put<ConfigureJWTResponse>(`/clients/${clientId}/jwt`, data);
    return response.data;
  },

  removeJWT: async (clientId: string): Promise<void> => {
    await apiClient.delete(`/clients/${clientId}/jwt`);
  },

  // mTLS Authentication Management
  updateMTLS: async (clientId: string, input: UpdateClientMTLSInput): Promise<Client> => {
    const response = await apiClient.put<Client>(`/clients/${clientId}/mtls`, input);
    return response.data;
  },

  deleteMTLS: async (clientId: string): Promise<Client> => {
    const response = await apiClient.delete<Client>(`/clients/${clientId}/mtls`);
    return response.data;
  },
};
