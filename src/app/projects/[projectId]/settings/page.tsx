'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Settings, Plus, Trash2, Pencil, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Badge, Modal, Input, Select, Checkbox } from '@/components/ui';
import { projectsApi } from '@/lib/api';
import { metricsApi } from '@/lib/api/metrics';
import type { Project, ApprovalPolicy, PolicyStageTemplate } from '@/types';

// Valid permissions for approval stages, scoped by entity type.
// Spec: permission dropdown shows valid permissions for the selected entity type only.
const PERMISSIONS_BY_ENTITY: Record<string, { value: string; label: string }[]> = {
  route: [{ value: 'route.approve', label: 'Route Approve' }],
  client_attachment: [{ value: 'client.approve', label: 'Client Approve' }],
};

const defaultPermissionForEntity = (entityType: string): string =>
  PERMISSIONS_BY_ENTITY[entityType]?.[0]?.value ?? 'route.approve';

// Valid team scopes
const TEAM_SCOPES = [
  { value: 'any', label: 'Any Team' },
  { value: 'submitter_team', label: 'Submitter Team' },
  { value: 'other_team', label: 'Other Team' },
];

// Entity types
const ENTITY_TYPES = [
  { value: 'route', label: 'Route' },
  { value: 'client_attachment', label: 'Client Attachment' },
];

// Actions per entity type
const ACTIONS_BY_ENTITY: Record<string, { value: string; label: string }[]> = {
  route: [
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
  ],
  client_attachment: [
    { value: 'attach', label: 'Attach' },
    { value: 'detach', label: 'Detach' },
  ],
};

interface StageForm {
  order: number;
  requiredPermission: string;
  teamScope: string;
  minApprovers: number;
}

