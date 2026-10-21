'use client';

// "Edit ports" on the stream detail page: replaces the stream's claimed
// (transport, port) set. Claims a route still uses are locked (the backend
// answers 409 if they are dropped).

import { useEffect, useMemo, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { streamsApi } from '@/lib/api';
import { PortClaimPicker } from '@/components/streams/PortClaimPicker';
import type { LockedPort } from '@/components/streams/PortClaimPicker';
import { comparePorts, myClaims } from '@/lib/utils/stream-entrypoint';
import type { Stream, StreamEntrypoint, TransportPort } from '@/types';

interface Props {
  projectId: string;
  stream: Stream;
  entrypoint: StreamEntrypoint;
  open: boolean;
  onClose: () => void;
  onSaved: (stream: Stream) => void;
}

const initialClaims = (stream: Stream): TransportPort[] =>
  (stream.ports ?? []).map(({ transport, port }) => ({ transport, port })).sort(comparePorts);

export function EditStreamPortsModal({ projectId, stream, entrypoint, open, onClose, onSaved }: Props) {
  const [ports, setPorts] = useState<TransportPort[]>(() => initialClaims(stream));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Start from the stream's current claims each time the modal opens.
  useEffect(() => {
    if (open) {
      setPorts(initialClaims(stream));
      setError(null);
    }
    // Re-seeding only on open: a background stream refresh must not wipe edits in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lockedPorts: LockedPort[] = useMemo(
    () =>
      myClaims(entrypoint.ports, stream.id)
        .filter((p) => p.owner.routeId || p.owner.routeName)
        .map((p) => ({
          port: { transport: p.transport, port: p.port },
          reason: `Used by route ${p.owner.routeName || p.owner.routeId}${p.owner.pending ? ' (pending change)' : ''}`,
        })),
    [entrypoint.ports, stream.id]
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await streamsApi.update(projectId, stream.id, { ports });
      onSaved(saved);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Failed to save ports');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit ports" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Routes can only use ports this stream has claimed. A port a route uses can&apos;t be removed.
        </p>
        <PortClaimPicker
          value={ports}
          onChange={(next) => {
            setPorts(next);
            setError(null);
          }}
          range={entrypoint.portRange ?? null}
          reserved={entrypoint.reserved ?? []}
          taken={entrypoint.ports ?? []}
          selfStreamId={stream.id}
          lockedPorts={lockedPorts}
          error={error ?? undefined}
          disabled={saving}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving} disabled={ports.length === 0}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
