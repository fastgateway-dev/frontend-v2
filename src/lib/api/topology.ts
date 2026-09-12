import apiClient from './client';
import type { ProjectTopologyResponse, DomainTopologyResponse } from '@/types/topology';

export const topologyApi = {
  getProjectTopology: async (projectId: string): Promise<ProjectTopologyResponse> => {
    const r = await apiClient.get<ProjectTopologyResponse>(`/projects/${projectId}/topology`);
    return r.data;
  },
  getDomainTopology: async (projectId: string, domainId: string): Promise<DomainTopologyResponse> => {
    const r = await apiClient.get<DomainTopologyResponse>(`/projects/${projectId}/domains/${domainId}/topology`);
    return r.data;
  },
};
