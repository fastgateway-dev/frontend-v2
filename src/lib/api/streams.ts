import apiClient from './client';
import type { Stream, CreateStreamInput, UpdateStreamInput, StreamRoute, L4Metrics, PaginatedResponse, Route, RouteWithWarnings, CreateRouteInput, UpdateRouteInput } from '@/types';

export const streamsApi = {
  list: async (projectId: string): Promise<{ data: Stream[] }> => {
    const response = await apiClient.get<{ data: Stream[] }>(`/projects/${projectId}/streams`);
    return response.data;
  },

  get: async (projectId: string, streamId: string): Promise<Stream> => {
    const response = await apiClient.get<Stream>(`/projects/${projectId}/streams/${streamId}`);
    return response.data;
  },

  create: async (projectId: string, data: CreateStreamInput): Promise<Stream> => {
    const response = await apiClient.post<Stream>(`/projects/${projectId}/streams`, data);
    return response.data;
  },

  update: async (projectId: string, streamId: string, data: UpdateStreamInput): Promise<Stream> => {
    const response = await apiClient.patch<Stream>(`/projects/${projectId}/streams/${streamId}`, data);
    return response.data;
  },

  delete: async (projectId: string, streamId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/streams/${streamId}`);
  },

  // L4 routes owned by a stream
  listRoutes: async (projectId: string, streamId: string, page = 1, limit = 100): Promise<PaginatedResponse<StreamRoute>> => {
    const response = await apiClient.get<PaginatedResponse<StreamRoute>>(
      `/projects/${projectId}/streams/${streamId}/routes`,
      { params: { page, limit } }
    );
    return response.data;
  },

  getRoute: async (projectId: string, streamId: string, routeId: string): Promise<Route> => {
    const response = await apiClient.get<Route>(
      `/projects/${projectId}/streams/${streamId}/routes/${routeId}`
    );
    return response.data;
  },

  // Create an L4 route under a stream. A listener port already in use returns HTTP 409.
  createRoute: async (projectId: string, streamId: string, data: CreateRouteInput): Promise<RouteWithWarnings> => {
    const response = await apiClient.post<RouteWithWarnings>(
      `/projects/${projectId}/streams/${streamId}/routes`,
      data
    );
    return response.data;
  },

  updateRoute: async (
    projectId: string,
    streamId: string,
    routeId: string,
    data: UpdateRouteInput
  ): Promise<RouteWithWarnings> => {
    const response = await apiClient.put<RouteWithWarnings>(
      `/projects/${projectId}/streams/${streamId}/routes/${routeId}`,
      data
    );
    return response.data;
  },

  deleteRoute: async (projectId: string, streamId: string, routeId: string): Promise<Route> => {
    const response = await apiClient.delete<Route>(
      `/projects/${projectId}/streams/${streamId}/routes/${routeId}`
    );
    return response.data;
  },

  deployRoute: async (projectId: string, streamId: string, routeId: string): Promise<Route> => {
    const response = await apiClient.post<Route>(
      `/projects/${projectId}/streams/${streamId}/routes/${routeId}/deploy`
    );
    return response.data;
  },

  // Aggregate + per-listener L4 metrics. Backend returns 400 "not configured" when the
  // project has no metrics endpoint.
  getMetrics: async (projectId: string, streamId: string): Promise<L4Metrics> => {
    const response = await apiClient.get<L4Metrics>(`/projects/${projectId}/streams/${streamId}/metrics`);
    return response.data;
  },
};
