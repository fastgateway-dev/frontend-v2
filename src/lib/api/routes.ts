import apiClient from './client';
import type { Route, RouteWithWarnings, CreateRouteInput, RouteConfig, PaginatedResponse, CORSFilter, SecurityPolicyInput, BackendTrafficPolicyInput, EffectiveIPEntry, EnvoyExtensionPolicyConfig, WafPolicyConfig, AIReviewResult, RouteMatch, ConflictResult } from '@/types';

export const routesApi = {
  list: async (
    projectId: string,
    domainId: string,
    page = 1,
    limit = 20,
    teamId?: string,
    status?: string,
    search?: string,
    searchField?: 'all' | 'name' | 'path' | 'owner',
    labels?: string
  ): Promise<PaginatedResponse<Route>> => {
    const response = await apiClient.get<PaginatedResponse<Route>>(
      `/projects/${projectId}/domains/${domainId}/routes`,
      { params: { page, limit, teamId, status, search, searchField, labels } }
    );
    return response.data;
  },

  get: async (projectId: string, domainId: string, routeId: string): Promise<Route> => {
    const response = await apiClient.get<Route>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}`
    );
    return response.data;
  },

  create: async (projectId: string, domainId: string, data: CreateRouteInput): Promise<RouteWithWarnings> => {
    const response = await apiClient.post<RouteWithWarnings>(
      `/projects/${projectId}/domains/${domainId}/routes`,
      data
    );
    return response.data;
  },

  update: async (
    projectId: string,
    domainId: string,
    routeId: string,
    data: { description?: string; config: RouteConfig; securityPolicy?: SecurityPolicyInput; backendTrafficPolicy?: BackendTrafficPolicyInput; extensionPolicy?: EnvoyExtensionPolicyConfig; wafPolicy?: WafPolicyConfig; changeDescription?: string; aiReview?: AIReviewResult; labels?: Record<string, string> }
  ): Promise<RouteWithWarnings> => {
    const response = await apiClient.put<RouteWithWarnings>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}`,
      data
    );
    return response.data;
  },

  delete: async (projectId: string, domainId: string, routeId: string): Promise<Route> => {
    const response = await apiClient.delete<Route>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}`
    );
    return response.data;
  },

  getYaml: async (projectId: string, domainId: string, routeId: string): Promise<string> => {
    const response = await apiClient.get<string>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/yaml`,
      { responseType: 'text' as const }
    );
    return response.data;
  },

  getYamls: async (
    projectId: string,
    domainId: string,
    routeId: string
  ): Promise<{
    httpRouteYaml: string;
    securityPolicyYaml?: string;
    backendTrafficPolicyYaml?: string;
    envoyExtensionPolicyYaml?: string;
    backendYaml?: string;
    httpRouteFilterYaml?: string;
    configMapYaml?: string;
    apiKeyClientResources?: Array<{
      clientId: string;
      clientName: string;
      httpRouteYaml: string;
      securityPolicyYaml: string;
      backendTrafficPolicyYaml?: string;
      envoyExtensionPolicyYaml?: string;
    }>;
  }> => {
    const response = await apiClient.get<{
      httpRouteYaml: string;
      securityPolicyYaml?: string;
      backendTrafficPolicyYaml?: string;
      envoyExtensionPolicyYaml?: string;
      backendYaml?: string;
      httpRouteFilterYaml?: string;
      configMapYaml?: string;
      apiKeyClientResources?: Array<{
        clientId: string;
        clientName: string;
        httpRouteYaml: string;
        securityPolicyYaml: string;
        backendTrafficPolicyYaml?: string;
        envoyExtensionPolicyYaml?: string;
      }>;
    }>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/yamls`
    );
    return response.data;
  },

  deploy: async (projectId: string, domainId: string, routeId: string): Promise<Route> => {
    const response = await apiClient.post<Route>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/deploy`
    );
    return response.data;
  },

  // Preview endpoints for diff visualization
  previewCreate: async (
    projectId: string,
    domainId: string,
    data: CreateRouteInput & { securityPolicy?: { cors?: CORSFilter }; backendTrafficPolicy?: BackendTrafficPolicyInput; extensionPolicy?: EnvoyExtensionPolicyConfig }
  ): Promise<{ proposedYaml: string; proposedSecurityPolicyYaml?: string; proposedBackendTrafficPolicyYaml?: string; proposedEnvoyExtensionPolicyYaml?: string; proposedBackendYaml?: string; proposedHttpRouteFilterYaml?: string; proposedConfigMapYaml?: string }> => {
    const response = await apiClient.post<{ proposedYaml: string; proposedSecurityPolicyYaml?: string; proposedBackendTrafficPolicyYaml?: string; proposedEnvoyExtensionPolicyYaml?: string; proposedBackendYaml?: string; proposedHttpRouteFilterYaml?: string; proposedConfigMapYaml?: string }>(
      `/projects/${projectId}/domains/${domainId}/routes/preview`,
      data
    );
    return response.data;
  },

  previewUpdate: async (
    projectId: string,
    domainId: string,
    routeId: string,
    data: { description?: string; config: RouteConfig; securityPolicy?: SecurityPolicyInput; backendTrafficPolicy?: BackendTrafficPolicyInput; extensionPolicy?: EnvoyExtensionPolicyConfig; wafPolicy?: WafPolicyConfig }
  ): Promise<{ currentYaml: string; proposedYaml: string; currentSecurityPolicyYaml?: string; proposedSecurityPolicyYaml?: string; currentBackendTrafficPolicyYaml?: string; proposedBackendTrafficPolicyYaml?: string; currentEnvoyExtensionPolicyYaml?: string; proposedEnvoyExtensionPolicyYaml?: string; currentBackendYaml?: string; proposedBackendYaml?: string; currentHttpRouteFilterYaml?: string; proposedHttpRouteFilterYaml?: string; currentConfigMapYaml?: string; proposedConfigMapYaml?: string }> => {
    const response = await apiClient.post<{ currentYaml: string; proposedYaml: string; currentSecurityPolicyYaml?: string; proposedSecurityPolicyYaml?: string; currentBackendTrafficPolicyYaml?: string; proposedBackendTrafficPolicyYaml?: string; currentEnvoyExtensionPolicyYaml?: string; proposedEnvoyExtensionPolicyYaml?: string; currentBackendYaml?: string; proposedBackendYaml?: string; currentHttpRouteFilterYaml?: string; proposedHttpRouteFilterYaml?: string; currentConfigMapYaml?: string; proposedConfigMapYaml?: string }>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/preview`,
      data
    );
    return response.data;
  },

  previewDelete: async (
    projectId: string,
    domainId: string,
    routeId: string
  ): Promise<{ currentYaml: string; currentSecurityPolicyYaml?: string; currentBackendTrafficPolicyYaml?: string; currentEnvoyExtensionPolicyYaml?: string; currentBackendYaml?: string; currentHttpRouteFilterYaml?: string; currentConfigMapYaml?: string }> => {
    const response = await apiClient.get<{ currentYaml: string; currentSecurityPolicyYaml?: string; currentBackendTrafficPolicyYaml?: string; currentEnvoyExtensionPolicyYaml?: string; currentBackendYaml?: string; currentHttpRouteFilterYaml?: string; currentConfigMapYaml?: string }>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/preview-delete`
    );
    return response.data;
  },

  // Get effective IP allowlist from active client attachments
  getEffectiveIPs: async (
    projectId: string,
    domainId: string,
    routeId: string
  ): Promise<EffectiveIPEntry[]> => {
    const response = await apiClient.get<EffectiveIPEntry[]>(
      `/projects/${projectId}/domains/${domainId}/routes/${routeId}/effective-ips`
    );
    return response.data;
  },

  checkConflicts: async (
    projectId: string,
    domainId: string,
    match: RouteMatch,
    excludeRouteId?: string
  ): Promise<ConflictResult[]> => {
    const response = await apiClient.post<{ conflicts: ConflictResult[] }>(
      `/projects/${projectId}/domains/${domainId}/routes/check-conflicts`,
      { match, ...(excludeRouteId ? { excludeRouteId } : {}) }
    );
    return response.data.conflicts ?? [];
  },
};
