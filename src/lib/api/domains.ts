import apiClient from './client';
import type { Domain, CreateDomainInput, PaginatedResponse, DomainSettings, UpdateDomainSettingsInput, AIReviewResult, ListTLSSecretsResponse } from '@/types';

export interface DomainYAMLs {
  gatewayYaml: string;
  clientTrafficPolicyYaml?: string;
  backendTrafficPolicyYaml?: string;
  envoyExtensionPolicyYaml?: string;
}

export interface DomainSettingsPreviewResult {
  currentGatewayYaml: string;
  currentClientTrafficPolicyYaml: string;
  proposedClientTrafficPolicyYaml: string;
  currentBackendTrafficPolicyYaml?: string;
  proposedBackendTrafficPolicyYaml?: string;
  currentEnvoyExtensionPolicyYaml?: string;
  proposedEnvoyExtensionPolicyYaml?: string;
  aiReview?: AIReviewResult;
}

export interface DomainCreatePreviewResult {
  proposedGatewayYaml: string;
  aiReview?: AIReviewResult;
}

export interface AddDomainMTLSCAInput {
  name: string;
  caPem: string;
}

export const domainsApi = {
  list: async (
    projectId: string,
    page = 1,
    limit = 20,
    search?: string,
    status?: string,
    labels?: string
  ): Promise<PaginatedResponse<Domain>> => {
    const response = await apiClient.get<PaginatedResponse<Domain>>(`/projects/${projectId}/domains`, {
      params: { page, limit, search, status, labels },
    });
    return response.data;
  },

  get: async (projectId: string, domainId: string): Promise<Domain> => {
    const response = await apiClient.get<Domain>(`/projects/${projectId}/domains/${domainId}`);
    return response.data;
  },

  create: async (projectId: string, data: CreateDomainInput): Promise<Domain> => {
    const response = await apiClient.post<Domain>(`/projects/${projectId}/domains`, data);
    return response.data;
  },

  update: async (projectId: string, domainId: string, data: Partial<CreateDomainInput>): Promise<Domain> => {
    const response = await apiClient.patch<Domain>(`/projects/${projectId}/domains/${domainId}`, data);
    return response.data;
  },

  delete: async (projectId: string, domainId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/domains/${domainId}`);
  },

  // Domain Settings endpoints (gateway-agnostic configuration)
  getSettings: async (projectId: string, domainId: string): Promise<DomainSettings | null> => {
    const response = await apiClient.get<DomainSettings | null>(
      `/projects/${projectId}/domains/${domainId}/settings`
    );
    return response.data;
  },

  updateSettings: async (
    projectId: string,
    domainId: string,
    data: UpdateDomainSettingsInput
  ): Promise<DomainSettings | null> => {
    const response = await apiClient.put<DomainSettings | null>(
      `/projects/${projectId}/domains/${domainId}/settings`,
      data
    );
    return response.data;
  },

  // mTLS CA Management
  addMTLSCA: async (
    projectId: string,
    domainId: string,
    input: AddDomainMTLSCAInput
  ): Promise<DomainSettings> => {
    const response = await apiClient.post<DomainSettings>(
      `/projects/${projectId}/domains/${domainId}/settings/mtls/ca`,
      input
    );
    return response.data;
  },

  removeMTLSCA: async (
    projectId: string,
    domainId: string,
    caId: string
  ): Promise<DomainSettings> => {
    const response = await apiClient.delete<DomainSettings>(
      `/projects/${projectId}/domains/${domainId}/settings/mtls/ca/${caId}`
    );
    return response.data;
  },

  // Domain YAML manifests
  getYamls: async (projectId: string, domainId: string): Promise<DomainYAMLs> => {
    const response = await apiClient.get<DomainYAMLs>(
      `/projects/${projectId}/domains/${domainId}/yamls`
    );
    return response.data;
  },

  // Preview domain settings changes with AI review
  previewSettings: async (
    projectId: string,
    domainId: string,
    data: UpdateDomainSettingsInput & { description?: string; includeAIReview?: boolean }
  ): Promise<DomainSettingsPreviewResult> => {
    const response = await apiClient.post<DomainSettingsPreviewResult>(
      `/projects/${projectId}/domains/${domainId}/settings/preview`,
      data
    );
    return response.data;
  },

  // List TLS secrets available in a namespace
  listTLSSecrets: async (projectId: string, namespace?: string): Promise<ListTLSSecretsResponse> => {
    const params = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    const response = await apiClient.get<ListTLSSecretsResponse>(`/projects/${projectId}/domains/tls-secrets${params}`);
    return response.data;
  },

  // List namespaces available for domain deployment
  listAvailableNamespaces: async (projectId: string): Promise<{ namespaces: string[] }> => {
    const response = await apiClient.get<{ namespaces: string[] }>(`/projects/${projectId}/domains/available-namespaces`);
    return response.data;
  },

  // Preview domain creation (proposed Gateway YAML + AI review)
  previewCreate: async (
    projectId: string,
    data: CreateDomainInput & { description?: string; includeAIReview?: boolean }
  ): Promise<DomainCreatePreviewResult> => {
    const response = await apiClient.post<DomainCreatePreviewResult>(
      `/projects/${projectId}/domains/preview-create`,
      data
    );
    return response.data;
  },
};
