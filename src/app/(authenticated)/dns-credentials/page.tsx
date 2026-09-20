'use client';

import { useState, useEffect } from 'react';
import { Plus, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal, Input, Select } from '@/components/ui';
import { dnsCredentialsApi } from '@/lib/api/dns-credentials';
import type { DNSProviderCredential } from '@/types';

const providerOptions = [{ value: 'cloudflare', label: 'Cloudflare' }];

function getProviderLabel(providerType: string): string {
  return providerType === 'cloudflare' ? 'Cloudflare' : providerType;
}

export default function DNSCredentialsPage() {
  const [credentials, setCredentials] = useState<DNSProviderCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DNSProviderCredential | null>(null);
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState('cloudflare');
  const [apiToken, setApiToken] = useState('');
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
      const data = await dnsCredentialsApi.list();
      setCredentials(data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load DNS credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setProviderType('cloudflare');
    setApiToken('');
    setFormErrors({});
    setSaveError(null);
  };

  const openCreateModal = () => {
    setEditing(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (credential: DNSProviderCredential) => {
    setEditing(credential);
    setName(credential.name);
    setProviderType(credential.providerType);
    setApiToken('');
    setFormErrors({});
    setSaveError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    resetForm();
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    if (!editing && !apiToken.trim()) {
      errors.apiToken = 'API Token is required';
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
      if (editing) {
        await dnsCredentialsApi.update(editing.id, {
          name: name.trim(),
          ...(apiToken.trim() ? { credentials: { apiToken: apiToken.trim() } } : {}),
        });
      } else {
        await dnsCredentialsApi.create({
          name: name.trim(),
          providerType: 'cloudflare',
          credentials: { apiToken: apiToken.trim() },
        });
      }
      closeModal();
      loadData();
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Failed to save DNS credential');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (credential: DNSProviderCredential) => {
    if (!confirm(`Are you sure you want to delete "${credential.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeleteError(null);
    setDeletingId(credential.id);
    try {
      await dnsCredentialsApi.delete(credential.id);
      loadData();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setDeleteError(err.response?.data?.error || 'This credential is in use and cannot be deleted');
      } else {
        setDeleteError(err.response?.data?.error || 'Failed to delete DNS credential');
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
          <h1 className="text-2xl font-bold text-gray-900">DNS Credentials</h1>
          <p className="text-gray-600 mt-1">
            Manage DNS provider credentials used for ACME DNS-01 challenges
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          New Credential
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

      {credentials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <KeyRound className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No DNS credentials yet.</h3>
            <p className="text-gray-600 mb-4">
              Add a DNS provider credential to enable DNS-01 challenges for certificate issuance.
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              New Credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials.map((credential) => (
            <Card key={credential.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <KeyRound className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{credential.name}</h3>
                        <Badge variant="info">{getProviderLabel(credential.providerType)}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Created {new Date(credential.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(credential)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(credential)}
                      disabled={deletingId === credential.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Credential Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editing ? 'Edit DNS Credential' : 'New DNS Credential'}
      >
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
            placeholder="e.g., Cloudflare Production"
            error={formErrors.name}
          />

          <Select
            label="Provider"
            value={providerType}
            onChange={(e) => setProviderType(e.target.value)}
            options={providerOptions}
          />

          <Input
            label="API Token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={editing ? '••••••••' : 'Enter API token'}
            error={formErrors.apiToken}
          />
          {editing && (
            <p className="text-xs text-gray-500 -mt-3">
              Leave blank to keep the current token
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              {editing ? 'Save Changes' : 'Create Credential'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
