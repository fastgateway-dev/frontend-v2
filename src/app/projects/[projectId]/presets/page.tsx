'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Shield, Trash2, Pencil, Lock } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal, Input, Checkbox } from '@/components/ui';
import { presetsApi } from '@/lib/api';
import type { PermissionPreset, CreatePresetInput, UpdatePresetInput } from '@/types';

// Permission groups organized by domain
const PERMISSION_GROUPS = [
  {
    domain: 'Route',
    permissions: [
      { value: 'route.view', label: 'View', description: 'View routes' },
      { value: 'route.create', label: 'Create', description: 'Create new routes' },
      { value: 'route.edit', label: 'Edit', description: 'Edit existing routes' },
      { value: 'route.delete', label: 'Delete', description: 'Delete routes' },
      { value: 'route.deploy', label: 'Deploy', description: 'Deploy routes to Kubernetes' },
      { value: 'route.approve', label: 'Approve', description: 'Approve/reject route changes' },
    ],
  },
  {
    domain: 'Client',
    permissions: [
      { value: 'client.view', label: 'View', description: 'View clients' },
      { value: 'client.create', label: 'Create', description: 'Create new clients' },
      { value: 'client.edit', label: 'Edit', description: 'Edit existing clients' },
      { value: 'client.delete', label: 'Delete', description: 'Delete clients' },
      { value: 'client.manage_ip', label: 'Manage IPs', description: 'Manage client IP allowlists' },
      { value: 'client.manage_apikey', label: 'Manage API Keys', description: 'Manage client API keys' },
      { value: 'client.manage_jwt', label: 'Manage JWT', description: 'Manage client JWT settings' },
      { value: 'client.attach', label: 'Attach', description: 'Attach clients to routes' },
      { value: 'client.detach', label: 'Detach', description: 'Detach clients from routes' },
      { value: 'client.approve', label: 'Approve', description: 'Approve/reject client attachments' },
    ],
  },
  {
    domain: 'Domain',
    permissions: [
      { value: 'domain.view', label: 'View', description: 'View domains' },
      { value: 'domain.create', label: 'Create', description: 'Create new domains' },
      { value: 'domain.edit', label: 'Edit', description: 'Edit existing domains' },
      { value: 'domain.delete', label: 'Delete', description: 'Delete domains' },
    ],
  },
  {
    domain: 'Certificate',
    permissions: [
      { value: 'certificate.view', label: 'View', description: 'View certificates' },
      { value: 'certificate.create', label: 'Create', description: 'Create new certificates' },
      { value: 'certificate.edit', label: 'Edit', description: 'Edit existing certificates' },
      { value: 'certificate.delete', label: 'Delete', description: 'Delete certificates' },
      { value: 'certificate.approve', label: 'Approve', description: 'Approve/reject certificate issuance & export' },
    ],
  },
  {
    domain: 'Project',
    permissions: [
      { value: 'project.settings', label: 'Settings', description: 'Manage project settings' },
      { value: 'project.teams', label: 'Teams', description: 'Manage team assignments' },
      { value: 'project.approval_policy', label: 'Approval Policy', description: 'Manage approval policies' },
    ],
  },
  {
    domain: 'Audit',
    permissions: [
      { value: 'audit.view', label: 'View', description: 'View audit logs' },
    ],
  },
];

