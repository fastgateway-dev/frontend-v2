import apiClient from './client';
import type {
  ManagedCertificate, CreateCertificateInput, CreateCertificateResponse,
  ManagedCertificateStatus, CertificateDistribution, CertificateIssuer, PaginatedResponse,
  EnrichedCertificate,
} from '@/types';

export const certificatesApi = {
  list: async (projectId: string): Promise<EnrichedCertificate[]> => {
    const response = await apiClient.get<PaginatedResponse<EnrichedCertificate>>(`/projects/${projectId}/certificates`);
    return response.data.data;
  },
  fleet: async (params?: { status?: string; usage?: string; issuerId?: string; projectId?: string; page?: number; limit?: number }): Promise<EnrichedCertificate[]> => {
    const response = await apiClient.get<PaginatedResponse<EnrichedCertificate>>('/certificates', params ? { params } : undefined);
    return response.data.data;
  },
  issuersForProject: async (projectId: string): Promise<CertificateIssuer[]> => {
    const response = await apiClient.get<{ data: CertificateIssuer[] }>(`/projects/${projectId}/certificates/issuers`);
    return response.data.data;
  },
  create: async (projectId: string, data: CreateCertificateInput): Promise<CreateCertificateResponse> => {
    const response = await apiClient.post<CreateCertificateResponse>(`/projects/${projectId}/certificates`, data);
    return response.data;
  },
  get: async (projectId: string, certificateId: string): Promise<ManagedCertificate> => {
    const response = await apiClient.get<ManagedCertificate>(`/projects/${projectId}/certificates/${certificateId}`);
    return response.data;
  },
  getStatus: async (projectId: string, certificateId: string): Promise<ManagedCertificateStatus> => {
    const response = await apiClient.get<ManagedCertificateStatus>(`/projects/${projectId}/certificates/${certificateId}/status`);
    return response.data;
  },
  getDistribution: async (projectId: string, certificateId: string): Promise<CertificateDistribution> => {
    const response = await apiClient.get<CertificateDistribution>(`/projects/${projectId}/certificates/${certificateId}/distribution`);
    return response.data;
  },
  resync: async (projectId: string, certificateId: string): Promise<void> => {
    await apiClient.post(`/projects/${projectId}/certificates/${certificateId}/resync`);
  },
  delete: async (projectId: string, certificateId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/certificates/${certificateId}`);
  },
};
