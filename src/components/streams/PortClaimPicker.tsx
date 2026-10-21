'use client';

import { useId, useMemo, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { Badge, Button, Input } from '@/components/ui';
import {
  claimProblem,
  claimProblemMessage,
  comparePorts,
  freePortCount,
  portLabel,
  withDefaultReserved,
} from '@/lib/utils/stream-entrypoint';
import type { ClaimContext } from '@/lib/utils/stream-entrypoint';
import type { EntrypointPort, PortRange, ReservedPort, TransportPort } from '@/types';

export interface LockedPort {
  port: TransportPort;
  /** Why this claim can't be removed, e.g. the route that uses it. */
  reason: string;
}

export interface PortClaimPickerProps {
  value: TransportPort[];
  onChange: (next: TransportPort[]) => void;
  range: PortRange | null;
  reserved: ReservedPort[];
  /** The entry point's port map. The stream's own rows (selfStreamId) are ignored. */
  taken: EntrypointPort[];
  selfStreamId?: string;
  /** Claims that can't be removed (a route uses them), each with the reason. */
  lockedPorts?: LockedPort[];
  error?: string;
  disabled?: boolean;
}

type Transport = 'TCP' | 'UDP';

const sameClaim = (a: TransportPort, b: TransportPort) =>
  a.port === b.port && a.transport.toUpperCase() === b.transport.toUpperCase();

/** Digits only is a port; anything else (empty aside) is flagged as invalid by claimProblem via NaN. */
function parsePort(raw: string): number {
  const t = raw.trim();
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export function PortClaimPicker({
  value,
  onChange,
  range,
  reserved,
  taken,
  selfStreamId,
  lockedPorts = [],
  error,
  disabled,
}: PortClaimPickerProps) {
  const uid = useId();
  const [transport, setTransport] = useState<Transport>('TCP');
  const [portInput, setPortInput] = useState('');

  const allReserved = useMemo(() => withDefaultReserved(reserved), [reserved]);
  const ctx: ClaimContext = useMemo(
    () => ({ range, reserved: allReserved, taken, selfStreamId }),
    [range, allReserved, taken, selfStreamId]
  );
  const sorted = useMemo(() => [...value].sort(comparePorts), [value]);

  // "N of M free": numbers in range that no reservation, other owner or current claim holds.
  // The stream's own rows in the port map are replaced by `value`, so removing a claim frees it here.
  const free = useMemo(() => {
    const others = taken.filter(
      (t) => !(selfStreamId && t.owner.kind === 'stream' && t.owner.streamId === selfStreamId)
    );
    return freePortCount(range, [...others, ...value], allReserved);
  }, [range, taken, selfStreamId, value, allReserved]);
  const total = range ? Math.max(0, range.max - range.min + 1) : 0;

  const trimmed = portInput.trim();
  const claim: TransportPort = { transport, port: parsePort(portInput) };
  const problem = trimmed ? claimProblem(claim, value, ctx) : null;
  const message = problem ? claimProblemMessage(problem, claim, ctx) : null;
  const canAdd = !disabled && trimmed !== '' && problem === null;

  const add = () => {
    if (!canAdd) return;
    onChange([...value, claim].sort(comparePorts));
    setPortInput('');
  };

  const lockReason = (p: TransportPort) => lockedPorts.find((l) => sameClaim(l.port, p))?.reason;
  const errorId = `${uid}-error`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <fieldset disabled={disabled}>
          <legend className="block text-sm font-medium text-gray-700 mb-1">Transport</legend>
          <div className="flex gap-6 py-2">
            {(['TCP', 'UDP'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="radio"
                  name={`${uid}-transport`}
                  value={t}
                  checked={transport === t}
                  onChange={() => setTransport(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="w-40">
          <Input
            id={`${uid}-port`}
            label="Port"
            inputMode="numeric"
            placeholder="e.g., 5432"
            value={portInput}
            disabled={disabled}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            onChange={(e) => setPortInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Keep Enter from submitting a surrounding form.
                e.preventDefault();
                add();
              }
            }}
          />
        </div>

        <Button type="button" variant="secondary" className="mt-7" disabled={!canAdd} onClick={add}>
          Add
        </Button>
      </div>

      {message && (
        <p id={errorId} className="text-sm text-red-500">
          {message}
        </p>
      )}

      {sorted.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Claimed ports">
          {sorted.map((p) => {
            const reason = lockReason(p);
            const label = portLabel(p);
            const reasonId = `${uid}-lock-${p.transport}-${p.port}`;
            return (
              <li key={`${p.transport}/${p.port}`}>
                <Badge
                  data-testid="port-claim-chip"
                  variant={reason ? 'info' : 'default'}
                  title={reason}
                  className="gap-1.5 font-mono"
                >
                  {label}
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    title={reason}
                    aria-describedby={reason ? reasonId : undefined}
                    disabled={disabled || !!reason}
                    onClick={() => onChange(value.filter((c) => !sameClaim(c, p)))}
                    className="-mr-1 rounded-full p-0.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    {reason ? <Lock className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </button>
                  {reason && (
                    <span id={reasonId} className="sr-only">
                      {reason}
                    </span>
                  )}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      {range && free !== null && (
        <p className="text-xs text-gray-500">
          Port range {range.min}–{range.max} · {free} of {total} free
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
