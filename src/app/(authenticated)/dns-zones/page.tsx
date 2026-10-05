'use client';

import { useState, useEffect } from 'react';
import { Plus, Network, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal, Input, Select } from '@/components/ui';
import { dnsZonesApi } from '@/lib/api/dns-zones';
import { dnsCredentialsApi } from '@/lib/api/dns-credentials';
import type { DNSHostedZone, DNSProviderCredential, DNSZoneStatus } from '@/types';

const PROVIDER_LABELS: Record<string, string> = {
  cloudflare: 'Cloudflare',
  route53: 'AWS Route53',
  google: 'Google Cloud DNS',
};

function getProviderLabel(providerType: string): string {
  return PROVIDER_LABELS[providerType] || providerType;
}

function ZoneStatusBadge({ status, statusMessage }: { status: DNSZoneStatus; statusMessage?: string }) {
  if (status === 'ready') {
    return <Badge variant="success">Ready</Badge>;
  }
  if (status === 'pending') {
    return <Badge variant="warning">Pending</Badge>;
  }
  return (
    <Badge variant="error" title={statusMessage || 'This hosted zone failed validation'}>
      Error
    </Badge>
  );
}

export default function DNSZonesPage() {
  const [zones, setZones] = useState<DNSHostedZone[]>([]);
  const [credentials, setCredentials] = useState<DNSProviderCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [providerCredentialId, setProviderCredentialId] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [zonesData, credentialsData] = await Promise.all([
        dnsZonesApi.list(),
        dnsCredentialsApi.list(),
      ]);
      setZones(zonesData || []);
      setCredentials(credentialsData || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load DNS hosted zones');
    } finally {
      setIsLoading(false);
    }
  };

  const credentialsById = credentials.reduce<Record<string, DNSProviderCredential>>((acc, cred) => {
    acc[cred.id] = cred;
    return acc;
  }, {});

  const credentialOptions = credentials.map((cred) => ({
    value: cred.id,
    label: `${cred.name} (${getProviderLabel(cred.providerType)})`,
  }));

  const resetForm = () => {
    setName('');
    setProviderCredentialId(credentials[0]?.id || '');
    setFormErrors({});
    setSaveError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    if (!providerCredentialId) {
      errors.providerCredentialId = 'A DNS credential is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setSaveError(null);
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    try {
      await dnsZonesApi.create({
        name: name.trim(),
        providerCredentialId,
      });
      closeModal();
      loadData();
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Failed to create DNS hosted zone');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (zone: DNSHostedZone) => {
    if (!confirm(`Are you sure you want to delete "${zone.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeleteError(null);
    setDeletingId(zone.id);
    try {
      await dnsZonesApi.remove(zone.id);
      loadData();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setDeleteError(
          err.response?.data?.error ||
            "This hosted zone is in use by one or more domains' DNS records. Disable DNS on those domains first."
        );
      } else {
        setDeleteError(err.response?.data?.error || 'Failed to delete DNS hosted zone');
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hosted Zones</h1>
          <p className="text-gray-600 mt-1">
            Manage DNS hosted zones used for direct provider DNS record management
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          New Hosted Zone
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {deleteError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {deleteError}
        </div>
      )}

      {zones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Network className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hosted zones yet.</h3>
            <p className="text-gray-600 mb-4">
              Register a hosted zone to let FastGateway manage DNS records directly with a
              provider credential.
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              New Hosted Zone
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {zones.map((zone) => {
            const credential = credentialsById[zone.providerCredentialId];
            return (
              <Card key={zone.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Network className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                          <ZoneStatusBadge status={zone.status} statusMessage={zone.statusMessage} />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {credential
                            ? `${credential.name} (${getProviderLabel(credential.providerType)})`
                            : `Unknown credential (${zone.providerCredentialId})`}
                        </p>
                        {zone.status === 'error' && zone.statusMessage && (
                          <p className="text-xs text-red-600 mt-0.5">{zone.statusMessage}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          Created {new Date(zone.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(zone)}
                        disabled={deletingId === zone.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Hosted Zone Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title="New Hosted Zone">
        <div className="space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {saveError}
            </div>
          )}

          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., example.com"
            error={formErrors.name}
          />

          {credentials.length === 0 ? (
            <p className="text-xs text-gray-500">
              No DNS credentials are registered yet. Register a credential first on the DNS
              Credentials page before creating a hosted zone.
            </p>
          ) : (
            <Select
              label="DNS Credential"
              value={providerCredentialId}
              onChange={(e) => setProviderCredentialId(e.target.value)}
              options={credentialOptions}
              error={formErrors.providerCredentialId}
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving} disabled={credentials.length === 0}>
              Create Hosted Zone
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
