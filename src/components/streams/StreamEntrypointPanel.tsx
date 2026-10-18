'use client';

// Stream detail "Entry point" panel: mode, IP, who shares the entry point, and the
// port map (this stream's ports in full, neighbours collapsed, reserved ports,
// range and free count). Replaces the old "Load Balancer Address"/"Ports in use" cards.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Badge, Card, CardContent } from '@/components/ui';
import { streamsApi } from '@/lib/api';
import type { StreamEntrypoint } from '@/types';
import {
  distinctPortCount,
  entrypointLabel,
  freePortCount,
  ownerLabel,
  portLabel,
  rangeSize,
  reservedSummary,
  sharedWithSummary,
  splitPorts,
  withDefaultReserved,
} from '@/lib/utils/stream-entrypoint';
import { l4StatusBadge } from '@/lib/utils/l4route';

interface Props {
  projectId: string;
  streamId: string;
  /** Bump to re-fetch (e.g. after a deploy changed a route's status). */
  refreshKey?: number;
}

export function StreamEntrypointPanel({ projectId, streamId, refreshKey = 0 }: Props) {
  const [entrypoint, setEntrypoint] = useState<StreamEntrypoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShared, setShowShared] = useState(false);
  const [showNeighbors, setShowNeighbors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    streamsApi
      .getEntrypoint(projectId, streamId)
      .then((data) => {
        if (cancelled) return;
        setEntrypoint(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { error?: string } } };
        // Never guess a mode: show the failure instead of a partial panel.
        setEntrypoint(null);
        setError(err.response?.data?.error || 'request failed');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, streamId, refreshKey]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <div data-testid="entrypoint-panel" role="alert" className="flex items-start gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>Could not load the entry point: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!entrypoint) {
    return (
      <Card>
        <CardContent className="py-4">
          <div data-testid="entrypoint-panel" className="h-16 animate-pulse bg-gray-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const label = entrypointLabel(entrypoint.mode);
  const { mine, neighbors } = splitPorts(entrypoint.ports, streamId);
  const neighborPorts = distinctPortCount(neighbors);
  const reserved = withDefaultReserved(entrypoint.reserved);
  const range = entrypoint.portRange;
  const free = freePortCount(range, entrypoint.ports, reserved);
  const { streams: sharedStreams, domains: sharedDomains } = entrypoint.sharedWith;

  return (
    <Card>
      <CardContent className="py-4">
        <div data-testid="entrypoint-panel" className="space-y-4 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-500">Entry point</h3>
              <Badge variant={entrypoint.mode === 'shared' ? 'info' : 'default'}>{label.badge}</Badge>
            </div>
            <p className="mt-1 text-gray-700">{label.explanation}</p>
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <dt className="text-gray-500">IP</dt>
              <dd className="font-mono text-gray-900">
                {entrypoint.address || <span className="font-sans text-gray-400">not assigned yet</span>}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Gateway class</dt>
              <dd className="font-mono text-gray-900">{entrypoint.gatewayClass}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Template</dt>
              <dd className="text-gray-900">{entrypoint.templateName}</dd>
            </div>
          </dl>

          {entrypoint.mode === 'shared' && (
            <div>
              <p className="text-gray-700">
                Also used by {sharedWithSummary(entrypoint.sharedWith)}.{' '}
                {sharedStreams.length + sharedDomains.length > 0 && (
                  <button
                    type="button"
                    className="text-primary-600 hover:underline"
                    onClick={() => setShowShared((v) => !v)}
                  >
                    {showShared ? 'Hide who shares it' : 'Show who shares it'}
                  </button>
                )}
              </p>
              {showShared && (
                <ul data-testid="shared-with-list" className="mt-1 list-disc pl-5">
                  {sharedStreams.map((s) => (
                    <li key={`s-${s.id}`}>
                      Stream{' '}
                      <Link href={`/projects/${projectId}/streams/${s.id}`} className="text-primary-600 hover:underline">
                        {s.name}
                      </Link>
                    </li>
                  ))}
                  {sharedDomains.map((d) => (
                    <li key={`d-${d.id}`}>
                      Domain{' '}
                      <Link href={`/projects/${projectId}/domains/${d.id}`} className="text-primary-600 hover:underline">
                        {d.name}
                      </Link>{' '}
                      ({d.hostname})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <h4 className="font-medium text-gray-900">This stream&apos;s ports</h4>
            {mine.length === 0 ? (
              <p className="text-gray-500">No ports yet. Each route you add opens one port.</p>
            ) : (
              <ul data-testid="mine-ports" className="mt-1 space-y-1">
                {mine.map((p) => {
                  const badge = l4StatusBadge(p.owner.status || '');
                  return (
                    <li key={`${p.transport}-${p.port}`} className="flex items-center gap-2">
                      <span className="font-mono">{portLabel(p)}</span>
                      <span className="text-gray-400">→</span>
                      <Link
                        href={`/projects/${projectId}/streams/${streamId}/routes/${p.owner.routeId}`}
                        className="text-primary-600 hover:underline"
                      >
                        {p.owner.routeName || p.owner.routeId}
                      </Link>
                      {p.owner.status && <Badge variant={badge.variant}>{badge.label}</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {neighbors.length > 0 && (
            <div>
              <p className="text-gray-700">
                {neighborPorts} {neighborPorts === 1 ? 'port' : 'ports'} used by other streams/domains.{' '}
                <button
                  type="button"
                  className="text-primary-600 hover:underline"
                  onClick={() => setShowNeighbors((v) => !v)}
                >
                  {showNeighbors ? 'Hide other ports' : 'Show other ports'}
                </button>
              </p>
              {showNeighbors && (
                <ul data-testid="neighbor-ports" className="mt-1 space-y-1">
                  {neighbors.map((p) => (
                    <li key={`${p.transport}-${p.port}-${p.owner.routeId ?? p.owner.domainId ?? ''}`}>
                      <span className="font-mono">{portLabel(p)}</span>{' '}
                      <span className="text-gray-600">— {ownerLabel(p.owner)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p data-testid="reserved-ports" className="text-xs text-gray-500">
            Reserved: {reservedSummary(reserved).join(', ')}
          </p>
          <p data-testid="port-range" className="text-xs text-gray-500">
            {range && free != null
              ? `Port range ${range.min}–${range.max} · ${free} of ${rangeSize(range)} free`
              : 'This template has no TCP/UDP port range.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
