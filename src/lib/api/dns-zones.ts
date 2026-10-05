import apiClient from './client';
import type { DNSHostedZone } from '@/types';

export const dnsZonesApi = {
  list: async (): Promise<DNSHostedZone[]> => {
    const response = await apiClient.get<{ data: DNSHostedZone[] }>('/dns/zones');
    return response.data.data;
  },

  get: async (id: string): Promise<DNSHostedZone> => {
    const response = await apiClient.get<DNSHostedZone>(`/dns/zones/${id}`);
    return response.data;
  },

  create: async (data: { name: string; providerCredentialId: string }): Promise<DNSHostedZone> => {
    const response = await apiClient.post<DNSHostedZone>('/dns/zones', data);
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/dns/zones/${id}`);
  },
};
