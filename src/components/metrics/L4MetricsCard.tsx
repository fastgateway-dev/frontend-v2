'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { StatTile } from './StatTile';
import { streamsApi } from '@/lib/api';
import type { L4Metrics } from '@/types';

interface L4MetricsCardProps {
  projectId: string;
  streamId: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${i === 0 ? Math.round(v) : v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '0';
  return rate >= 10 ? Math.round(rate).toLocaleString() : rate.toFixed(2);
}

export function L4MetricsCard({ projectId, streamId }: L4MetricsCardProps) {
  const [data, setData] = useState<L4Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await streamsApi.getMetrics(projectId, streamId);
      if (controller.signal.aborted) return;
      setData(res);
      setNotConfigured(false);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const e = err as { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string };
      if (e.response?.status === 400) {
        // Project has no metrics endpoint configured: informational, not an error.
        setNotConfigured(true);
      } else {
        setError(e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to load metrics');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [projectId, streamId]);

  useEffect(() => {
    fetchMetrics();
    return () => { abortRef.current?.abort(); };
  }, [fetchMetrics]);

  useEffect(() => {
    if (notConfigured) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMetrics();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics, notConfigured]);

  if (notConfigured) {
    return (
      <div data-testid="l4-metrics-not-configured" className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          Metrics aren&apos;t configured for this project. Configure observability in project settings to see
          connection and throughput metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="l4-metrics">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Metrics</h2>
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
            <button type="button" onClick={fetchMetrics} className="text-sm text-red-700 underline hover:no-underline">
              Retry
            </button>
          </div>
        </div>
      )}

      {!data && loading && !error && (
        <div data-testid="l4-metrics-loading" className="grid grid-cols-2 gap-4 md:grid-cols-4 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-200" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Active connections" value={Math.round(data.activeConnections ?? 0).toLocaleString()} />
            <StatTile label="Connection rate (conns/sec)" value={formatRate(data.connectionRate ?? 0)} />
            <StatTile label="Bytes in" value={formatBytes(data.bytesIn ?? 0)} />
            <StatTile label="Bytes out" value={formatBytes(data.bytesOut ?? 0)} />
          </div>

          {(data.listeners ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No listener traffic yet.</p>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium text-gray-700">Per listener</div>
              <table className="w-full text-sm" data-testid="l4-metrics-listeners">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-4 font-medium">Port</th>
                    <th className="py-2 pr-4 font-medium">Protocol</th>
                    <th className="py-2 pr-4 font-medium">Active conns</th>
                    <th className="py-2 pr-4 font-medium">Conns/sec</th>
                    <th className="py-2 pr-4 font-medium">Bytes in</th>
                    <th className="py-2 font-medium">Bytes out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.listeners.map((l) => (
                    <tr key={`${l.protocol}-${l.port}`} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 font-mono text-gray-900">{l.port}</td>
                      <td className="py-2 pr-4 text-gray-600">{(l.protocol || '').toUpperCase()}</td>
                      <td className="py-2 pr-4 text-gray-600">{Math.round(l.activeConnections ?? 0).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatRate(l.connectionRate ?? 0)}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatBytes(l.bytesIn ?? 0)}</td>
                      <td className="py-2 text-gray-600">{formatBytes(l.bytesOut ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
