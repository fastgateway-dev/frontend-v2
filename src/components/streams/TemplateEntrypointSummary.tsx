'use client';

// Stream-create "Entry point" panel: what a new stream on the selected template
// lands on. Read-only; the server's create 400/409 stays authoritative.

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui';
import { domainTemplatesApi } from '@/lib/api';
import type { StreamEntrypoint } from '@/types';
import {
  entrypointLabel,
  freePortCount,
  rangeSize,
  sharedWithSummary,
  withDefaultReserved,
} from '@/lib/utils/stream-entrypoint';

interface Props {
  projectId: string;
  templateId: string;
}

export function TemplateEntrypointSummary({ projectId, templateId }: Props) {
  const [entrypoint, setEntrypoint] = useState<StreamEntrypoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShared, setShowShared] = useState(false);

  useEffect(() => {
    // The cleanup flag drops a late response for a template the user already left.
    let cancelled = false;
    setEntrypoint(null);
    setError(null);
    setShowShared(false);
    domainTemplatesApi
      .getEntrypoint(projectId, templateId)
      .then((data) => {
        if (!cancelled) setEntrypoint(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error || 'request failed');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, templateId]);

  const box = 'p-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 space-y-2';

  if (error) {
    return (
      <div
        data-testid="entrypoint-summary"
        role="alert"
        className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Could not load the entry point for this template ({error}). You can still create the stream.</p>
        </div>
      </div>
    );
  }

  if (!entrypoint) {
    return (
      <div data-testid="entrypoint-summary" className={box}>
        Loading entry point…
      </div>
    );
  }

  const { mode, portRange, sharedWith } = entrypoint;
  const label = entrypointLabel(mode);
  const rangeText = portRange ? `${portRange.min}–${portRange.max}` : null;
  const free = freePortCount(portRange, entrypoint.ports, withDefaultReserved(entrypoint.reserved));
  const othersCount = sharedWith.streams.length + sharedWith.domains.length;

  return (
    <div data-testid="entrypoint-summary" className={box}>
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-gray-900">Entry point</h3>
        <Badge variant={mode === 'shared' ? 'info' : 'default'}>{label.badge}</Badge>
      </div>
      {mode === 'dedicated' ? (
        <p>
          This stream gets its own entry point and IP.
          {rangeText ? ` Routes can use ports ${rangeText}.` : ' This template has no TCP/UDP port range.'}
        </p>
      ) : (
        <p>
          This stream joins the shared entry point <code className="font-mono">{entrypoint.gatewayClass}</code> (IP{' '}
          {entrypoint.address || 'assigned on first deploy'}), also used by {sharedWithSummary(sharedWith)}.
          {portRange && free != null
            ? ` ${free} of ${rangeSize(portRange)} ports free in ${rangeText}.`
            : ' This template has no TCP/UDP port range.'}
        </p>
      )}
      {mode === 'shared' && othersCount > 0 && (
        <div>
          <button
            type="button"
            className="text-primary-600 hover:underline"
            onClick={() => setShowShared((v) => !v)}
          >
            {showShared ? 'Hide who shares it' : 'Show who shares it'}
          </button>
          {showShared && (
            <ul className="mt-1 list-disc pl-5" data-testid="shared-with-list">
              {sharedWith.streams.map((s) => (
                <li key={`s-${s.id}`}>Stream {s.name}</li>
              ))}
              {sharedWith.domains.map((d) => (
                <li key={`d-${d.id}`}>
                  Domain {d.name} ({d.hostname})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