const defaultStage: StageForm = {
  order: 1,
  requiredPermission: 'route.approve',
  teamScope: 'any',
  minApprovers: 1,
};

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Approval settings state
  const [approvalEnabled, setApprovalEnabled] = useState(true);
  const [selfApprovalAllowed, setSelfApprovalAllowed] = useState(false);

  // Observability (metrics) state
  const [metricsEndpointUrl, setMetricsEndpointUrl] = useState('');
  const [metricsAuthType, setMetricsAuthType] = useState<'none' | 'bearer' | 'basic'>('none');
  const [metricsUsername, setMetricsUsername] = useState('');
  const [metricsPassword, setMetricsPassword] = useState('');
  const [metricsToken, setMetricsToken] = useState('');
  const [metricsTlsSkipVerify, setMetricsTlsSkipVerify] = useState(false);
  const [metricsCaCert, setMetricsCaCert] = useState('');
  const [metricsTestResult, setMetricsTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [metricsTesting, setMetricsTesting] = useState(false);
  const [metricsSaving, setMetricsSaving] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsSuccess, setMetricsSuccess] = useState<string | null>(null);

  // Policies state
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(true);

  // Policy modal state
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ApprovalPolicy | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<ApprovalPolicy | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  // Policy form state
  const [formEntityType, setFormEntityType] = useState('route');
  const [formAction, setFormAction] = useState<string>('');
  const [formStages, setFormStages] = useState<StageForm[]>([{ ...defaultStage }]);

  useEffect(() => {
    loadProject();
    loadPolicies();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setIsLoading(true);
      const data = await projectsApi.get(projectId);
      setProject(data);
      setApprovalEnabled(data.approvalEnabled);
      setSelfApprovalAllowed(data.selfApprovalAllowed);
      setMetricsEndpointUrl(data.metricsEndpointUrl ?? '');
      setMetricsAuthType(data.metricsAuthType ?? 'none');
      setMetricsUsername(data.metricsUsername ?? '');
      setMetricsTlsSkipVerify(data.metricsTlsSkipVerify ?? false);
      setMetricsCaCert(data.metricsCaCert ?? '');
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPolicies = async () => {
    try {
      setIsPoliciesLoading(true);
      const data = await projectsApi.listApprovalPolicies(projectId);
      setPolicies(data || []);
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      setIsPoliciesLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      await projectsApi.update(projectId, {
        approvalEnabled,
        selfApprovalAllowed,
      });
      setSettingsSuccess('Settings saved successfully');
      setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setSettingsError(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveObservability = async () => {
    setMetricsSaving(true);
    setMetricsError(null);
    setMetricsSuccess(null);
    try {
      await projectsApi.update(projectId, {
        metricsEndpointUrl,
        metricsAuthType,
        metricsUsername,
        metricsTlsSkipVerify,
        metricsCaCert,
        ...(metricsToken ? { metricsToken } : {}),
        ...(metricsPassword ? { metricsPassword } : {}),
      });
      setMetricsSuccess('Observability settings saved');
      setMetricsToken('');
      setMetricsPassword('');
      setTimeout(() => setMetricsSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMetricsError(error.response?.data?.error || 'Failed to save observability settings');
    } finally {
      setMetricsSaving(false);
    }
  };

  const handleTestMetricsConnection = async () => {
    setMetricsTesting(true);
    setMetricsTestResult(null);
    try {
      const res = await metricsApi.testConnection(projectId);
      setMetricsTestResult({
        ok: res.ok,
        message: res.ok
          ? `Connected${res.prometheusVersion ? ` (${res.prometheusVersion})` : ''}`
          : (res.error ?? 'Failed'),
      });
    } catch (err) {
      setMetricsTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Failed',
      });
    } finally {
      setMetricsTesting(false);
    }
  };

  // Policy form handlers
  const resetPolicyForm = () => {
    setFormEntityType('route');
    setFormAction('');
    setFormStages([{ ...defaultStage }]);
    setPolicyError(null);
    setEditingPolicy(null);
  };

  const openCreateModal = () => {
    resetPolicyForm();
    setShowPolicyModal(true);
  };

  const openEditModal = (policy: ApprovalPolicy) => {
    setEditingPolicy(policy);
    setFormEntityType(policy.entityType);
    setFormAction(policy.action || '');
    setFormStages(
      policy.stages.map((s) => ({
        order: s.order,
        requiredPermission: s.required_permission,
        teamScope: s.team_scope,
        minApprovers: s.min_approvers,
      }))
    );
    setPolicyError(null);
    setShowPolicyModal(true);
  };

  const openDeleteModal = (policy: ApprovalPolicy) => {
    setDeletingPolicy(policy);
    setPolicyError(null);
    setShowDeleteModal(true);
  };

  const addStage = () => {
    setFormStages([
      ...formStages,
      {
        order: formStages.length + 1,
        requiredPermission: defaultPermissionForEntity(formEntityType),
        teamScope: 'any',
        minApprovers: 1,
      },
    ]);
  };

  const removeStage = (index: number) => {
    if (formStages.length <= 1) return;
    const updated = formStages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    setFormStages(updated);
  };

  const updateStage = (index: number, field: keyof StageForm, value: string | number) => {
    const updated = [...formStages];
    updated[index] = { ...updated[index], [field]: value };
    setFormStages(updated);
  };

  const handleSavePolicy = async () => {
    if (formStages.length === 0) {
      setPolicyError('At least one stage is required');
      return;
    }

    setIsSubmitting(true);
    setPolicyError(null);
    try {
      const data = {
        entityType: formEntityType,
        action: formAction || null,
        stages: formStages.map((s) => ({
          order: s.order,
          requiredPermission: s.requiredPermission,
          teamScope: s.teamScope,
          minApprovers: s.minApprovers,
        })),
      };

      if (editingPolicy) {
        await projectsApi.updateApprovalPolicy(projectId, editingPolicy.id, data);
      } else {
        await projectsApi.createApprovalPolicy(projectId, data);
      }
      setShowPolicyModal(false);
      resetPolicyForm();
      loadPolicies();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setPolicyError(error.response?.data?.error || 'Failed to save policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!deletingPolicy) return;
    setIsSubmitting(true);
    setPolicyError(null);
    try {
      await projectsApi.deleteApprovalPolicy(projectId, deletingPolicy.id);
      setShowDeleteModal(false);
      setDeletingPolicy(null);
      loadPolicies();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setPolicyError(error.response?.data?.error || 'Failed to delete policy');
    } finally {
      setIsSubmitting(false);
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
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Settings</h1>
          <p className="text-gray-600 mt-1">Configure approval workflow and policies</p>
        </div>
      </div>

      {/* Approval Settings */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Approval Settings</h2>
          <p className="text-sm text-gray-600">Control how approvals work in this project</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={approvalEnabled}
              onChange={(e) => setApprovalEnabled(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Enable approval workflow</p>
              <p className="text-xs text-gray-500">
                When disabled, all changes (routes, client attachments) are applied immediately without approval
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={selfApprovalAllowed}
              onChange={(e) => setSelfApprovalAllowed(e.target.checked)}
              disabled={!approvalEnabled}
              className="mt-0.5"
            />
            <div>
              <p className={`text-sm font-medium ${approvalEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                Allow self-approval
              </p>
              <p className="text-xs text-gray-500">
                When enabled, users can approve their own submissions
              </p>
            </div>
          </label>

          {settingsError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              {settingsSuccess}
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="primary"
              onClick={handleSaveSettings}
              isLoading={isSaving}
            >
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approval Policies */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Approval Policies</h2>
              <p className="text-sm text-gray-600">
                Define custom approval stages for routes and client attachments
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-1" />
              Add Policy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isPoliciesLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-16 bg-gray-100 rounded" />
              <div className="h-16 bg-gray-100 rounded" />
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">No custom policies</p>
              <p className="text-xs text-gray-400">Default approval stages will be used</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">
                          {policy.entityType === 'client_attachment' ? 'Client Attachment' : 'Route'}
                        </Badge>
                        {policy.action && (
                          <Badge variant="default">{policy.action}</Badge>
                        )}
                        {!policy.action && (
                          <Badge variant="warning">Default</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {policy.stages.length} stage{policy.stages.length !== 1 ? 's' : ''}
                        {policy.stages.map((s, i) => (
                          <span key={i}>
                            {i === 0 ? ' — ' : ', '}
                            {s.required_permission} ({s.team_scope}
                            {s.min_approvers > 1 ? `, ${s.min_approvers} approvers` : ''})
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(policy)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openDeleteModal(policy)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observability (Prometheus / VictoriaMetrics) */}
      <Card id="observability" className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Observability</h2>
          <p className="text-sm text-gray-600">
            Connect to Prometheus or VictoriaMetrics to see traffic metrics on route and domain pages.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Metrics endpoint URL</label>
            <Input
              type="text"
              value={metricsEndpointUrl}
              onChange={(e) => setMetricsEndpointUrl(e.target.value)}
              placeholder="https://prometheus.internal:9090"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to disable observability for this project.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Auth type</label>
            <Select
              value={metricsAuthType}
              onChange={(e) => setMetricsAuthType(e.target.value as 'none' | 'bearer' | 'basic')}
              className="mt-1"
              options={[
                { value: 'none', label: 'None' },
                { value: 'bearer', label: 'Bearer token' },
                { value: 'basic', label: 'Basic auth' },
              ]}
            />
          </div>

          {metricsAuthType === 'bearer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Bearer token</label>
              <Input
                type="password"
                value={metricsToken}
                onChange={(e) => setMetricsToken(e.target.value)}
                placeholder="Leave blank to keep existing token"
                className="mt-1"
              />
            </div>
          )}

          {metricsAuthType === 'basic' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <Input
                  type="text"
                  value={metricsUsername}
                  onChange={(e) => setMetricsUsername(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Input
                  type="password"
                  value={metricsPassword}
                  onChange={(e) => setMetricsPassword(e.target.value)}
                  placeholder="Leave blank to keep existing password"
                  className="mt-1"
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={metricsTlsSkipVerify}
              onChange={(e) => setMetricsTlsSkipVerify(e.target.checked)}
            />
            <span className="text-sm text-gray-700">Skip TLS certificate verification</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700">CA certificate (PEM, optional)</label>
            <textarea
              value={metricsCaCert}
              onChange={(e) => setMetricsCaCert(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
              placeholder="-----BEGIN CERTIFICATE-----&#10;..."
            />
          </div>

          {metricsError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {metricsError}
            </div>
          )}
          {metricsSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              {metricsSuccess}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              onClick={handleSaveObservability}
              isLoading={metricsSaving}
            >
              Save Observability Settings
            </Button>
            <Button
              variant="secondary"
              onClick={handleTestMetricsConnection}
              disabled={metricsTesting || !metricsEndpointUrl}
            >
              {metricsTesting ? 'Testing…' : 'Test Connection'}
            </Button>
            {metricsTestResult && (
              <span className={`text-sm ${metricsTestResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {metricsTestResult.ok ? '✓' : '✗'} {metricsTestResult.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Policy Modal */}
      <Modal
        isOpen={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false);
          resetPolicyForm();
        }}
        title={editingPolicy ? 'Edit Approval Policy' : 'Create Approval Policy'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Entity Type"
              value={formEntityType}
              onChange={(e) => {
                const next = e.target.value;
                setFormEntityType(next);
                setFormAction('');
                const nextDefault = defaultPermissionForEntity(next);
                const allowed = new Set(
                  (PERMISSIONS_BY_ENTITY[next] || []).map((p) => p.value),
                );
                setFormStages((stages) =>
                  stages.map((s) => ({
                    ...s,
                    requiredPermission: allowed.has(s.requiredPermission)
                      ? s.requiredPermission
                      : nextDefault,
                  })),
                );
              }}
              options={ENTITY_TYPES}
            />
            <Select
              label="Action (optional)"
              value={formAction}
              onChange={(e) => setFormAction(e.target.value)}
              options={[
                { value: '', label: 'Default (all actions)' },
                ...(ACTIONS_BY_ENTITY[formEntityType] || []),
              ]}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Stages</label>
              <Button variant="ghost" size="sm" onClick={addStage}>
                <Plus className="h-3 w-3 mr-1" />
                Add Stage
              </Button>
            </div>

            <div className="space-y-3">
              {formStages.map((stage, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">Stage {index + 1}</span>
                    {formStages.length > 1 && (
                      <button
                        onClick={() => removeStage(index)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Select
                      label="Permission"
                      value={stage.requiredPermission}
                      onChange={(e) => updateStage(index, 'requiredPermission', e.target.value)}
                      options={PERMISSIONS_BY_ENTITY[formEntityType] || []}
                    />
                    <Select
                      label="Team Scope"
                      value={stage.teamScope}
                      onChange={(e) => updateStage(index, 'teamScope', e.target.value)}
                      options={TEAM_SCOPES}
                    />
                    <Input
                      label="Min Approvers"
                      type="number"
                      min={1}
                      value={stage.minApprovers}
                      onChange={(e) => updateStage(index, 'minApprovers', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {policyError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {policyError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowPolicyModal(false);
                resetPolicyForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePolicy}
              isLoading={isSubmitting}
            >
              {editingPolicy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingPolicy(null);
        }}
        title="Delete Approval Policy"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this approval policy? The default approval stages will be used instead.
          </p>
          {policyError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {policyError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingPolicy(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeletePolicy}
              isLoading={isSubmitting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
