import apiClient from './client';
import type {
  RouteMetrics,
  DomainMetrics,
  MetricsRange,
  TestMetricsConnectionResult,
} from '@/types';

export const metricsApi = {
  testConnection: async (projectId: string): Promise<TestMetricsConnectionResult> => {
    const res = await apiClient.post<TestMetricsConnectionResult>(
      `/projects/${projectId}/metrics/test-connection`
    );
    return res.data;
  },

  getRouteMetrics: async (
    projectId: string,
    routeId: string,
    range: MetricsRange = '1h'
  ): Promise<RouteMetrics> => {
    const res = await apiClient.get<RouteMetrics>(
      `/projects/${projectId}/routes/${routeId}/metrics`,
      { params: { range } }
    );
    return res.data;
  },

  getDomainMetrics: async (
    projectId: string,
    domainId: string,
    range: MetricsRange = '1h'
  ): Promise<DomainMetrics> => {
    const res = await apiClient.get<DomainMetrics>(
      `/projects/${projectId}/domains/${domainId}/metrics`,
      { params: { range } }
    );
    return res.data;
  },
};
