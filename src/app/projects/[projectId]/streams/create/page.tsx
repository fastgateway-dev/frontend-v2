'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button, Card, CardContent, Select, Input } from '@/components/ui';
import { streamsApi, domainTemplatesApi, domainsApi, projectsApi } from '@/lib/api';
import type { Project, DomainTemplate, StreamEntrypoint, TransportPort } from '@/types';
import { TemplateEntrypointSummary } from '@/components/streams/TemplateEntrypointSummary';
import { PortClaimPicker } from '@/components/streams/PortClaimPicker';
import { templateOptionLabel } from '@/lib/utils/stream-entrypoint';

const DEFAULT_NAMESPACE = 'fastgateway-system';

export default function CreateStreamPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<DomainTemplate[]>([]);
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([DEFAULT_NAMESPACE]);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [ports, setPorts] = useState<TransportPort[]>([]);
  const [portsError, setPortsError] = useState<string | null>(null);
  const [entrypoint, setEntrypoint] = useState<StreamEntrypoint | null>(null);
  const [entrypointError, setEntrypointError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    setEntrypoint(null);
    setEntrypointError(null);
    if (!selectedTemplateId) return;
    // The cleanup flag drops a late response for a template the user already left.
    let cancelled = false;
    domainTemplatesApi
      .getEntrypoint(projectId, selectedTemplateId)
      .then((data) => {
        if (!cancelled) setEntrypoint(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { error?: string } } };
        setEntrypointError(err.response?.data?.error || 'request failed');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedTemplateId]);

  const loadData = async () => {
    try {
      const [projectData, templatesData, nsData] = await Promise.all([
        projectsApi.get(projectId),
        domainTemplatesApi.list(projectId, 1, 100, 'stream'),
        domainsApi.listAvailableNamespaces(projectId).catch(() => ({ namespaces: [DEFAULT_NAMESPACE] })),
      ]);
      setProject(projectData);
      setTemplates(templatesData.data);
      const namespaces = nsData.namespaces.length > 0 ? nsData.namespaces : [DEFAULT_NAMESPACE];
      setAvailableNamespaces(namespaces);
      setNamespace(namespaces.includes(DEFAULT_NAMESPACE) ? DEFAULT_NAMESPACE : namespaces[0]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!selectedTemplateId) errors.template = 'Select a gateway template';
    if (!name.trim()) errors.name = 'Name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsCreating(true);
    setCreateError(null);
    setPortsError(null);
    try {
      await streamsApi.create(projectId, {
        name: name.trim(),
        namespace,
        gatewayTemplateId: selectedTemplateId,
        ports,
      });
      router.push(`/projects/${projectId}/streams`);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      const message = err.response?.data?.error;
      const status = err.response?.status;
      // 400/409 port errors (bad, reserved, out of range, taken on a shared entry point) belong under the picker.
      if (message && (status === 400 || status === 409) && /\bports?\b/i.test(message)) {
        setPortsError(message);
      } else {
        setCreateError(message || 'Failed to create stream');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const usableTemplates = templates.filter((t) => t.status === 'active');

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
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}/streams`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Streams
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Stream</h1>
        <p className="text-gray-600 mt-1">{project?.name}</p>
      </div>

      <Card>
        <CardContent>
          <div className="space-y-4 pt-6">
            {usableTemplates.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">No stream-enabled Gateway Templates available</h4>
                    <p className="mt-1 text-sm text-amber-700">
                      You need a Gateway Template with the Stream capability enabled before creating streams.{' '}
                      <Link href={`/projects/${projectId}/domain-templates`} className="underline font-medium">
                        Manage Gateway Templates
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Select
                  id="gatewayTemplateId"
                  label="Gateway Template"
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    // Claims are checked against one template's range and port map.
                    setPorts([]);
                    setPortsError(null);
                    setFormErrors((prev) => ({ ...prev, template: '' }));
                  }}
                  options={[
                    { value: '', label: 'Select a gateway template...' },
                    ...usableTemplates.map((t) => ({
                      value: t.id,
                      label: templateOptionLabel(t),
                    })),
                  ]}
                  error={formErrors.template}
                />

                {selectedTemplateId && (
                  <TemplateEntrypointSummary entrypoint={entrypoint} error={entrypointError} />
                )}

                <Input
                  id="name"
                  label="Name"
                  placeholder="e.g., postgres"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFormErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  error={formErrors.name}
                />

                {selectedTemplateId && (
                  <div>
                    <p className="block text-sm font-medium text-gray-700 mb-1">Ports</p>
                    <p className="mb-2 text-xs text-gray-500">
                      Claim at least one port for this stream. Routes can only use ports the stream has claimed.
                    </p>
                    <PortClaimPicker
                      value={ports}
                      onChange={(next) => {
                        setPorts(next);
                        setPortsError(null);
                      }}
                      range={entrypoint?.portRange ?? null}
                      reserved={entrypoint?.reserved ?? []}
                      taken={entrypoint?.ports ?? []}
                      error={portsError ?? undefined}
                      disabled={!entrypoint && !entrypointError}
                    />
                  </div>
                )}

                <div>
                  <Select
                    id="streamNamespace"
                    label="Deployment Namespace"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    options={availableNamespaces.map((ns) => ({ value: ns, label: ns }))}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Kubernetes namespace where the stream&apos;s Gateway and route CRDs will be deployed.
                  </p>
                </div>

                {createError && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-800">Failed to create stream</h4>
                        <p className="mt-1 text-sm text-red-700">{createError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Link href={`/projects/${projectId}/streams`}>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </Link>
                  <Button onClick={handleCreate} isLoading={isCreating} disabled={ports.length === 0}>
                    Create Stream
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
