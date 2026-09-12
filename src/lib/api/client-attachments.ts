import apiClient from './client';
import type {
  ClientRouteAttachment,
  Approval,
  AttachClientFromRouteInput,
  AttachClientFromClientInput,
  PaginatedResponse,
} from '@/types';

export const clientAttachmentsApi = {
  // Route-side: list clients attached to a route
  listRouteClients: async (
    projectId: string,
    domainId: string,
    routeId: string
  ): Promise<ClientRouteAttachment[]> => {
    const response = await apiClient.get<ClientRouteAttachment[]>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/clients`
    );
    return response.data;
  },

  // Route-side: attach client to route
  attachFromRoute: async (
    projectId: string,
    domainId: string,
    routeId: string,
    data: AttachClientFromRouteInput
  ): Promise<ClientRouteAttachment> => {
    const response = await apiClient.post<ClientRouteAttachment>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/clients/attach`,
      data
    );
    return response.data;
  },

  // Route-side: request detach
  requestDetachFromRoute: async (
    projectId: string,
    domainId: string,
    routeId: string,
    attachmentId: string
  ): Promise<ClientRouteAttachment> => {
    const response = await apiClient.post<ClientRouteAttachment>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/clients/${attachmentId}/detach`
    );
    return response.data;
  },

  // Client-side: list routes attached to a client
  listClientRoutes: async (clientId: string): Promise<ClientRouteAttachment[]> => {
    const response = await apiClient.get<ClientRouteAttachment[]>(
      `/clients/${clientId}/routes`
    );
    return response.data;
  },

  // Client-side: attach client to route
  attachFromClient: async (
    clientId: string,
    data: AttachClientFromClientInput
  ): Promise<ClientRouteAttachment> => {
    const response = await apiClient.post<ClientRouteAttachment>(
      `/clients/${clientId}/routes/attach`,
      data
    );
    return response.data;
  },

  // Approvals: list client attachment approvals for a project
  listApprovals: async (
    projectId: string,
    page = 1,
    limit = 20,
    status = ''
  ): Promise<PaginatedResponse<Approval>> => {
    const response = await apiClient.get<PaginatedResponse<Approval>>(
      `/projects/${projectId}/client-approvals`,
      { params: { page, limit, status } }
    );
    return response.data;
  },

  // Approvals: get a single approval
  getApproval: async (
    projectId: string,
    approvalId: string
  ): Promise<Approval> => {
    const response = await apiClient.get<Approval>(
      `/projects/${projectId}/client-approvals/${approvalId}`
    );
    return response.data;
  },

  // Approvals: approve a specific stage
  approveStage: async (
    projectId: string,
    approvalId: string,
    stageId: string
  ): Promise<Approval> => {
    const response = await apiClient.post<Approval>(
      `/projects/${projectId}/client-approvals/${approvalId}/stages/${stageId}/approve`
    );
    return response.data;
  },

  // Approvals: reject a specific stage
  rejectStage: async (
    projectId: string,
    approvalId: string,
    stageId: string,
    comment: string
  ): Promise<Approval> => {
    const response = await apiClient.post<Approval>(
      `/projects/${projectId}/client-approvals/${approvalId}/stages/${stageId}/reject`,
      { comment }
    );
    return response.data;
  },
};
