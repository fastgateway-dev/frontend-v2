'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, AlertTriangle } from 'lucide-react';
import { Button, Card, CardContent, Input, Select, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
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
import type {
  CreateDomainTemplateInput,
  ExposureType,
  TLSMode,
  TLSPolicy,
  ExternalTrafficPolicy,
  ScalingType,
  AIReviewResult,
  DomainTemplateCreatePreviewResult,
  TelemetryAccessLogConfig,
  TelemetryTracingConfig,
  TelemetryMetricsConfig,
  PodPlacementConfig,
  PDBConfig,
  DeploymentStrategyConfig,
} from '@/types';

const ENVOY_GATEWAY_CONTROLLER = 'gateway.envoyproxy.io/gatewayclass-controller';

interface FormValues extends Omit<CreateDomainTemplateInput, 'annotations' | 'podAnnotations' | 'containerResources' | 'scalingConfig'> {
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

function buildCreateInput(data: FormValues, telemetry?: TelemetryState, scheduling?: SchedulingState): CreateDomainTemplateInput {
  const annotations: Record<string, string> = {};
  data.annotationsList.forEach(({ key, value }) => {
    if (key && value) {
      annotations[key] = value;
    }
  });

  const podAnnotations: Record<string, string> = {};
  data.podAnnotationsList.forEach(({ key, value }) => {
    if (key && value) {
      podAnnotations[key] = value;
    }
  });

  const hasResources = data.cpuRequest || data.memoryRequest || data.cpuLimit || data.memoryLimit;
  const containerResources = hasResources ? {
    requests: (data.cpuRequest || data.memoryRequest) ? {
      cpu: data.cpuRequest || undefined,
      memory: data.memoryRequest || undefined,
    } : undefined,
    limits: (data.cpuLimit || data.memoryLimit) ? {
      cpu: data.cpuLimit || undefined,
      memory: data.memoryLimit || undefined,
    } : undefined,
  } : undefined;

  const scalingConfig = data.scalingType === 'fixed'
    ? { type: 'fixed' as const, replicas: data.replicas }
    : data.scalingType === 'hpa'
    ? { type: 'hpa' as const, minReplicas: data.minReplicas, maxReplicas: data.maxReplicas }
    : undefined;

  const input: CreateDomainTemplateInput = {
    name: data.name,
    description: data.description,
    controllerName: data.controllerName,
    exposureType: data.exposureType as ExposureType,
    tlsMode: data.tlsMode as TLSMode,
    httpPort: data.httpPort,
    httpsPort: data.httpsPort,
    tlsPolicy: data.tlsPolicy as TLSPolicy,
    annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
    podAnnotations: Object.keys(podAnnotations).length > 0 ? podAnnotations : undefined,
    containerResources,
    scalingConfig,
    mergeGateways: data.mergeGateways,
  };

  if (data.exposureType === 'LoadBalancer') {
    if (data.externalTrafficPolicy) {
      input.externalTrafficPolicy = data.externalTrafficPolicy as ExternalTrafficPolicy;
    }
    if (data.loadBalancerClass) {
      input.loadBalancerClass = data.loadBalancerClass;
    }
  }

  if (telemetry) {
    input.telemetryAccessLog = telemetry.accessLog;
    input.telemetryTracing = telemetry.tracing;
    input.telemetryMetrics = telemetry.metrics;
  }

  if (scheduling) {
    input.podPlacement = scheduling.podPlacement;
    input.pdbConfig = scheduling.pdbConfig;
    input.deploymentStrategy = scheduling.deploymentStrategy;
  }

  return input;
}

export default function DomainTemplateCreatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  // Tab state
  const [activeTab, setActiveTab] = useState('settings');

  // Preview state
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<DomainTemplateCreatePreviewResult | null>(null);

  // AI review state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [isLoadingAIReview, setIsLoadingAIReview] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResult | null>(null);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);

  // Submit state
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Advanced settings toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Telemetry state (managed separately from react-hook-form)
  const [telemetryAccessLog, setTelemetryAccessLog] = useState<TelemetryAccessLogConfig | null>(null);
  const [telemetryTracing, setTelemetryTracing] = useState<TelemetryTracingConfig | null>(null);
  const [telemetryMetrics, setTelemetryMetrics] = useState<TelemetryMetricsConfig | null>(null);

  // Scheduling state (managed separately from react-hook-form)
  const [podPlacement, setPodPlacement] = useState<PodPlacementConfig | null>(null);
  const [pdbConfig, setPdbConfig] = useState<PDBConfig | null>(null);
  const [deploymentStrategy, setDeploymentStrategy] = useState<DeploymentStrategyConfig | null>(null);

  const { register, control, watch, getValues, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      controllerName: ENVOY_GATEWAY_CONTROLLER,
      exposureType: 'LoadBalancer',
      tlsMode: 'tls_only',
      httpPort: 80,
      httpsPort: 443,
      tlsPolicy: 'terminate',
      annotationsList: [],
      podAnnotationsList: [],
      cpuRequest: '',
      memoryRequest: '',
      cpuLimit: '',
      memoryLimit: '',
      scalingType: '',
      replicas: 2,
      minReplicas: 2,
      maxReplicas: 10,
      mergeGateways: false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'annotationsList' });
  const { fields: podAnnotationFields, append: appendPodAnnotation, remove: removePodAnnotation } = useFieldArray({ control, name: 'podAnnotationsList' });

  const watchExposureType = watch('exposureType');
  const watchTlsMode = watch('tlsMode');
  const watchScalingType = watch('scalingType');

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
      const values = getValues();
      const telemetry = { accessLog: telemetryAccessLog, tracing: telemetryTracing, metrics: telemetryMetrics };
      const scheduling = { podPlacement, pdbConfig, deploymentStrategy };
      const input = buildCreateInput(values, telemetry, scheduling);
      const result = await domainTemplatesApi.previewCreate(projectId, input);
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
      const values = getValues();
      const telemetry = { accessLog: telemetryAccessLog, tracing: telemetryTracing, metrics: telemetryMetrics };
      const scheduling = { podPlacement, pdbConfig, deploymentStrategy };
      const input = buildCreateInput(values, telemetry, scheduling);
      const result = await domainTemplatesApi.previewCreate(projectId, input, {
        includeAIReview: true,
        changeDescription: changeDescription || undefined,
      });
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

  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const values = getValues();
      const telemetry = { accessLog: telemetryAccessLog, tracing: telemetryTracing, metrics: telemetryMetrics };
      const scheduling = { podPlacement, pdbConfig, deploymentStrategy };
      const input = buildCreateInput(values, telemetry, scheduling);
      await domainTemplatesApi.create(projectId, input);
      router.push(`/projects/${projectId}/domain-templates`);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateError(errorObj.response?.data?.error || 'Failed to create domain template');
    } finally {
      setIsCreating(false);
    }
  };

  const listUrl = `/projects/${projectId}/domain-templates`;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href={listUrl} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" />Back to Templates
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Domain Template</h1>

      {/* Error message */}
      {createError && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Failed to create domain template</h4>
                <p className="mt-1 text-sm text-red-700 whitespace-pre-wrap">{createError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <div className="space-y-4 mt-4">
                <Input
                  id="name"
                  label="Name"
                  placeholder="e.g., public-api"
                  {...register('name', {
                    required: 'Name is required',
                    maxLength: { value: 63, message: 'Name must be 63 characters or less' },
                    pattern: {
                      value: /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/,
                      message: 'Must be lowercase, start with a letter, contain only letters, numbers, and dashes',
                    },
                    validate: {
                      noSpaces: (v) => !v.includes(' ') || 'Name cannot contain spaces',
                      noConsecutiveDashes: (v) => !v.includes('--') || 'Name cannot contain consecutive dashes',
                    },
                  })}
                  error={errors.name?.message}
                />

                <Input
                  id="description"
                  label="Description"
                  placeholder="Optional description"
                  {...register('description')}
                />

                <Select
                  id="controllerName"
                  label="Controller"
                  options={[
                    { value: ENVOY_GATEWAY_CONTROLLER, label: 'Envoy Gateway' },
                  ]}
                  {...register('controllerName', { required: 'Controller is required' })}
                  error={errors.controllerName?.message}
                />

                <Select
                  id="exposureType"
                  label="Service Type"
                  options={[
                    { value: 'LoadBalancer', label: 'LoadBalancer - External access via load balancer' },
                    { value: 'ClusterIP', label: 'ClusterIP - In-cluster access only' },
                  ]}
                  {...register('exposureType', { required: 'Service type is required' })}
                  error={errors.exposureType?.message}
                />

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...register('mergeGateways')}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Merge Gateways</span>
                  </label>
                  <p className="text-xs text-gray-500 ml-6">
                    When enabled, all domains using this template share a single Envoy proxy deployment instead of each getting their own.
                  </p>
                </div>

                <Select
                  id="tlsMode"
                  label="TLS"
                  options={[
                    { value: 'tls_only', label: 'TLS Only - HTTPS listener only' },
                    { value: 'no_tls', label: 'No TLS - HTTP listener only' },
                    { value: 'both', label: 'Both - HTTP and HTTPS listeners' },
                  ]}
                  {...register('tlsMode', { required: 'TLS mode is required' })}
                  error={errors.tlsMode?.message}
                />

                {/* Advanced Settings */}
                <div className="border border-gray-200 rounded-lg">
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <span>Advanced Settings</span>
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showAdvanced && (
                    <div className="px-4 pb-4 space-y-6 border-t border-gray-200 pt-4">
                      {watchTlsMode !== 'tls_only' && (
                        <Input
                          id="httpPort"
                          label="HTTP Port"
                          type="number"
                          placeholder="80"
                          {...register('httpPort', {
                            min: { value: 1, message: 'Port must be at least 1' },
                            max: { value: 65535, message: 'Port must be at most 65535' },
                            valueAsNumber: true,
                          })}
                          error={errors.httpPort?.message}
                        />
                      )}

                      {watchTlsMode !== 'no_tls' && (
                        <>
                          <Input
                            id="httpsPort"
                            label="HTTPS Port"
                            type="number"
                            placeholder="443"
                            {...register('httpsPort', {
                              min: { value: 1, message: 'Port must be at least 1' },
                              max: { value: 65535, message: 'Port must be at most 65535' },
                              valueAsNumber: true,
                            })}
                            error={errors.httpsPort?.message}
                          />

                          <Select
                            id="tlsPolicy"
                            label="TLS Policy"
                            options={[
                              { value: 'terminate', label: 'Terminate - TLS terminates at the gateway' },
                              { value: 'passthrough', label: 'Passthrough - TLS passes through to backend' },
                            ]}
                            {...register('tlsPolicy')}
                            error={errors.tlsPolicy?.message}
                          />
                        </>
                      )}

                      {watchExposureType === 'LoadBalancer' && (
                        <>
                          <Select
                            id="externalTrafficPolicy"
                            label="External Traffic Policy"
                            options={[
                              { value: '', label: 'Default' },
                              { value: 'Cluster', label: 'Cluster - Traffic may be routed to any node' },
                              { value: 'Local', label: 'Local - Traffic is routed only to local endpoints' },
                            ]}
                            {...register('externalTrafficPolicy')}
                          />

                          <Input
                            id="loadBalancerClass"
                            label="Load Balancer Class"
                            placeholder="Optional - e.g., service.k8s.aws/nlb"
                            {...register('loadBalancerClass')}
                          />
                        </>
                      )}

                      {/* Service Annotations */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Service Annotations</label>
                        <p className="text-sm text-gray-500 mb-3">
                          Add custom annotations for the Kubernetes service (e.g., cloud provider load balancer settings).
                        </p>
                        {fields.map((field, index) => (
                          <div key={field.id} className="flex gap-2 mb-2">
                            <Input placeholder="Key" {...register(`annotationsList.${index}.key`)} className="flex-1" />
                            <Input placeholder="Value" {...register(`annotationsList.${index}.value`)} className="flex-1" />
                            <Button type="button" variant="secondary" onClick={() => remove(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" variant="secondary" onClick={() => append({ key: '', value: '' })}>
                          <Plus className="h-4 w-4 mr-2" />Add Annotation
                        </Button>
                      </div>

                      {/* Resources sub-heading */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-medium uppercase text-gray-600">Resources</h4>

                        {/* Pod Annotations */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Pod Annotations</label>
                          <p className="text-sm text-gray-500 mb-3">
                            Add custom annotations for the Envoy proxy pods (e.g., Datadog, Prometheus scraping).
                          </p>
                          {podAnnotationFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 mb-2">
                              <Input placeholder="Key" {...register(`podAnnotationsList.${index}.key`)} className="flex-1" />
                              <Input placeholder="Value" {...register(`podAnnotationsList.${index}.value`)} className="flex-1" />
                              <Button type="button" variant="secondary" onClick={() => removePodAnnotation(index)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="secondary" onClick={() => appendPodAnnotation({ key: '', value: '' })}>
                            <Plus className="h-4 w-4 mr-2" />Add Pod Annotation
                          </Button>
                        </div>

                        {/* Container Resources */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Container Resources</label>
                          <p className="text-sm text-gray-500 mb-3">
                            Set CPU and memory requests/limits for the Envoy proxy container.
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <Input id="cpuRequest" label="CPU Request" placeholder="e.g., 100m" {...register('cpuRequest')} />
                            <Input id="memoryRequest" label="Memory Request" placeholder="e.g., 128Mi" {...register('memoryRequest')} />
                            <Input id="cpuLimit" label="CPU Limit" placeholder="e.g., 500m" {...register('cpuLimit')} />
                            <Input id="memoryLimit" label="Memory Limit" placeholder="e.g., 512Mi" {...register('memoryLimit')} />
                          </div>
                        </div>
                      </div>

                      {/* Scheduling sub-heading */}
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

                      {/* Lifecycle sub-heading */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-medium uppercase text-gray-600">Lifecycle</h4>
                        <DeploymentStrategyEditor value={deploymentStrategy} onChange={setDeploymentStrategy} />
                        <PdbEditor value={pdbConfig} onChange={setPdbConfig} />
                      </div>

                      {/* Scaling sub-heading */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-medium uppercase text-gray-600">Scaling</h4>
                        <div>
                          <p className="text-sm text-gray-500 mb-3">
                            Configure replica count or autoscaling for the Envoy proxy deployment.
                          </p>
                          <Select
                            id="scalingType"
                            label="Scaling Mode"
                            options={[
                              { value: '', label: 'Default (managed by Envoy Gateway)' },
                              { value: 'fixed', label: 'Fixed Replicas' },
                              { value: 'hpa', label: 'Autoscaling (HPA)' },
                            ]}
                            {...register('scalingType')}
                          />
                          {watchScalingType === 'fixed' && (
                            <div className="mt-3">
                              <Input
                                id="replicas"
                                label="Replicas"
                                type="number"
                                placeholder="2"
                                {...register('replicas', {
                                  min: { value: 1, message: 'Replicas must be at least 1' },
                                  valueAsNumber: true,
                                })}
                                error={errors.replicas?.message}
                              />
                            </div>
                          )}
                          {watchScalingType === 'hpa' && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <Input
                                id="minReplicas"
                                label="Min Replicas"
                                type="number"
                                placeholder="2"
                                {...register('minReplicas', {
                                  min: { value: 1, message: 'Min replicas must be at least 1' },
                                  valueAsNumber: true,
                                })}
                                error={errors.minReplicas?.message}
                              />
                              <Input
                                id="maxReplicas"
                                label="Max Replicas"
                                type="number"
                                placeholder="10"
                                {...register('maxReplicas', {
                                  min: { value: 1, message: 'Max replicas must be at least 1' },
                                  valueAsNumber: true,
                                  validate: (value) => {
                                    const min = getValues('minReplicas');
                                    return value >= min || 'Max replicas must be >= min replicas';
                                  },
                                })}
                                error={errors.maxReplicas?.message}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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

                <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm text-primary-800">
                    <strong>Note:</strong> Creating a domain template requires Envoy Gateway to be installed in your Kubernetes cluster.
                    If not installed, please follow the{' '}
                    <a
                      href="https://gateway.envoyproxy.io/docs/tasks/quickstart/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Envoy Gateway installation guide
                    </a>.
                  </p>
                </div>
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

                {/* Manifest preview */}
                {!isLoadingPreview && previewResult && (
                  <>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">GatewayClass</h3>
                      <YamlDiffViewer
                        proposedYaml={previewResult.gatewayClassYaml}
                        mode="create"
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">EnvoyProxy</h3>
                      <YamlDiffViewer
                        proposedYaml={previewResult.envoyProxyYaml}
                        mode="create"
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Gateway (Example)</h3>
                      <p className="text-sm text-gray-500 mb-3">
                        Example of what a domain&apos;s Gateway resource will look like with this template&apos;s TLS configuration.
                        Actual values (hostname, certificate) are set when creating a domain.
                      </p>
                      <YamlDiffViewer
                        proposedYaml={previewResult.gatewayYaml}
                        mode="create"
                      />
                    </div>

                    {/* AI Review Section */}
                    {aiEnabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Describe your configuration (optional)
                          </label>
                          <textarea
                            value={changeDescription}
                            onChange={(e) => setChangeDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            placeholder="e.g., Setting up a public-facing gateway with NLB for high-traffic API..."
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

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <Link href={listUrl}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
        <Button
          variant="primary"
          onClick={handleSubmit(handleCreate)}
          isLoading={isCreating}
        >
          Create Template
        </Button>
      </div>
    </div>
  );
}
