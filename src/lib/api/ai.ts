import { getTokens } from './client';
import apiClient from './client';
import type { AIStatus, AIGenerateRequest, AIStreamChunk, AIReviewRequest, AIReviewResult, AIChatRequest, AIConfig, AIConfigInput } from '@/types';

const API_BASE = '/api/v1';

export const aiApi = {
  getStatus: async (): Promise<AIStatus> => {
    const { accessToken } = getTokens();
    const response = await fetch(`${API_BASE}/ai/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to get AI status');
    }
    return response.json();
  },

  getConfig: async (): Promise<AIConfig> => {
    const response = await apiClient.get<AIConfig>('/settings/ai');
    return response.data;
  },

  updateConfig: async (input: AIConfigInput): Promise<AIConfig> => {
    const response = await apiClient.put<AIConfig>('/settings/ai', input);
    return response.data;
  },

  testConfig: async (input: AIConfigInput): Promise<{ ok: boolean }> => {
    const response = await apiClient.post<{ ok: boolean }>('/settings/ai/test', input);
    return response.data;
  },

  generate: (
    projectId: string,
    domainId: string,
    request: AIGenerateRequest,
    onChunk: (chunk: AIStreamChunk) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): AbortController => {
    const controller = new AbortController();
    const { accessToken } = getTokens();

    fetch(`${API_BASE}/projects/${projectId}/domains/${domainId}/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'AI generation failed');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const chunk: AIStreamChunk = JSON.parse(line.slice(6));
                onChunk(chunk);
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        onComplete();
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          onError(error);
        }
      });

    return controller;
  },

  review: async (
    projectId: string,
    domainId: string,
    request: AIReviewRequest
  ): Promise<AIReviewResult> => {
    const { accessToken } = getTokens();
    const response = await fetch(`${API_BASE}/projects/${projectId}/domains/${domainId}/ai/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'AI review failed' }));
      throw new Error(error.error || 'AI review failed');
    }
    return response.json();
  },

  reviewApproval: async (
    projectId: string,
    approvalId: string
  ): Promise<AIReviewResult> => {
    const { accessToken } = getTokens();
    const response = await fetch(`${API_BASE}/projects/${projectId}/approvals/${approvalId}/ai-review`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'AI review failed' }));
      throw new Error(error.error || 'AI review failed');
    }
    return response.json();
  },

  chat: (
    request: AIChatRequest,
    onChunk: (chunk: AIStreamChunk) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): AbortController => {
    const controller = new AbortController();
    const { accessToken } = getTokens();

    fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'AI chat failed');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const chunk: AIStreamChunk = JSON.parse(line.slice(6));
                onChunk(chunk);
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        onComplete();
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          onError(error);
        }
      });

    return controller;
  },
};
