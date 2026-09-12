import { useState, useEffect, useRef, useMemo } from 'react';
import { routesApi } from '@/lib/api/routes';
import type { RouteMatch, ConflictResult } from '@/types';

interface UseMatcherConflictCheckOptions {
  projectId: string;
  domainId: string;
  match: RouteMatch | null;
  excludeRouteId?: string;
}

interface UseMatcherConflictCheckReturn {
  conflicts: ConflictResult[];
  isChecking: boolean;
}

function isMatchEmpty(match: RouteMatch | null): boolean {
  if (!match) return true;
  const hasPath = match.path && match.path.value && match.path.value.length > 0;
  const hasGrpc = (match.grpcService && match.grpcService.value && match.grpcService.value.length > 0) ||
                  (match.grpcMethod && match.grpcMethod.value && match.grpcMethod.value.length > 0);
  return !hasPath && !hasGrpc;
}

export function useMatcherConflictCheck({
  projectId,
  domainId,
  match,
  excludeRouteId,
}: UseMatcherConflictCheckOptions): UseMatcherConflictCheckReturn {
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Used as a discard flag — when aborted, stale results are ignored.
  // The HTTP request itself is not cancelled (would require signal passthrough to axios).
  const abortRef = useRef<AbortController | null>(null);

  const matchKey = useMemo(() => JSON.stringify(match), [match]);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Mark previous request as stale
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // Skip if matcher is empty
    if (isMatchEmpty(match)) {
      setConflicts([]);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);

    // Debounce 500ms
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await routesApi.checkConflicts(
          projectId,
          domainId,
          match!,
          excludeRouteId
        );
        if (!controller.signal.aborted) {
          setConflicts(result);
          setIsChecking(false);
        }
      } catch {
        // Silently fail — backend validation is the safety net
        if (!controller.signal.aborted) {
          setConflicts([]);
          setIsChecking(false);
        }
      }
    }, 500);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [projectId, domainId, matchKey, excludeRouteId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { conflicts, isChecking };
}