function PermissionGrid({
  disabled = false,
  formPermissions,
  togglePermission,
  toggleAllInGroup,
}: {
  disabled?: boolean;
  formPermissions: string[];
  togglePermission: (perm: string) => void;
  toggleAllInGroup: (group: (typeof PERMISSION_GROUPS)[number]) => void;
}) {
  return (
    <div className="space-y-6">
      {PERMISSION_GROUPS.map((group) => {
        const groupPerms = group.permissions.map((p) => p.value);
        const selectedCount = groupPerms.filter((p) => formPermissions.includes(p)).length;
        const allSelected = selectedCount === groupPerms.length;
        const someSelected = selectedCount > 0 && selectedCount < groupPerms.length;

        return (
          <div key={group.domain} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={() => toggleAllInGroup(group)}
                disabled={disabled}
              />
              <h4 className="font-semibold text-gray-900">{group.domain}</h4>
              <span className="text-sm text-gray-500">
                ({selectedCount}/{groupPerms.length})
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pl-6">
              {group.permissions.map((perm) => (
                <label
                  key={perm.value}
                  className={`flex items-start gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Checkbox
                    checked={formPermissions.includes(perm.value)}
                    onChange={() => togglePermission(perm.value)}
                    disabled={disabled}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{perm.label}</div>
                    <div className="text-xs text-gray-500">{perm.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PresetsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [presets, setPresets] = useState<PermissionPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PermissionPreset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await presetsApi.list(projectId);
      setPresets(data || []);
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      const data = await presetsApi.list(projectId);
      setPresets(data || []);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPermissions([]);
    setError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (preset: PermissionPreset) => {
    setSelectedPreset(preset);
    setFormName(preset.name);
    setFormDescription(preset.description || '');
    setFormPermissions([...preset.permissions]);
    setError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (preset: PermissionPreset) => {
    setSelectedPreset(preset);
    setError(null);
    setShowDeleteModal(true);
  };

  const handleCreatePreset = async () => {
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }
    if (formPermissions.length === 0) {
      setError('At least one permission is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const input: CreatePresetInput = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        permissions: formPermissions,
      };
      await presetsApi.create(projectId, input);
      setShowCreateModal(false);
      resetForm();
      loadPresets();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      console.error('Failed to create preset:', error);
      setError(error.response?.data?.error || 'Failed to create preset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePreset = async () => {
    if (!selectedPreset) return;

    if (!formName.trim()) {
      setError('Name is required');
      return;
    }
    if (formPermissions.length === 0) {
      setError('At least one permission is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const input: UpdatePresetInput = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        permissions: formPermissions,
      };
      await presetsApi.update(projectId, selectedPreset.id, input);
      setShowEditModal(false);
      setSelectedPreset(null);
      resetForm();
      loadPresets();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      console.error('Failed to update preset:', error);
      setError(error.response?.data?.error || 'Failed to update preset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPreset) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await presetsApi.delete(projectId, selectedPreset.id);
      setShowDeleteModal(false);
      setSelectedPreset(null);
      loadPresets();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      console.error('Failed to delete preset:', error);
      setError(error.response?.data?.error || 'Failed to delete preset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (perm: string) => {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleAllInGroup = (group: typeof PERMISSION_GROUPS[number]) => {
    const groupPerms = group.permissions.map((p) => p.value);
    const allSelected = groupPerms.every((p) => formPermissions.includes(p));

    if (allSelected) {
      setFormPermissions((prev) => prev.filter((p) => !groupPerms.includes(p)));
    } else {
      setFormPermissions((prev) => [...new Set([...prev, ...groupPerms])]);
    }
  };

  const getPresetBadge = (preset: PermissionPreset) => {
    if (preset.isBuiltin) {
      switch (preset.name) {
        case 'Viewer':
          return <Badge>Viewer</Badge>;
        case 'Editor':
          return <Badge variant="success">Editor</Badge>;
        case 'Approver':
          return <Badge variant="info">Approver</Badge>;
        case 'Admin':
          return <Badge variant="warning">Admin</Badge>;
        default:
          return <Badge variant="default">Built-in</Badge>;
      }
    }
    return <Badge variant="default">Custom</Badge>;
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
          <h1 className="text-2xl font-bold text-gray-900">Permission Presets</h1>
          <p className="text-gray-600 mt-1">
            Create custom permission presets to assign to teams
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Create Preset
        </Button>
      </div>

      {presets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No presets</h3>
            <p className="text-gray-600 mb-4">
              Create permission presets to easily assign permissions to teams.
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Create Preset
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {presets.map((preset) => (
            <Card key={preset.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      preset.isBuiltin ? 'bg-gray-100' : 'bg-purple-100'
                    }`}>
                      {preset.isBuiltin ? (
                        <Lock className="h-5 w-5 text-gray-600" />
                      ) : (
                        <Shield className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{preset.name}</h3>
                        {getPresetBadge(preset)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {preset.description || `${preset.permissions.length} permissions`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {preset.permissions.slice(0, 5).join(', ')}
                        {preset.permissions.length > 5 && ` +${preset.permissions.length - 5} more`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!preset.isBuiltin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(preset)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteModal(preset)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {preset.isBuiltin && (
                      <span className="text-xs text-gray-400">Built-in preset</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Preset Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create Permission Preset"
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Route Manager"
          />

          <Input
            label="Description (optional)"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="e.g., Can manage routes but not approve"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <PermissionGrid
              formPermissions={formPermissions}
              togglePermission={togglePermission}
              toggleAllInGroup={toggleAllInGroup}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePreset} isLoading={isSubmitting}>
              Create Preset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Preset Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPreset(null);
          resetForm();
        }}
        title={`Edit Preset: ${selectedPreset?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Route Manager"
            disabled={selectedPreset?.isBuiltin}
          />

          <Input
            label="Description (optional)"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="e.g., Can manage routes but not approve"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <PermissionGrid
              disabled={selectedPreset?.isBuiltin}
              formPermissions={formPermissions}
              togglePermission={togglePermission}
              toggleAllInGroup={toggleAllInGroup}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setSelectedPreset(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePreset}
              isLoading={isSubmitting}
              disabled={selectedPreset?.isBuiltin}
            >
              Update Preset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Preset Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPreset(null);
          setError(null);
        }}
        title="Delete Preset"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <p className="text-gray-600">
            Are you sure you want to delete the preset{' '}
            <span className="font-semibold">{selectedPreset?.name}</span>?
            This action cannot be undone.
          </p>

          <p className="text-sm text-gray-500">
            Note: You cannot delete a preset that is currently assigned to teams.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedPreset(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeletePreset}
              isLoading={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Preset
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
