'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Info, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent, Select, Input } from '@/components/ui';
import { YamlDiffViewer } from '@/components/features/yaml-diff-viewer';
import { AIReviewCard } from '@/components/features/ai-review-card';
import { domainsApi, domainTemplatesApi, projectsApi } from '@/lib/api';
import { aiApi } from '@/lib/api/ai';
import { LabelsEditor } from '@/components/ui/labels-editor';
import type { Project, DomainTemplate, AIReviewResult, TLSSecretInfo } from '@/types';

export default function CreateDomainPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [domainTemplates, setDomainTemplates] = useState<DomainTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [tlsSecretName, setTlsSecretName] = useState('');
  const [tlsSecretNamespace, setTlsSecretNamespace] = useState('fastgateway-system');
  const [tlsSecrets, setTlsSecrets] = useState<TLSSecretInfo[]>([]);
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>(['fastgateway-system']);
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  const [secretWarning, setSecretWarning] = useState('');
  const [secretListError, setSecretListError] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [domainNamespace, setDomainNamespace] = useState('fastgateway-system');
  const [availableDomainNamespaces, setAvailableDomainNamespaces] = useState<string[]>(['fastgateway-system']);

  // Submit state
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('configuration');

  // Preview state
  const [previewGatewayYaml, setPreviewGatewayYaml] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // AI Review state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResult | null>(null);
  const [changeDescription, setChangeDescription] = useState('');

  const selectedTemplate = domainTemplates.find((t) => t.id === selectedTemplateId);
  const needsTLS = selectedTemplate && selectedTemplate.tlsMode !== 'no_tls';

  const fetchTLSSecrets = useCallback(async (namespace?: string) => {
    if (!projectId) return;
    setLoadingSecrets(true);
    setSecretListError(false);
    try {
      const result = await domainsApi.listTLSSecrets(projectId, namespace);
      setTlsSecrets(result.secrets);
      setAvailableNamespaces(result.availableNamespaces);
    } catch {
      setTlsSecrets([]);
      setSecretListError(true);
    } finally {
      setLoadingSecrets(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (needsTLS) {
      fetchTLSSecrets(tlsSecretNamespace);
    }
  }, [needsTLS, tlsSecretNamespace, fetchTLSSecrets]);

  useEffect(() => {
    if (!tlsSecretName || !needsTLS || loadingSecrets) {
      setSecretWarning('');
      return;
    }
    const exists = tlsSecrets.some(s => s.name === tlsSecretName);
    if (!exists && tlsSecretName.trim()) {
      setSecretWarning(`Secret '${tlsSecretName}' was not found in namespace '${tlsSecretNamespace}'. It must exist before the domain can serve TLS traffic.`);
    } else {
      setSecretWarning('');
    }
  }, [tlsSecretName, tlsSecrets, tlsSecretNamespace, needsTLS, loadingSecrets]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projectData, templatesData, nsData] = await Promise.all([
        projectsApi.get(projectId),
        domainTemplatesApi.list(projectId),
        domainsApi.listAvailableNamespaces(projectId).catch(() => ({ namespaces: ['fastgateway-system'] })),
      ]);
      setProject(projectData);
      setDomainTemplates(templatesData.data);
      setAvailableDomainNamespaces(nsData.namespaces);

      aiApi.getStatus().then(status => setAiEnabled(status.enabled)).catch(() => {});
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const collectValidationErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (!hostname.trim()) errors.hostname = 'Hostname is required';
    if (!selectedTemplateId) errors.template = 'Domain Template is required';
    if (needsTLS && !tlsSecretName.trim()) errors.tlsSecretName = 'TLS Secret Name is required when TLS is enabled';
    return errors;
  };

  const validateForm = (): boolean => {
    const errors = collectValidationErrors();
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const previewMissingFields = useMemo(() => {
    const errors = collectValidationErrors();
    return Object.values(errors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, hostname, selectedTemplateId, needsTLS, tlsSecretName]);

  const buildInput = () => ({
    name: name.trim(),
    hostname: hostname.trim(),
    domainTemplateId: selectedTemplateId,
    tlsSecretName: needsTLS ? tlsSecretName.trim() : '',
    tlsSecretNamespace: needsTLS && tlsSecretNamespace !== 'fastgateway-system' ? tlsSecretNamespace : undefined,
    ...(domainNamespace !== 'fastgateway-system' ? { namespace: domainNamespace } : {}),
    labels: Object.keys(labels).length > 0 ? labels : undefined,
  });

  // Load preview when switching to Preview tab — only if all required fields are valid.
  // Don't snap back to Configuration; let the preview tab render its own "fill required fields" state.
  useEffect(() => {
    if (activeTab === 'preview' && previewMissingFields.length === 0) {
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadPreview = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    setAiReviewResult(null);
    try {
      const input = buildInput();
      const result = await domainsApi.previewCreate(projectId, input);
      setPreviewGatewayYaml(result.proposedGatewayYaml || '');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setPreviewError(err.response?.data?.error || 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleAIReview = async () => {
    setIsLoadingReview(true);
    setReviewError(null);
    try {
      const input = buildInput();
      const result = await domainsApi.previewCreate(projectId, {
        ...input,
        description: changeDescription || undefined,
        includeAIReview: true,
      });
      if (result.aiReview) {
        setAiReviewResult(result.aiReview);
      } else {
        setReviewError('AI review is not available');
      }
    } catch (error: unknown) {
      setReviewError(error instanceof Error ? error.message : 'Failed to get AI review');
    } finally {
      setIsLoadingReview(false);
    }
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      await domainsApi.create(projectId, buildInput());
      router.push(`/projects/${projectId}/domains`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setCreateError(err.response?.data?.error || 'Failed to create domain');
    } finally {
      setIsCreating(false);
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
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}/domains`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Domains
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Domain</h1>
        <p className="text-gray-600 mt-1">{project?.name}</p>
      </div>

      <Card>
        <CardContent>
          <Tabs defaultValue="configuration" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="configuration">
              <div className="space-y-4">
                {domainTemplates.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800">No Domain Templates available</h4>
                        <p className="mt-1 text-sm text-amber-700">
                          You need to create a Domain Template before creating domains.{' '}
                          <Link
                            href={`/projects/${projectId}/domain-templates`}
                            className="underline font-medium"
                          >
                            Create a Domain Template
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Select
                      id="domainTemplateId"
                      label="Domain Template"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        setFormErrors(prev => ({ ...prev, template: '' }));
                      }}
                      options={[
                        { value: '', label: 'Select a domain template...' },
                        ...domainTemplates
                          .filter((t) => t.status === 'active')
                          .map((t) => ({
                            value: t.id,
                            label: `${t.name} (${t.exposureType}, ${t.tlsMode.replace('_', ' ')})`,
                          })),
                      ]}
                      error={formErrors.template}
                    />

                    {selectedTemplate && (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <h4 className="font-medium text-gray-800 mb-2">Template Settings</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Exposure:</span>{' '}
                            <span className="font-medium capitalize">{selectedTemplate.exposureType}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">TLS:</span>{' '}
                            <span className="font-medium capitalize">{selectedTemplate.tlsMode.replace('_', ' ')}</span>
                          </div>
                          {selectedTemplate.tlsMode !== 'tls_only' && (
                            <div>
                              <span className="text-gray-500">HTTP Port:</span>{' '}
                              <span className="font-medium">{selectedTemplate.httpPort}</span>
                            </div>
                          )}
                          {selectedTemplate.tlsMode !== 'no_tls' && (
                            <div>
                              <span className="text-gray-500">HTTPS Port:</span>{' '}
                              <span className="font-medium">{selectedTemplate.httpsPort}</span>
                            </div>
                          )}
                          {Object.keys(selectedTemplate.annotations || {}).length > 0 && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Annotations:</span>{' '}
                              <span className="font-medium">{Object.keys(selectedTemplate.annotations).length} custom annotation(s)</span>
                            </div>
                          )}
                        </div>
                        {selectedTemplate.mergeGateways && (
                          <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-2">
                            <Info className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-primary-700">
                              This template uses merged gateways — domains will share infrastructure.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <Input
                      id="name"
                      label="Display Name"
                      placeholder="e.g., API Gateway"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setFormErrors(prev => ({ ...prev, name: '' }));
                      }}
                      error={formErrors.name}
                    />

                    <Input
                      id="hostname"
                      label="Hostname"
                      placeholder="e.g., api.example.com"
                      value={hostname}
                      onChange={(e) => {
                        setHostname(e.target.value);
                        setFormErrors(prev => ({ ...prev, hostname: '' }));
                      }}
                      error={formErrors.hostname}
                    />

                    <div>
                      <Select
                        id="domainNamespace"
                        label="Deployment Namespace"
                        value={domainNamespace}
                        onChange={(e) => setDomainNamespace(e.target.value)}
                        options={availableDomainNamespaces.map(ns => ({ value: ns, label: ns }))}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Kubernetes namespace where Gateway and route CRDs will be deployed.
                        {availableDomainNamespaces.length === 1 && (
                          <> To add more options here, label a namespace with <code className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">fastgateway.io/domain-namespace=true</code>.</>
                        )}
                      </p>
                    </div>

                    {needsTLS && (
                      <div className="space-y-3">
                        {availableNamespaces.length > 1 && (
                          <Select
                            id="tlsSecretNamespace"
                            label="TLS Secret Namespace"
                            value={tlsSecretNamespace}
                            onChange={(e) => {
                              setTlsSecretNamespace(e.target.value);
                              setTlsSecretName('');
                            }}
                            options={availableNamespaces.map(ns => ({ value: ns, label: ns }))}
                          />
                        )}

                        <div>
                          <label htmlFor="tlsSecretName" className="block text-sm font-medium text-foreground mb-1">
                            TLS Secret Name
                          </label>
                          <input
                            id="tlsSecretName"
                            list="tls-secrets-list"
                            type="text"
                            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                            placeholder={loadingSecrets ? 'Loading secrets...' : 'Select or type a secret name'}
                            value={tlsSecretName}
                            onChange={(e) => {
                              setTlsSecretName(e.target.value);
                              setFormErrors(prev => ({ ...prev, tlsSecretName: '' }));
                            }}
                          />
                          <datalist id="tls-secrets-list">
                            {tlsSecrets.map(secret => (
                              <option key={secret.name} value={secret.name}>
                                {secret.name} {secret.managedByFastgateway ? '(Managed)' : '(External)'}
                              </option>
                            ))}
                          </datalist>
                          {secretListError && (
                            <p className="mt-1 text-sm text-gray-500">Secret listing unavailable. You can still type a secret name manually.</p>
                          )}
                          {formErrors.tlsSecretName && (
                            <p className="mt-1 text-sm text-danger">{formErrors.tlsSecretName}</p>
                          )}
                          {secretWarning && !formErrors.tlsSecretName && (
                            <p className="mt-1 text-sm text-amber-600">{secretWarning}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <LabelsEditor labels={labels} onChange={setLabels} />

                    {createError && (
                      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-red-800">Failed to create domain</h4>
                            <p className="mt-1 text-sm text-red-700">{createError}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <Link href={`/projects/${projectId}/domains`}>
                        <Button type="button" variant="secondary">
                          Cancel
                        </Button>
                      </Link>
                      <Button
                        onClick={() => setActiveTab('preview')}
                        variant="secondary"
                        disabled={!selectedTemplateId || !name || !hostname}
                      >
                        Preview
                      </Button>
                      <Button onClick={handleCreate} isLoading={isCreating} disabled={!selectedTemplateId}>
                        Create Domain
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview">
              {previewMissingFields.length > 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-800">Fill in required fields to see the preview</h4>
                      <ul className="mt-2 text-sm text-amber-700 list-disc pl-5 space-y-1">
                        {previewMissingFields.map((msg) => (
                          <li key={msg}>{msg}</li>
                        ))}
                      </ul>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setActiveTab('configuration')}
                      >
                        Go to Configuration
                      </Button>
                    </div>
                  </div>
                </div>
              ) : isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                  <span className="ml-3 text-gray-600">Generating preview...</span>
                </div>
              ) : previewError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {previewError}
                </div>
              ) : (
                <div className="space-y-6">
                  {previewGatewayYaml && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Gateway</h3>
                      <YamlDiffViewer proposedYaml={previewGatewayYaml} mode="create" />
                    </div>
                  )}

                  {!previewGatewayYaml && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No preview available. Go to Configuration tab and fill in the required fields.</p>
                    </div>
                  )}

                  {previewGatewayYaml && aiEnabled && (
                    <div className="space-y-4 border-t pt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Describe your configuration (optional)
                        </label>
                        <textarea
                          value={changeDescription}
                          onChange={(e) => setChangeDescription(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="e.g., Creating API gateway for production traffic..."
                        />
                      </div>
                      <Button
                        variant="secondary"
                        onClick={handleAIReview}
                        disabled={isLoadingReview}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {isLoadingReview ? 'Reviewing...' : 'Review with AI'}
                      </Button>
                      {reviewError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                          {reviewError}
                        </div>
                      )}
                      {aiReviewResult && <AIReviewCard review={aiReviewResult} />}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="secondary" onClick={() => setActiveTab('configuration')}>
                      Back to Configuration
                    </Button>
                    <Button onClick={handleCreate} isLoading={isCreating}>
                      Create Domain
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
