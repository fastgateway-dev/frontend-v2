import apiClient from './client';
import type { K8sNamespace, K8sService } from '@/types';

export const kubernetesApi = {
  listNamespaces: async (projectId: string): Promise<K8sNamespace[]> => {
    const response = await apiClient.get<K8sNamespace[]>(
      `/projects/${projectId}/kubernetes/namespaces`
    );
    return response.data;
  },

  listServices: async (projectId: string, namespace: string): Promise<K8sService[]> => {
    const response = await apiClient.get<K8sService[]>(
      `/projects/${projectId}/kubernetes/namespaces/${namespace}/services`
    );
    return response.data;
  },
};
