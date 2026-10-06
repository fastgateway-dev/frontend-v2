'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal } from '@/components/ui';
import { DNSRecordFields } from '@/components/features/dns-record-fields';
import { dnsRecordsApi } from '@/lib/api/dns-records';
import { dnsZonesApi } from '@/lib/api/dns-zones';
import { dnsCredentialsApi } from '@/lib/api/dns-credentials';
import type { DomainDNSRecordListItem, DNSRecordType, DNSRecordStatus, DNSHostedZone, DNSProviderCredential } from '@/types';

function statusBadge(status: DNSRecordStatus): { variant: 'success' | 'warning' | 'error' | 'default'; label: string } {
  if (status === 'ready') return { variant: 'success', label: 'Ready' };
  if (status === 'pending') return { variant: 'warning', label: 'Pending' };
  if (status === 'error') return { variant: 'error', label: 'Error' };
  return { variant: 'default', label: status };
}

export default function DNSRecordsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [records, setRecords] = useState<DomainDNSRecordListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);

  // Edit modal state.
  const [editing, setEditing] = useState<DomainDNSRecordListItem | null>(null);
  const [zones, setZones] = useState<DNSHostedZone[]>([]);
  const [credentials, setCredentials] = useState<DNSProviderCredential[]>([]);
  const [editHostedZoneId, setEditHostedZoneId] = useState('');
  const [editRecordType, setEditRecordType] = useState<DNSRecordType>('auto');
  const [editTtl, setEditTtl] = useState('');
  const [editProxied, setEditProxied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoadFailed, setEditLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRecords(await dnsRecordsApi.list(projectId));
    } catch {
      setError('Failed to load DNS records.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async (row: DomainDNSRecordListItem) => {
    setBusyDomainId(row.domainId);
    try {
      await dnsRecordsApi.refresh(projectId, row.domainId);
      await load();
    } finally {
      setBusyDomainId(null);
    }
  };

  const handleDelete = async (row: DomainDNSRecordListItem) => {
    if (!window.confirm(`Delete the DNS record for ${row.domainHostname}?`)) return;
    setBusyDomainId(row.domainId);
    try {
      await dnsRecordsApi.remove(projectId, row.domainId);
      await load();
    } finally {
      setBusyDomainId(null);
    }
  };

  const openEdit = async (row: DomainDNSRecordListItem) => {
    setEditing(row);
    setEditHostedZoneId(row.hostedZoneId);
    setEditRecordType(row.recordType);
    setEditTtl(row.ttl != null ? String(row.ttl) : '');
    setEditProxied(row.proxied);
    setEditError(null);
    setEditLoadFailed(false);
    try {
      const [z, c] = await Promise.all([dnsZonesApi.list(), dnsCredentialsApi.list()]);
      setZones(z);
      setCredentials(c);
    } catch {
      // Without the zones/credentials we can't show the zone options or tell
      // whether the zone is Cloudflare (which drives proxied) — block the save
      // rather than silently writing a wrong payload.
      setZones([]);
      setCredentials([]);
      setEditLoadFailed(true);
      setEditError("Couldn't load hosted zones. Close and try again.");
    }
  };

  const providerTypeForZone = (zoneId: string): string | undefined => {
    const zone = zones.find((z) => z.id === zoneId);
    const cred = credentials.find((cr) => cr.id === zone?.providerCredentialId);
    return cred?.providerType;
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setIsSaving(true);
    setEditError(null);
    try {
      const isCloudflare = providerTypeForZone(editHostedZoneId) === 'cloudflare';
      await dnsRecordsApi.update(projectId, editing.domainId, {
        hostedZoneId: editHostedZoneId || undefined,
        recordType: editRecordType,
        ttl: editTtl === '' ? undefined : Number(editTtl),
        proxied: isCloudflare ? editProxied : false,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to save DNS record.');
    } finally {
      setIsSaving(false);
    }
  };

  const zoneOptions = zones.map((z) => {
    const cred = credentials.find((cr) => cr.id === z.providerCredentialId);
    return { value: z.id, label: `${z.name}${cred ? ` (${cred.providerType})` : ''}` };
  });
  const editShowProxied = providerTypeForZone(editHostedZoneId) === 'cloudflare';

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">DNS Records</h1>
        <p className="text-sm text-gray-500">
          Every DNS record FastGateway manages across this project&apos;s domains.
        </p>
      </div>

      {error ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
      ) : isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 py-6 text-center">
              No DNS records yet. Enable DNS on a domain to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">Zone</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const badge = statusBadge(row.status);
                  const busy = busyDomainId === row.domainId;
                  return (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 font-medium text-gray-900">{row.domainHostname}</td>
                      <td className="px-4 py-2">{row.recordType}</td>
                      <td className="px-4 py-2 font-mono text-xs">{row.resolvedTarget || '—'}</td>
                      <td className="px-4 py-2">{row.zoneName || '—'}</td>
                      <td className="px-4 py-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleRefresh(row)} disabled={busy}>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Refresh
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(row)} disabled={busy}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(row)} disabled={busy}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={`Edit DNS record${editing ? ` — ${editing.domainHostname}` : ''}`}>
        <div className="px-6 py-4 space-y-4">
          <DNSRecordFields
            zoneOptions={zoneOptions}
            hostedZoneId={editHostedZoneId}
            onHostedZoneChange={setEditHostedZoneId}
            recordType={editRecordType}
            onRecordTypeChange={setEditRecordType}
            ttl={editTtl}
            onTtlChange={setEditTtl}
            proxied={editProxied}
            onProxiedChange={setEditProxied}
            showProxied={editShowProxied}
          />
          {editError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{editError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editHostedZoneId || editLoadFailed}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
