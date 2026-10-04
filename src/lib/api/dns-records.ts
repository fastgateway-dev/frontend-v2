import apiClient from './client';
import type { DomainDNSRecord, DNSRecordInput } from '@/types';

export const dnsRecordsApi = {
  get: async (projectId: string, domainId: string): Promise<DomainDNSRecord> => {
    const r = await apiClient.get<DomainDNSRecord>(`/projects/${projectId}/domains/${domainId}/dns-record`);
    return r.data;
  },
  enable: async (projectId: string, domainId: string, data: DNSRecordInput): Promise<DomainDNSRecord> => {
    const r = await apiClient.post<DomainDNSRecord>(`/projects/${projectId}/domains/${domainId}/dns-record`, data);
    return r.data;
  },
  update: async (projectId: string, domainId: string, data: DNSRecordInput): Promise<DomainDNSRecord> => {
    const r = await apiClient.put<DomainDNSRecord>(`/projects/${projectId}/domains/${domainId}/dns-record`, data);
    return r.data;
  },
  remove: async (projectId: string, domainId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/domains/${domainId}/dns-record`);
  },
  refresh: async (projectId: string, domainId: string): Promise<DomainDNSRecord> => {
    const r = await apiClient.post<DomainDNSRecord>(`/projects/${projectId}/domains/${domainId}/dns-record/refresh`, {});
    return r.data;
  },
};
