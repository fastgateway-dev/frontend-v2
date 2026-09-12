'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { StatTile } from './StatTile';
import { RpsChart } from './RpsChart';
import { LatencyChart } from './LatencyChart';
import { TopRoutesTable } from './TopRoutesTable';
import { TimeRangePicker } from './TimeRangePicker';
import { metricsApi } from '@/lib/api/metrics';
import type { RouteMetrics, DomainMetrics, MetricsRange } from '@/types';

type Kind = 'route' | 'domain';

interface MetricsTabProps {
  kind: Kind;
  projectId: string;
  domainId: string;
  routeId?: string;
  metricsConfigured: boolean;
  canEditProject: boolean;
}

export function MetricsTab({
  kind,
  projectId,
  domainId,
  routeId,
  metricsConfigured,
  canEditProject,
}: MetricsTabProps) {
  const [range, setRange] = useState<MetricsRange>('1h');
  const [data, setData] = useState<RouteMetrics | DomainMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!metricsConfigured) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      if (kind === 'route' && routeId) {
        const res = await metricsApi.getRouteMetrics(projectId, routeId, range);
        if (!controller.signal.aborted) setData(res);
      } else if (kind === 'domain') {
        const res = await metricsApi.getDomainMetrics(projectId, domainId, range);
        if (!controller.signal.aborted) setData(res);
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Failed to load metrics';
        setError(msg);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [kind, projectId, domainId, routeId, range, metricsConfigured]);

  useEffect(() => {
    fetchMetrics();
    return () => { abortRef.current?.abort(); };
  }, [fetchMetrics]);

  useEffect(() => {
    if (!metricsConfigured) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMetrics();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics, metricsConfigured]);

  if (!metricsConfigured) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-600">
          Observability isn&apos;t configured for this project.
        </p>
        {canEditProject && (
          <Link
            href={`/projects/${projectId}/settings#observability`}
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            Configure it →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <TimeRangePicker value={range} onChange={setRange} />
        <button
          type="button"
          onClick={fetchMetrics}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm text-red-800">
              <p className="font-medium">Couldn&apos;t load metrics</p>
              <p className="mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchMetrics}
              className="text-sm text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Total requests" value={Math.round(data.totalRequests).toLocaleString()} />
            <StatTile
              label="Error rate"
              value={`${data.errorRatePercent.toFixed(2)}%`}
              tone={data.errorRatePercent > 5 ? 'error' : data.errorRatePercent > 1 ? 'warning' : 'success'}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-sm font-medium text-gray-700">Requests per second</div>
            <RpsChart data={data.rps} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-sm font-medium text-gray-700">Latency percentiles (ms)</div>
            <LatencyChart data={data.latency} />
          </div>

          {kind === 'domain' && 'topRoutesByRps' in data && (
            <div className="grid grid-cols-2 gap-4">
              <TopRoutesTable
                title="Top 5 routes by RPS"
                entries={(data as DomainMetrics).topRoutesByRps}
                projectId={projectId}
                domainId={domainId}
                valueLabel="RPS"
              />
              <TopRoutesTable
                title="Top 5 routes by error rate"
                entries={(data as DomainMetrics).topRoutesByErrorRate}
                projectId={projectId}
                domainId={domainId}
                valueLabel="Error %"
                valueFormatter={(v) => `${v.toFixed(2)}%`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
