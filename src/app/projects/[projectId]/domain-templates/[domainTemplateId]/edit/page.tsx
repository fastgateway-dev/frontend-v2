'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Plus, Trash2, Sparkles } from 'lucide-react';
import { Button, Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { YamlDiffViewer } from '@/components/features/yaml-diff-viewer';
import { AIReviewCard } from '@/components/features/ai-review-card';
import { AccessLogsCard } from '@/components/observability/AccessLogsCard';
import { TracingCard } from '@/components/observability/TracingCard';
import { MetricsTuningCard } from '@/components/observability/MetricsTuningCard';
import { NodeSelectorEditor } from '@/components/scheduling/NodeSelectorEditor';
import { TolerationsEditor } from '@/components/scheduling/TolerationsEditor';
import { TopologySpreadEditor } from '@/components/scheduling/TopologySpreadEditor';
import { PdbEditor } from '@/components/scheduling/PdbEditor';
import { DeploymentStrategyEditor } from '@/components/scheduling/DeploymentStrategyEditor';
import { domainTemplatesApi } from '@/lib/api';
import type { DomainTemplate, ScalingType, AIReviewResult, CreateDomainTemplateInput, ExternalTrafficPolicy, DomainTemplatePreviewResult, TelemetryAccessLogConfig, TelemetryTracingConfig, TelemetryMetricsConfig, PodPlacementConfig, PDBConfig, DeploymentStrategyConfig } from '@/types';

interface EditFormValues {
  description: string;
  externalTrafficPolicy: string;
  loadBalancerClass: string;
  annotationsList: Array<{ key: string; value: string }>;
  podAnnotationsList: Array<{ key: string; value: string }>;
  cpuRequest: string;
  memoryRequest: string;
  cpuLimit: string;
  memoryLimit: string;
  scalingType: '' | ScalingType;
  replicas: number;
  minReplicas: number;
  maxReplicas: number;
}

interface TelemetryState {
  accessLog: TelemetryAccessLogConfig | null;
  tracing: TelemetryTracingConfig | null;
  metrics: TelemetryMetricsConfig | null;
}

interface SchedulingState {
  podPlacement: PodPlacementConfig | null;
  pdbConfig: PDBConfig | null;
  deploymentStrategy: DeploymentStrategyConfig | null;
}

// Update body extends the create input with explicit clear-flags so that the
// backend can distinguish "user disabled the feature" (null on the wire is
// indistinguishable from "absent" in Go) from "user did not change it".
type UpdateBody = Partial<CreateDomainTemplateInput> & {
  clearTelemetryAccessLog?: boolean;
  clearTelemetryTracing?: boolean;
  clearTelemetryMetrics?: boolean;
  clearPodPlacement?: boolean;
  clearPdbConfig?: boolean;
  clearDeploymentStrategy?: boolean;
};

function buildUpdateInput(values: EditFormValues, telemetry?: TelemetryState, scheduling?: SchedulingState): UpdateBody {
  const input: UpdateBody = {
    description: values.description || undefined,
  };

  if (values.externalTrafficPolicy) {
    input.externalTrafficPolicy = values.externalTrafficPolicy as ExternalTrafficPolicy;
  }
  if (values.loadBalancerClass) {
    input.loadBalancerClass = values.loadBalancerClass;
  }

  // Convert annotations arrays to records
  const annotations: Record<string, string> = {};
  for (const item of values.annotationsList) {
    if (item.key.trim()) {
      annotations[item.key.trim()] = item.value;
    }
  }
  input.annotations = annotations;

  const podAnnotations: Record<string, string> = {};
  for (const item of values.podAnnotationsList) {
    if (item.key.trim()) {
      podAnnotations[item.key.trim()] = item.value;
    }
  }
  input.podAnnotations = podAnnotations;

  // Build containerResources only if any field is set
  const hasCpu = values.cpuRequest || values.cpuLimit;
  const hasMem = values.memoryRequest || values.memoryLimit;
  if (hasCpu || hasMem) {
    input.containerResources = {};
    if (values.cpuRequest || values.memoryRequest) {
      input.containerResources.requests = {};
      if (values.cpuRequest) input.containerResources.requests.cpu = values.cpuRequest;
      if (values.memoryRequest) input.containerResources.requests.memory = values.memoryRequest;
    }
    if (values.cpuLimit || values.memoryLimit) {
      input.containerResources.limits = {};
      if (values.cpuLimit) input.containerResources.limits.cpu = values.cpuLimit;
      if (values.memoryLimit) input.containerResources.limits.memory = values.memoryLimit;
    }
  }

  // Build scalingConfig based on scalingType
  if (values.scalingType === 'fixed') {
    input.scalingConfig = {
      type: 'fixed',
      replicas: values.replicas || 1,
    };
  } else if (values.scalingType === 'hpa') {
    input.scalingConfig = {
      type: 'hpa',
      minReplicas: values.minReplicas || 1,
      maxReplicas: values.maxReplicas || 3,
    };
  }

  if (telemetry) {
    if (telemetry.accessLog === null) {
      input.clearTelemetryAccessLog = true;
    } else {
      input.telemetryAccessLog = telemetry.accessLog;
    }
    if (telemetry.tracing === null) {
      input.clearTelemetryTracing = true;
    } else {
      input.telemetryTracing = telemetry.tracing;
    }
    if (telemetry.metrics === null) {
      input.clearTelemetryMetrics = true;
    } else {
      input.telemetryMetrics = telemetry.metrics;
    }
  }

  if (scheduling) {
    if (scheduling.podPlacement === null) {
      input.clearPodPlacement = true;
    } else {
      input.podPlacement = scheduling.podPlacement;
    }
    if (scheduling.pdbConfig === null) {
      input.clearPdbConfig = true;
    } else {
      input.pdbConfig = scheduling.pdbConfig;
    }
    if (scheduling.deploymentStrategy === null) {
      input.clearDeploymentStrategy = true;
    } else {
      input.deploymentStrategy = scheduling.deploymentStrategy;
    }
  }

  return input;
}

export default function DomainTemplateEditPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const domainTemplateId = params.domainTemplateId as string;

  const [template, setTemplate] = useState<DomainTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('settings');

  // Preview state
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<DomainTemplatePreviewResult | null>(null);

  // AI review state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [isLoadingAIReview, setIsLoadingAIReview] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResult | null>(null);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);

  // Submit state
  const [isApplying, setIsApplying] = useState(false);

  // Telemetry state (managed separately from react-hook-form)
  const [telemetryAccessLog, setTelemetryAccessLog] = useState<TelemetryAccessLogConfig | null>(null);
  const [telemetryTracing, setTelemetryTracing] = useState<TelemetryTracingConfig | null>(null);
  const [telemetryMetrics, setTelemetryMetrics] = useState<TelemetryMetricsConfig | null>(null);

  // Scheduling state (managed separately from react-hook-form)
  const [podPlacement, setPodPlacement] = useState<PodPlacementConfig | null>(null);
  const [pdbConfig, setPdbConfig] = useState<PDBConfig | null>(null);
  const [deploymentStrategy, setDeploymentStrategy] = useState<DeploymentStrategyConfig | null>(null);

  const { register, control, reset, watch } = useForm<EditFormValues>({
    defaultValues: {
      description: '',
      externalTrafficPolicy: '',
      loadBalancerClass: '',
      annotationsList: [],
      podAnnotationsList: [],
      cpuRequest: '',
      memoryRequest: '',
      cpuLimit: '',
      memoryLimit: '',
      scalingType: '',
      replicas: 1,
      minReplicas: 1,
      maxReplicas: 3,
    },
  });

  const { fields: annotationFields, append: appendAnnotation, remove: removeAnnotation } = useFieldArray({
    control,
    name: 'annotationsList',
  });

  const { fields: podAnnotationFields, append: appendPodAnnotation, remove: removePodAnnotation } = useFieldArray({
    control,
    name: 'podAnnotationsList',
  });

  const scalingType = watch('scalingType');

  // Load template data
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const data = await domainTemplatesApi.get(projectId, domainTemplateId);
        setTemplate(data);

        // Convert template data to form values
        const annotationsList = Object.entries(data.annotations || {}).map(([key, value]) => ({ key, value }));
        const podAnnotationsList = Object.entries(data.podAnnotations || {}).map(([key, value]) => ({ key, value }));

        reset({
          description: data.description || '',
          externalTrafficPolicy: data.externalTrafficPolicy || '',
          loadBalancerClass: data.loadBalancerClass || '',
          annotationsList,
          podAnnotationsList,
          cpuRequest: data.containerResources?.requests?.cpu || '',
          memoryRequest: data.containerResources?.requests?.memory || '',
          cpuLimit: data.containerResources?.limits?.cpu || '',
          memoryLimit: data.containerResources?.limits?.memory || '',
          scalingType: data.scalingConfig?.type || '',
          replicas: data.scalingConfig?.replicas || 1,
          minReplicas: data.scalingConfig?.minReplicas || 1,
          maxReplicas: data.scalingConfig?.maxReplicas || 3,
        });

        // Initialize telemetry state from loaded template
        setTelemetryAccessLog(data.telemetryAccessLog ?? null);
        setTelemetryTracing(data.telemetryTracing ?? null);
        setTelemetryMetrics(data.telemetryMetrics ?? null);

        // Initialize scheduling state from loaded template
        setPodPlacement(data.podPlacement ?? null);
        setPdbConfig(data.pdbConfig ?? null);
        setDeploymentStrategy(data.deploymentStrategy ?? null);
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { error?: string } } };
        setError(errorObj.response?.data?.error || 'Failed to load domain template');
      } finally {
        setIsLoading(false);
      }
    };
    loadTemplate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, domainTemplateId]);

  // Check AI status on mount
  useEffect(() => {
    import('@/lib/api/ai').then(({ aiApi }) => {
      aiApi.getStatus().then(status => setAiEnabled(status.enabled)).catch(() => {});
    });
  }, []);

  // Auto-load preview when entering preview tab
  useEffect(() => {
    if (activeTab === 'preview') {
      loadPreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadPreview = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    setPreviewResult(null);
    setAiReviewResult(null);
    setAiReviewError(null);

    try {
      const values = watch();
      const telemetry = { accessLog: telemetryAccessLog, tracing: telemetryTracing, metrics: telemetryMetrics };
      const scheduling = { podPlacement, pdbConfig, deploymentStrategy };
      const updateData = buildUpdateInput(values, telemetry, scheduling);
      const result = await domainTemplatesApi.previewChanges(projectId, domainTemplateId, updateData);
      setPreviewResult(result);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; response?: { data?: { error?: string } } };
      setPreviewError(errorObj.response?.data?.error || errorObj.message || 'Failed to generate preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleAIReview = async () => {
    setIsLoadingAIReview(true);
    setAiReviewError(null);
    setAiReviewResult(null);

    try {
      const values = watch();
      const telemetry = { accessLog: telemetryAccessLog, tracing: telemetryTracing, metrics: telemetryMetrics };
      const scheduling = { podPlacement, pdbConfig, deploymentStrategy };
      const updateData = buildUpdateInput(values, telemetry, scheduling);
      const result = await domainTemplatesApi.previewChanges(projectId, domainTemplateId, updateData, {
        includeAIReview: true,
        changeDescription: changeDescription || undefined,
      });
      // Update preview result to keep displayed diff in sync with what AI reviewed
      setPreviewResult(result);
      if (result.aiReview) {
        setAiReviewResult(result.aiReview);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setAiReviewError(errorObj.message || 'Failed to get AI review');
    } finally {
      setIsLoadingAIReview(false);
    }
  };

  const handleApplyChanges = async () => {
    setIsApplying(true);
    setError(null);
    try {
      const values = watch();
      const telemetry = { accessLog: telemetryAccessLog, tracing: telemetryTracing, metrics: telemetryMetrics };
      const scheduling = { podPlacement, pdbConfig, deploymentStrategy };
      const updateData = buildUpdateInput(values, telemetry, scheduling);
      await domainTemplatesApi.update(projectId, domainTemplateId, updateData);
      router.push(`/projects/${projectId}/domain-templates/${domainTemplateId}`);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setError(errorObj.response?.data?.error || 'Failed to apply changes');
    } finally {
      setIsApplying(false);
    }
  };

  const detailUrl = `/projects/${projectId}/domain-templates/${domainTemplateId}`;

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // Error state (no template)
  if (!template) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-600">{error || 'Domain template not found'}</p>
            <Link href={`/projects/${projectId}/domain-templates`}>
              <Button variant="secondary" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />Back to Templates
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href={detailUrl} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" />Back to Template
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Domain Template</h1>

      {/* Error message */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-3">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Read-only fields */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <h3 className="font-semibold text-gray-900 mb-2">Template Identity (Read-Only)</h3>
          <p className="text-sm text-gray-500 mb-4">These fields affect the Gateway resource and cannot be changed after creation.</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>{' '}
              <span className="font-medium">{template.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Controller:</span>{' '}
              <span className="font-medium">{template.controllerName}</span>
            </div>
            <div>
              <span className="text-gray-500">Exposure Type:</span>{' '}
              <Badge variant="default">{template.exposureType}</Badge>
            </div>
            <div>
              <span className="text-gray-500">TLS Mode:</span>{' '}
              <Badge variant="info">{template.tlsMode.replace('_', ' ')}</Badge>
            </div>
            {template.tlsMode !== 'no_tls' && (
              <div>
                <span className="text-gray-500">TLS Policy:</span>{' '}
                <span className="font-medium capitalize">{template.tlsPolicy}</span>
              </div>
            )}
            {template.tlsMode !== 'tls_only' && (
              <div>
                <span className="text-gray-500">HTTP Port:</span>{' '}
                <span className="font-medium">{template.httpPort}</span>
              </div>
            )}
            {template.tlsMode !== 'no_tls' && (
              <div>
                <span className="text-gray-500">HTTPS Port:</span>{' '}
                <span className="font-medium">{template.httpsPort}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Merge Gateways:</span>{' '}
              <span className="font-medium">{template.mergeGateways ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed content */}
      <Card>
        <CardContent className="py-4">
          <Tabs defaultValue="settings" value={activeTab} onValueChange={(value) => setActiveTab(value)}>
            <TabsList>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            {/* SETTINGS TAB */}
            <TabsContent value="settings">
              <div className="space-y-6 mt-4">
                {/* Description */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Description</h3>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Template description..."
                  />
                </div>

                {/* LoadBalancer settings (only if exposure type is LoadBalancer) */}
                {template.exposureType === 'LoadBalancer' && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">LoadBalancer Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">External Traffic Policy</label>
                        <select
                          {...register('externalTrafficPolicy')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Default</option>
                          <option value="Cluster">Cluster</option>
                          <option value="Local">Local</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Load Balancer Class</label>
                        <input
                          {...register('loadBalancerClass')}
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="e.g. service.k8s.aws/nlb"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Service Annotations */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Service Annotations</h3>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => appendAnnotation({ key: '', value: '' })}
                    >
                      <Plus className="h-4 w-4 mr-1" />Add
                    </Button>
                  </div>
                  {annotationFields.length === 0 ? (
                    <p className="text-sm text-gray-500">No service annotations configured.</p>
                  ) : (
                    <div className="space-y-3">
                      {annotationFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                          <input
                            {...register(`annotationsList.${index}.key`)}
                            type="text"
                            placeholder="Key"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <input
                            {...register(`annotationsList.${index}.value`)}
                            type="text"
                            placeholder="Value"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <Button type="button" variant="ghost" onClick={() => removeAnnotation(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Advanced Settings */}
                <div className="border border-gray-200 rounded-lg">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700">Advanced Settings</h3>
                  </div>
                  <div className="px-4 pb-4 pt-4 space-y-6">

                    {/* Resources */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium uppercase text-gray-600">Resources</h4>
                      {/* Container Resources */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Container Resources</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CPU Request</label>
                            <input
                              {...register('cpuRequest')}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="e.g. 100m"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Memory Request</label>
                            <input
                              {...register('memoryRequest')}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="e.g. 128Mi"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CPU Limit</label>
                            <input
                              {...register('cpuLimit')}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="e.g. 500m"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Memory Limit</label>
                            <input
                              {...register('memoryLimit')}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="e.g. 256Mi"
                            />
                          </div>
                        </div>
                      </div>
                      {/* Pod Annotations (moved here under Resources) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">Pod Annotations</p>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => appendPodAnnotation({ key: '', value: '' })}
                          >
                            <Plus className="h-4 w-4 mr-1" />Add
                          </Button>
                        </div>
                        {podAnnotationFields.length === 0 ? (
                          <p className="text-sm text-gray-500">No pod annotations configured.</p>
                        ) : (
                          <div className="space-y-3">
                            {podAnnotationFields.map((field, index) => (
                              <div key={field.id} className="flex items-center gap-2">
                                <input
                                  {...register(`podAnnotationsList.${index}.key`)}
                                  type="text"
                                  placeholder="Key"
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <input
                                  {...register(`podAnnotationsList.${index}.value`)}
                                  type="text"
                                  placeholder="Value"
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <Button type="button" variant="ghost" onClick={() => removePodAnnotation(index)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scheduling */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium uppercase text-gray-600">Scheduling</h4>
                      <NodeSelectorEditor
                        value={podPlacement?.nodeSelector}
                        onChange={(ns) => setPodPlacement({ ...(podPlacement ?? { tolerations: [], topologySpreadConstraints: [], priorityClassName: '' }), nodeSelector: ns })}
                      />
                      <TolerationsEditor
                        value={podPlacement?.tolerations}
                        onChange={(t) => setPodPlacement({ ...(podPlacement ?? { nodeSelector: {}, topologySpreadConstraints: [], priorityClassName: '' }), tolerations: t })}
                      />
                      <TopologySpreadEditor
                        value={podPlacement?.topologySpreadConstraints}
                        onChange={(c) => setPodPlacement({ ...(podPlacement ?? { nodeSelector: {}, tolerations: [], priorityClassName: '' }), topologySpreadConstraints: c })}
                      />
                      <div>
                        <label className="block text-xs text-gray-700">Priority class</label>
                        <input
                          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          value={podPlacement?.priorityClassName ?? ''}
                          onChange={(e) => setPodPlacement({ ...(podPlacement ?? { nodeSelector: {}, tolerations: [], topologySpreadConstraints: [] }), priorityClassName: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Lifecycle */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium uppercase text-gray-600">Lifecycle</h4>
                      <DeploymentStrategyEditor value={deploymentStrategy} onChange={setDeploymentStrategy} />
                      <PdbEditor value={pdbConfig} onChange={setPdbConfig} />
                    </div>

                    {/* Scaling */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium uppercase text-gray-600">Scaling</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scaling Type</label>
                          <select
                            {...register('scalingType')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Default (managed by Envoy Gateway)</option>
                            <option value="fixed">Fixed Replicas</option>
                            <option value="hpa">Horizontal Pod Autoscaler (HPA)</option>
                          </select>
                        </div>

                        {scalingType === 'fixed' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Replicas</label>
                            <input
                              {...register('replicas', { valueAsNumber: true })}
                              type="number"
                              min={1}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        )}

                        {scalingType === 'hpa' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Min Replicas</label>
                              <input
                                {...register('minReplicas', { valueAsNumber: true })}
                                type="number"
                                min={1}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Max Replicas</label>
                              <input
                                {...register('maxReplicas', { valueAsNumber: true })}
                                type="number"
                                min={1}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Observability */}
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-gray-900">Observability</h2>
                  <AccessLogsCard
                    value={telemetryAccessLog}
                    onChange={setTelemetryAccessLog}
                  />
                  <TracingCard
                    value={telemetryTracing}
                    onChange={setTelemetryTracing}
                  />
                  <MetricsTuningCard
                    value={telemetryMetrics}
                    onChange={setTelemetryMetrics}
                  />
                </section>
              </div>
            </TabsContent>

            {/* PREVIEW TAB */}
            <TabsContent value="preview">
              <div className="mt-4 space-y-6">
                {/* Loading state */}
                {isLoadingPreview && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                    <span className="ml-3 text-gray-600">Generating preview...</span>
                  </div>
                )}

                {/* Preview error */}
                {previewError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{previewError}</p>
                  </div>
                )}

                {/* Manifest diff */}
                {!isLoadingPreview && previewResult && (
                  <>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">EnvoyProxy Manifest</h3>
                      <YamlDiffViewer
                        currentYaml={previewResult.currentEnvoyProxyYaml}
                        proposedYaml={previewResult.proposedEnvoyProxyYaml}
                        mode="update"
                      />
                    </div>

                    {/* AI Review Section */}
                    {aiEnabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Describe your changes (optional)
                          </label>
                          <textarea
                            value={changeDescription}
                            onChange={(e) => setChangeDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            placeholder="e.g., Increasing memory limits for high-traffic gateway..."
                          />
                        </div>
                        <Button
                          variant="secondary"
                          onClick={handleAIReview}
                          disabled={isLoadingAIReview}
                          isLoading={isLoadingAIReview}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Review with AI
                        </Button>
                        {aiReviewError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {aiReviewError}
                          </div>
                        )}
                        {aiReviewResult && <AIReviewCard review={aiReviewResult} />}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons — always visible below the card */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <Link href={detailUrl}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
        <Button
          variant="primary"
          onClick={handleApplyChanges}
          isLoading={isApplying}
        >
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
