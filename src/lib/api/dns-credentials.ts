import apiClient from './client';
import type { DNSProviderCredential, CreateDNSCredentialInput, UpdateDNSCredentialInput } from '@/types';

export const dnsCredentialsApi = {
  list: async (): Promise<DNSProviderCredential[]> => {
    const response = await apiClient.get<{ data: DNSProviderCredential[] }>('/dns/credentials');
    return response.data.data;
  },
  get: async (id: string): Promise<DNSProviderCredential> => {
    const response = await apiClient.get<DNSProviderCredential>(`/dns/credentials/${id}`);
    return response.data;
  },
  create: async (data: CreateDNSCredentialInput): Promise<DNSProviderCredential> => {
    const response = await apiClient.post<DNSProviderCredential>('/dns/credentials', data);
    return response.data;
  },
  update: async (id: string, data: UpdateDNSCredentialInput): Promise<DNSProviderCredential> => {
    const response = await apiClient.patch<DNSProviderCredential>(`/dns/credentials/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/dns/credentials/${id}`);
  },
};
