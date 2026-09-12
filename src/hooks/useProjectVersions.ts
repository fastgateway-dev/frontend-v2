'use client';

import { useCallback, useEffect, useState } from 'react';
import { projectVersionsApi } from '@/lib/api/project-versions';
import type { ProjectVersionInfo } from '@/types/project-versions';

export interface UseProjectVersionsResult {
  data: ProjectVersionInfo | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProjectVersions(projectId: string | null | undefined): UseProjectVersionsResult {
  const [data, setData] = useState<ProjectVersionInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    projectVersionsApi
      .get(projectId)
      .then((info) => {
        if (!cancelled) setData(info);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed to load versions');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const info = await projectVersionsApi.refresh(projectId);
      setData(info);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId]);

  return { data, isLoading, isRefreshing, error, refresh };
}
