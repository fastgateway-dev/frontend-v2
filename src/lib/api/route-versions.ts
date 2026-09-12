import apiClient from './client';

export interface RouteVersion {
  id: string;
  routeId: string;
  version: number;
  configSnapshot: any;
  routeDescription: string;
  protocol: string;
  securityMode: string;
  changeDescription: string;
  approvalId?: string;
  deployedBy: string;
  deployer?: { id: string; username: string; email: string };
  createdAt: string;
}

export interface RouteVersionListResponse {
  data: RouteVersion[];
  total: number;
  page: number;
  limit: number;
}

export const routeVersionsApi = {
  list: async (
    projectId: string,
    domainId: string,
    routeId: string,
    page = 1,
    limit = 20
  ): Promise<RouteVersionListResponse> => {
    const response = await apiClient.get<RouteVersionListResponse>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/versions`,
      { params: { page, limit } }
    );
    return response.data;
  },

  get: async (
    projectId: string,
    domainId: string,
    routeId: string,
    version: number
  ): Promise<RouteVersion> => {
    const response = await apiClient.get<RouteVersion>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/versions/${version}`
    );
    return response.data;
  },

  rollback: async (
    projectId: string,
    domainId: string,
    routeId: string,
    version: number
  ): Promise<any> => {
    const response = await apiClient.post(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/versions/${version}/rollback`
    );
    return response.data;
  },
};
