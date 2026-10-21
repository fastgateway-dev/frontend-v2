// Stream-create "Entry point" panel: what a new stream on the selected template
// lands on. Read-only; the server's create 400/409 stays authoritative. The page
// owns the fetch so the port picker can share the same entry point.

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { StreamEntrypoint } from '@/types';
import { entrypointLabel, freePortCount, rangeSize, withDefaultReserved } from '@/lib/utils/stream-entrypoint';

interface Props {
  /** null while loading (or when the load failed, see `error`). */
  entrypoint: StreamEntrypoint | null;
  error: string | null;
}

export function TemplateEntrypointSummary({ entrypoint, error }: Props) {
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

  const { mode, portRange } = entrypoint;
  const label = entrypointLabel(mode);
  const rangeText = portRange ? `${portRange.min}–${portRange.max}` : null;
  const free = freePortCount(portRange, entrypoint.ports, withDefaultReserved(entrypoint.reserved));

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
          {entrypoint.address || 'assigned on first deploy'}).
          {portRange && free != null
            ? ` ${free} of ${rangeSize(portRange)} ports free in ${rangeText}.`
            : ' This template has no TCP/UDP port range.'}
        </p>
      )}
    </div>
  );
}
