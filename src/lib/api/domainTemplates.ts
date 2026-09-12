import apiClient from './client';
import type { DomainTemplate, CreateDomainTemplateInput, PaginatedResponse, DomainTemplateManifests, DomainTemplatePreviewResult, DomainTemplateCreatePreviewResult, Domain } from '@/types';

export const domainTemplatesApi = {
  list: async (projectId: string, page = 1, limit = 20): Promise<PaginatedResponse<DomainTemplate>> => {
    const response = await apiClient.get<PaginatedResponse<DomainTemplate>>(
      `/projects/${projectId}/domain-templates`,
      { params: { page, limit } }
    );
    return response.data;
  },

  get: async (projectId: string, domainTemplateId: string): Promise<DomainTemplate> => {
    const response = await apiClient.get<DomainTemplate>(
      `/projects/${projectId}/domain-templates/${domainTemplateId}`
    );
    return response.data;
  },

  create: async (projectId: string, data: CreateDomainTemplateInput): Promise<DomainTemplate> => {
    const response = await apiClient.post<DomainTemplate>(
      `/projects/${projectId}/domain-templates`,
      data
    );
    return response.data;
  },

  update: async (
    projectId: string,
    domainTemplateId: string,
    data: Partial<CreateDomainTemplateInput>
  ): Promise<DomainTemplate> => {
    const response = await apiClient.patch<DomainTemplate>(
      `/projects/${projectId}/domain-templates/${domainTemplateId}`,
      data
    );
    return response.data;
  },

  delete: async (projectId: string, domainTemplateId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/domain-templates/${domainTemplateId}`);
  },

  getManifests: async (projectId: string, domainTemplateId: string): Promise<DomainTemplateManifests> => {
    const response = await apiClient.get<DomainTemplateManifests>(
      `/projects/${projectId}/domain-templates/${domainTemplateId}/manifests`
    );
    return response.data;
  },

  previewChanges: async (
    projectId: string,
    domainTemplateId: string,
    data: Partial<CreateDomainTemplateInput>,
    options?: { includeAIReview?: boolean; changeDescription?: string }
  ): Promise<DomainTemplatePreviewResult> => {
    const response = await apiClient.post<DomainTemplatePreviewResult>(
      `/projects/${projectId}/domain-templates/${domainTemplateId}/preview-changes`,
      {
        ...data,
        includeAIReview: options?.includeAIReview || false,
        changeDescription: options?.changeDescription || '',
      }
    );
    return response.data;
  },

  previewCreate: async (
    projectId: string,
    data: CreateDomainTemplateInput,
    options?: { includeAIReview?: boolean; changeDescription?: string }
  ): Promise<DomainTemplateCreatePreviewResult> => {
    const response = await apiClient.post<DomainTemplateCreatePreviewResult>(
      `/projects/${projectId}/domain-templates/preview-create`,
      {
        ...data,
        includeAIReview: options?.includeAIReview || false,
        changeDescription: options?.changeDescription || '',
      }
    );
    return response.data;
  },

  listDomains: async (projectId: string, domainTemplateId: string): Promise<{ data: Domain[] }> => {
    const response = await apiClient.get<{ data: Domain[] }>(
      `/projects/${projectId}/domain-templates/${domainTemplateId}/domains`
    );
    return response.data;
  },
};
