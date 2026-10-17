'use client';

// L4 route History tab: version list, compare two versions, rollback through
// approval. Mirrors the HTTP route detail History tab on the stream-scoped
// version endpoints.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitCompareArrows, History } from 'lucide-react';
import { Badge, Button, Checkbox, Modal } from '@/components/ui';
import { VersionCompareModal } from '@/components/version-compare-modal';
import { streamsApi } from '@/lib/api';
import type { RouteVersion } from '@/lib/api/route-versions';
import { comparePair, toggleVersionSelection } from '@/lib/utils/version-selection';
import { cn } from '@/lib/utils/cn';

interface Props {
  projectId: string;
  streamId: string;
  routeId: string;
  /** Rollback is offered only for an active route, as on HTTP routes. */
  routeStatus: string;
}

type ApiError = { response?: { data?: { error?: string } } };

export function L4RouteHistory({ projectId, streamId, routeId, routeStatus }: Props) {
  const router = useRouter();
  const [versions, setVersions] = useState<RouteVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [compare, setCompare] = useState<{ a: RouteVersion; b: RouteVersion } | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const load = async (nextPage: number) => {
    setIsLoading(true);
    try {
      const res = await streamsApi.listRouteVersions(projectId, streamId, routeId, nextPage);
      const rows = res.data || [];
      setVersions((prev) => (nextPage === 1 ? rows : [...prev, ...rows]));
      setTotal(res.total);
      setPage(nextPage);
    } catch (e: unknown) {
      setError((e as ApiError).response?.data?.error || 'Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, streamId, routeId]);

  const pair = comparePair(selected);

  const openCompare = async () => {
    if (!pair) return;
    setIsLoadingCompare(true);
    setError(null);
    try {
      const [a, b] = await Promise.all(pair.map((v) => streamsApi.getRouteVersion(projectId, streamId, routeId, v)));
      setCompare({ a, b });
    } catch {
      setError('Failed to load version details for comparison');
    } finally {
      setIsLoadingCompare(false);
    }
  };

  const confirmRollback = async () => {
    if (rollbackTarget == null) return;
    setIsRollingBack(true);
    setError(null);
    try {
      await streamsApi.rollbackRouteVersion(projectId, streamId, routeId, rollbackTarget);
      // The rollback is a new approval request, as on HTTP routes.
      router.push(`/projects/${projectId}/approvals`);
    } catch (e: unknown) {
      setError((e as ApiError).response?.data?.error || 'Failed to initiate rollback');
      setRollbackTarget(null);
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {isLoading && versions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Loading version history…</p>
      ) : versions.length === 0 ? (
        <div className="text-center py-8">
          <History className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No version history yet. Versions are created when a route is deployed.</p>
        </div>
      ) : (
        <>
          {pair && (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={openCompare} disabled={isLoadingCompare}>
                <GitCompareArrows className="h-4 w-4 mr-1" />
                {isLoadingCompare ? 'Loading...' : `Compare v${pair[0]} → v${pair[1]}`}
              </Button>
            </div>
          )}
          {versions.map((v, idx) => {
            const isCurrent = idx === 0;
            const isSelected = selected.includes(v.version);
            return (
              <div
                key={v.id}
                data-testid={`version-v${v.version}`}
                className={cn(
                  'flex items-start justify-between p-4 border rounded-lg',
                  isSelected && 'border-primary-300 bg-primary-50/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={`Select v${v.version}`}
                    checked={isSelected}
                    onChange={() => setSelected((prev) => toggleVersionSelection(prev, v.version))}
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">v{v.version}</span>
                      {isCurrent && <Badge variant="success">current</Badge>}
                    </div>
                    <p className="text-sm text-gray-500">
                      Deployed by {v.deployer?.username || 'unknown'} on {new Date(v.createdAt).toLocaleString()}
                    </p>
                    {v.changeDescription && (
                      <p className="text-sm text-gray-700 italic">&ldquo;{v.changeDescription}&rdquo;</p>
                    )}
                  </div>
                </div>
                {!isCurrent && routeStatus === 'active' && (
                  <Button variant="secondary" onClick={() => setRollbackTarget(v.version)} disabled={isRollingBack}>
                    Rollback
                  </Button>
                )}
              </div>
            );
          })}
          {total > versions.length && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" onClick={() => load(page + 1)} disabled={isLoading}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={rollbackTarget !== null}
        onClose={() => setRollbackTarget(null)}
        title={`Rollback to version ${rollbackTarget ?? ''}?`}
      >
        <p className="text-gray-600 mb-6">
          This will create a new approval request to revert the route configuration to version {rollbackTarget}. The
          rollback will not take effect until it is approved and deployed.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRollbackTarget(null)} disabled={isRollingBack}>
            Cancel
          </Button>
          <Button onClick={confirmRollback} isLoading={isRollingBack}>
            Confirm Rollback
          </Button>
        </div>
      </Modal>

      {compare && (
        <VersionCompareModal
          isOpen={true}
          onClose={() => {
            setCompare(null);
            setSelected([]);
          }}
          versionA={compare.a}
          versionB={compare.b}
        />
      )}
    </div>
  );
}
