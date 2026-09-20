import apiClient from './client';
import type { CertificateIssuer, CreateIssuerInput, IssuerProjectGrant, IssuerStatusResponse } from '@/types';

export const certificateIssuersApi = {
  list: async (): Promise<CertificateIssuer[]> => {
    const response = await apiClient.get<{ data: CertificateIssuer[] }>('/certificates/issuers');
    return response.data.data;
  },
  get: async (id: string): Promise<CertificateIssuer> => {
    const response = await apiClient.get<CertificateIssuer>(`/certificates/issuers/${id}`);
    return response.data;
  },
  create: async (data: CreateIssuerInput): Promise<CertificateIssuer> => {
    const response = await apiClient.post<CertificateIssuer>('/certificates/issuers', data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/certificates/issuers/${id}`);
  },
  getStatus: async (id: string): Promise<IssuerStatusResponse> => {
    const response = await apiClient.get<IssuerStatusResponse>(`/certificates/issuers/${id}/status`);
    return response.data;
  },
  listGrants: async (id: string): Promise<IssuerProjectGrant[]> => {
    const response = await apiClient.get<{ data: IssuerProjectGrant[] }>(`/certificates/issuers/${id}/grants`);
    return response.data.data;
  },
  grant: async (id: string, projectId: string): Promise<void> => {
    await apiClient.post(`/certificates/issuers/${id}/grants`, { projectId });
  },
  revokeGrant: async (id: string, projectId: string): Promise<void> => {
    await apiClient.delete(`/certificates/issuers/${id}/grants/${projectId}`);
  },
};
