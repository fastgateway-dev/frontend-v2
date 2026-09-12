import apiClient from './client';
import type {
  OpenAPIImportRequest,
  OpenAPIImportResponse,
} from '@/types';

export const openapiImportApi = {
  parse: async (
    projectId: string,
    domainId: string,
    request: OpenAPIImportRequest,
  ): Promise<OpenAPIImportResponse> => {
    const res = await apiClient.post<OpenAPIImportResponse>(
      `/projects/${projectId}/domains/${domainId}/import/openapi`,
      request,
    );
    return res.data;
  },
};
