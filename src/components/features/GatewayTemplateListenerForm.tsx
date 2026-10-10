'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Input, Select } from '@/components/ui';
import { groupListeners, listenerIssue } from '@/lib/utils/gateway-listeners';
import type { ListenerProtocol, TemplateListener } from '@/types';

export interface GatewayTemplateListenerFormProps {
  value: TemplateListener[];
  onChange: (next: TemplateListener[]) => void;
  disabled?: boolean;
}

const STREAM_LISTENER_NAME = 'tcpudp';
const DEFAULT_RANGE = { min: 9000, max: 9100 };

function nextListenerName(listeners: TemplateListener[], prefix: string): string {
  const taken = new Set(listeners.map((l) => l.name));
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

function nextFreePort(listeners: TemplateListener[], protocol: ListenerProtocol): number {
  const used = new Set(listeners.map((l) => l.port));
  const candidates = protocol === 'HTTPS' ? [443, 8443, 9443] : [80, 8080, 8000];
  return candidates.find((p) => !used.has(p)) ?? 8081;
}

// Parses a number input; '' maps to undefined so the field can be cleared.
function parsePort(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

export function GatewayTemplateListenerForm({ value, onChange, disabled = false }: GatewayTemplateListenerFormProps) {
  const { http, tls, stream } = groupListeners(value);
  const issue = listenerIssue(value);

  const replace = (target: TemplateListener, next: TemplateListener) =>
    onChange(value.map((l) => (l === target ? next : l)));

  const remove = (target: TemplateListener) => onChange(value.filter((l) => l !== target));

  const addHttp = () => {
    const name = nextListenerName(value, 'http');
    onChange([...value, { name, protocol: 'HTTP', port: nextFreePort(value, 'HTTP') }]);
  };

  const changeProtocol = (l: TemplateListener, protocol: ListenerProtocol) => {
    if (protocol === 'HTTPS') {
      replace(l, { ...l, protocol, tlsMode: 'Terminate' });
    } else {
      const { tlsMode: _tlsMode, ...rest } = l;
      void _tlsMode;
      replace(l, { ...rest, protocol });
    }
  };

  const addRange = () =>
    onChange([
      ...value,
      { name: STREAM_LISTENER_NAME, protocol: 'TCP', portRangeMin: DEFAULT_RANGE.min, portRangeMax: DEFAULT_RANGE.max },
    ]);

  return (
    <div className="space-y-4">
      {/* HTTP / gRPC */}
      <section className="border border-gray-200 rounded-lg p-4 space-y-3" aria-labelledby="listeners-http-heading">
        <div>
          <h3 id="listeners-http-heading" className="text-sm font-semibold text-gray-900">HTTP / gRPC listeners</h3>
          <p className="text-xs text-gray-500 mt-1">
            Hostname-routed listeners. Whether a route speaks HTTP or gRPC is chosen per route, not per listener.
            HTTPS listeners terminate TLS at the gateway.
          </p>
        </div>

        {http.length === 0 && <p className="text-sm text-gray-500">No HTTP/HTTPS listeners.</p>}

        {http.map((l, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <Input
                aria-label={`Listener ${i + 1} name`}
                placeholder="Name"
                value={l.name}
                disabled={disabled}
                onChange={(e) => replace(l, { ...l, name: e.target.value })}
              />
            </div>
            <div className="w-32 flex-shrink-0">
              <Select
                aria-label={`Listener ${i + 1} protocol`}
                value={l.protocol}
                disabled={disabled}
                options={[
                  { value: 'HTTP', label: 'HTTP' },
                  { value: 'HTTPS', label: 'HTTPS' },
                ]}
                onChange={(e) => changeProtocol(l, e.target.value as ListenerProtocol)}
              />
            </div>
            <div className="w-28 flex-shrink-0">
              <Input
                aria-label={`Listener ${i + 1} port`}
                type="number"
                min={1}
                max={65535}
                placeholder="Port"
                value={l.port ?? ''}
                disabled={disabled}
                                onChange={(e) => replace(l, { ...l, port: parsePort(e.target.value) })}
              />
            </div>
            <div className="w-24 flex-shrink-0 pt-2">
              {l.protocol === 'HTTPS' && <Badge variant="info">Terminate</Badge>}
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove listener ${i + 1}`}
              disabled={disabled}
              onClick={() => remove(l)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="secondary" disabled={disabled} onClick={addHttp}>
          <Plus className="h-4 w-4 mr-2" />Add HTTP/HTTPS listener
        </Button>
      </section>

      {/* TLS passthrough (planned) */}
      <section
        className="border border-gray-200 rounded-lg p-4 bg-gray-50 opacity-70"
        aria-labelledby="listeners-tls-heading"
        aria-disabled="true"
      >
        <div className="flex items-center gap-2">
          <h3 id="listeners-tls-heading" className="text-sm font-semibold text-gray-700">TLS passthrough listeners</h3>
          <Badge variant="warning">Planned</Badge>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          TLS passthrough (SNI-routed, encrypted end to end) is not available yet. It will be configurable here in a future release.
        </p>
        {tls.length > 0 && (
          <ul className="mt-2 text-xs text-gray-600 list-disc ml-5">
            {tls.map((l) => (
              <li key={l.name}>{l.name} (TLS {l.port})</li>
            ))}
          </ul>
        )}
      </section>

      {/* TCP / UDP range */}
      <section className="border border-gray-200 rounded-lg p-4 space-y-3" aria-labelledby="listeners-stream-heading">
        <div>
          <h3 id="listeners-stream-heading" className="text-sm font-semibold text-gray-900">TCP / UDP port range</h3>
          <p className="text-xs text-gray-500 mt-1">
            Optional. Streams (TCP/UDP routes) may pick any port within this range. Only one range is allowed.
          </p>
        </div>

        {stream ? (
          <div className="flex items-start gap-2">
            <div className="w-32">
              <Input
                aria-label="TCP/UDP range minimum port"
                type="number"
                min={1}
                max={65535}
                placeholder="Min"
                value={stream.portRangeMin ?? ''}
                disabled={disabled}
                onChange={(e) => replace(stream, { ...stream, portRangeMin: parsePort(e.target.value) })}
              />
            </div>
            <span className="pt-2 text-gray-500">to</span>
            <div className="w-32">
              <Input
                aria-label="TCP/UDP range maximum port"
                type="number"
                min={1}
                max={65535}
                placeholder="Max"
                value={stream.portRangeMax ?? ''}
                disabled={disabled}
                onChange={(e) => replace(stream, { ...stream, portRangeMax: parsePort(e.target.value) })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Remove TCP/UDP range"
              disabled={disabled}
              onClick={() => remove(stream)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" disabled={disabled} onClick={addRange}>
            <Plus className="h-4 w-4 mr-2" />Add TCP/UDP port range
          </Button>
        )}
      </section>

      {issue && (
        <p className="text-sm text-red-600" role="alert">
          {issue}
        </p>
      )}
    </div>
  );
}
