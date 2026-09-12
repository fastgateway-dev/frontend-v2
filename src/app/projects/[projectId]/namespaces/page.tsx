'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Boxes, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle, Pencil } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal, Select } from '@/components/ui';
import { projectNamespacesApi, kubernetesApi } from '@/lib/api';
import type { ProjectNamespace, NamespaceCapability } from '@/types';
import { ALL_NAMESPACE_CAPABILITIES, NAMESPACE_CAPABILITY_LABELS } from '@/types';

const DEFAULT_CAPABILITIES: NamespaceCapability[] = ['deploy_gateway', 'backend_service', 'tls_secret'];

export default function ProjectNamespacesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [namespaces, setNamespaces] = useState<ProjectNamespace[]>([]);
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<ProjectNamespace | null>(null);
  const [selectedK8sNamespace, setSelectedK8sNamespace] = useState<string>('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<NamespaceCapability[]>(DEFAULT_CAPABILITIES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [projectNamespaces, k8sNamespaces] = await Promise.all([
        projectNamespacesApi.list(projectId),
        kubernetesApi.listNamespaces(projectId),
      ]);
      setNamespaces(projectNamespaces || []);
      setAvailableNamespaces((k8sNamespaces || []).map(ns => ns.name));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCapability = (cap: NamespaceCapability) => {
    setSelectedCapabilities(prev =>
      prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
    );
  };

  const handleAddNamespace = async () => {
    if (!selectedK8sNamespace || selectedCapabilities.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await projectNamespacesApi.create(projectId, {
        namespace: selectedK8sNamespace,
        capabilities: selectedCapabilities,
      });
      setShowAddModal(false);
      setSelectedK8sNamespace('');
      setSelectedCapabilities(DEFAULT_CAPABILITIES);
      loadData();
    } catch (error: any) {
      console.error('Failed to add namespace:', error);
      setError(error.response?.data?.error || 'Failed to add namespace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNamespace = async () => {
    if (!selectedNamespace || selectedCapabilities.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await projectNamespacesApi.update(projectId, selectedNamespace.id, {
        capabilities: selectedCapabilities,
      });
      setShowEditModal(false);
      setSelectedNamespace(null);
      loadData();
    } catch (error: any) {
      console.error('Failed to update namespace:', error);
      setError(error.response?.data?.error || 'Failed to update namespace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveNamespace = async () => {
    if (!selectedNamespace) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await projectNamespacesApi.delete(projectId, selectedNamespace.id);
      setShowRemoveModal(false);
      setSelectedNamespace(null);
      loadData();
    } catch (error: any) {
      console.error('Failed to remove namespace:', error);
      setError(error.response?.data?.error || 'Failed to remove namespace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnsureReferenceGrant = async (ns: ProjectNamespace) => {
    try {
      await projectNamespacesApi.ensureReferenceGrant(projectId, ns.id);
      loadData();
    } catch (error: any) {
      console.error('Failed to ensure ReferenceGrant:', error);
    }
  };

  const systemNamespaces = ['kube-system', 'kube-public', 'kube-node-lease', 'fastgateway-system'];
  const unmanagedNamespaces = availableNamespaces.filter(
    (ns) => !namespaces.some((pn) => pn.namespace === ns) && !systemNamespaces.includes(ns)
  );

  const openAddModal = () => {
    setError(null);
    setSelectedK8sNamespace('');
    setSelectedCapabilities(DEFAULT_CAPABILITIES);
    setShowAddModal(true);
  };

  const openEditModal = (ns: ProjectNamespace) => {
    setError(null);
    setSelectedNamespace(ns);
    setSelectedCapabilities(ns.capabilities ?? DEFAULT_CAPABILITIES);
    setShowEditModal(true);
  };

  const openRemoveModal = (ns: ProjectNamespace) => {
    setSelectedNamespace(ns);
    setError(null);
    setShowRemoveModal(true);
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
          <h1 className="text-2xl font-bold text-gray-900">Managed Namespaces</h1>
          <p className="text-gray-600 mt-1">
            Configure which namespaces this project can use for deployment, backends, and TLS secrets.
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Namespace
        </Button>
      </div>

      <Card className="mb-6 bg-primary-50 border-primary-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-primary-800">
              <p className="font-medium mb-1">About Managed Namespaces</p>
              <p>
                Each namespace can take one or more roles. <code className="bg-primary-100 px-1 rounded">deploy_gateway</code> lets
                you deploy the Gateway and HTTPRoutes there; <code className="bg-primary-100 px-1 rounded">backend_service</code> lets
                routes forward traffic to Services there; <code className="bg-primary-100 px-1 rounded">tls_secret</code> lets the
                Gateway mount TLS Secrets stored there. A ReferenceGrant is created in each namespace as needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {namespaces.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Boxes className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No managed namespaces</h3>
            <p className="text-gray-600 mb-4">
              Add a namespace to deploy gateways or route to services in it.
            </p>
            <Button onClick={openAddModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Namespace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {namespaces.map((ns) => (
            <Card key={ns.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Boxes className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 font-mono">{ns.namespace}</h3>
                        {(ns.capabilities ?? []).map(c => (
                          <Badge key={c} variant="info">{NAMESPACE_CAPABILITY_LABELS[c]?.title ?? c}</Badge>
                        ))}
                        {ns.referenceGrantCreated ? (
                          <Badge variant="success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            ReferenceGrant Active
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <XCircle className="h-3 w-3 mr-1" />
                            ReferenceGrant Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Added on {new Date(ns.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!ns.referenceGrantCreated && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEnsureReferenceGrant(ns)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(ns)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRemoveModal(ns)}
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

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setError(null);
          setSelectedK8sNamespace('');
        }}
        title="Add Managed Namespace"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {unmanagedNamespaces.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500">
                No namespaces available to add. All non-system namespaces are already managed.
              </p>
            </div>
          ) : (
            <>
              <Select
                id="namespace"
                label="Kubernetes Namespace"
                value={selectedK8sNamespace}
                onChange={(e) => setSelectedK8sNamespace(e.target.value)}
                options={[
                  { value: '', label: 'Select a namespace...' },
                  ...unmanagedNamespaces.map((ns) => ({
                    value: ns,
                    label: ns,
                  })),
                ]}
              />

              <CapabilityCheckboxes
                selected={selectedCapabilities}
                onToggle={toggleCapability}
              />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            {unmanagedNamespaces.length > 0 && (
              <Button
                onClick={handleAddNamespace}
                isLoading={isSubmitting}
                disabled={!selectedK8sNamespace || selectedCapabilities.length === 0}
              >
                Add Namespace
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setError(null);
          setSelectedNamespace(null);
        }}
        title={`Edit ${selectedNamespace?.namespace ?? ''}`}
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <CapabilityCheckboxes
            selected={selectedCapabilities}
            onToggle={toggleCapability}
          />

          <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
            <p>
              Changing capabilities updates this namespace&apos;s ReferenceGrant. Removing
              <code className="bg-gray-200 px-1 rounded mx-1">backend_service</code> or
              <code className="bg-gray-200 px-1 rounded mx-1">tls_secret</code> may break
              routes / Gateways currently relying on them.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateNamespace}
              isLoading={isSubmitting}
              disabled={selectedCapabilities.length === 0}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setError(null);
          setSelectedNamespace(null);
        }}
        title="Remove Managed Namespace"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <p className="text-gray-600">
            Are you sure you want to remove{' '}
            <span className="font-semibold font-mono">{selectedNamespace?.namespace}</span> from this project?
          </p>

          <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
            <p className="font-medium mb-1">Warning</p>
            <p>
              The ReferenceGrant in the namespace will be deleted. Existing routes or Gateways
              relying on this namespace will stop working until it is added back.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowRemoveModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRemoveNamespace}
              isLoading={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Namespace
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CapabilityCheckboxes({
  selected,
  onToggle,
}: {
  selected: NamespaceCapability[];
  onToggle: (cap: NamespaceCapability) => void;
}) {
  // Render the known capability set, plus any capability the backend already
  // assigned that the frontend doesn't recognize — so editing doesn't silently
  // strip it.
  const knownSet = new Set<string>(ALL_NAMESPACE_CAPABILITIES);
  const unknown = selected.filter((c) => !knownSet.has(c));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Capabilities</label>
      <div className="space-y-2">
        {ALL_NAMESPACE_CAPABILITIES.map((cap) => {
          const meta = NAMESPACE_CAPABILITY_LABELS[cap];
          return (
            <label key={cap} className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.includes(cap)}
                onChange={() => onToggle(cap)}
              />
              <div className="text-sm">
                <div className="font-medium text-gray-900">{meta.title}</div>
                <div className="text-gray-600">{meta.description}</div>
              </div>
            </label>
          );
        })}
        {unknown.map((cap) => (
          <label key={cap} className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              className="mt-1"
              checked
              onChange={() => onToggle(cap)}
            />
            <div className="text-sm">
              <div className="font-medium text-gray-900 font-mono">{cap}</div>
              <div className="text-gray-600">
                Unknown capability returned by the server. Leave it on unless you intend to revoke it.
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
