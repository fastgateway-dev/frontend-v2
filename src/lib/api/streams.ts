import apiClient from './client';
import type { Stream, CreateStreamInput, UpdateStreamInput, StreamRoute, L4Metrics, PaginatedResponse } from '@/types';

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

  // Aggregate + per-listener L4 metrics. Backend returns 400 "not configured" when the
  // project has no metrics endpoint.
  getMetrics: async (projectId: string, streamId: string): Promise<L4Metrics> => {
    const response = await apiClient.get<L4Metrics>(`/projects/${projectId}/streams/${streamId}/metrics`);
    return response.data;
  },
};
