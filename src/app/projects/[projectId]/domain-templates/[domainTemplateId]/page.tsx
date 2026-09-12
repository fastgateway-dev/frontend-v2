'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, Server, Globe, Network } from 'lucide-react';
import { Button, Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Modal, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui';
import { AccessLogsCard } from '@/components/observability/AccessLogsCard';
import { TracingCard } from '@/components/observability/TracingCard';
import { MetricsTuningCard } from '@/components/observability/MetricsTuningCard';
import { NodeSelectorEditor } from '@/components/scheduling/NodeSelectorEditor';
import { TolerationsEditor } from '@/components/scheduling/TolerationsEditor';
import { TopologySpreadEditor } from '@/components/scheduling/TopologySpreadEditor';
import { PdbEditor } from '@/components/scheduling/PdbEditor';
import { DeploymentStrategyEditor } from '@/components/scheduling/DeploymentStrategyEditor';
import { domainTemplatesApi, permissionsApi } from '@/lib/api';
import type { DomainTemplate, Domain, ProjectPermissions, ExposureType, TLSMode } from '@/types';

export default function DomainTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const domainTemplateId = params.domainTemplateId as string;

  // State
  const [template, setTemplate] = useState<DomainTemplate | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [gatewayClassYaml, setGatewayClassYaml] = useState('');
  const [envoyProxyYaml, setEnvoyProxyYaml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, domainTemplateId]);

  const loadData = async () => {
    try {
      const [templateData, permsData] = await Promise.all([
        domainTemplatesApi.get(projectId, domainTemplateId),
        permissionsApi.getProjectPermissions(projectId),
      ]);
      setTemplate(templateData);
      setPermissions(permsData);

      // Load manifests and domains in parallel (may fail independently)
      const [manifestsData, domainsData] = await Promise.all([
        domainTemplatesApi.getManifests(projectId, domainTemplateId).catch(() => null),
        domainTemplatesApi.listDomains(projectId, domainTemplateId).catch(() => ({ data: [] as Domain[] })),
      ]);

      if (manifestsData) {
        setGatewayClassYaml(manifestsData.gatewayClassYaml);
        setEnvoyProxyYaml(manifestsData.envoyProxyYaml);
      }
      setDomains(domainsData.data || []);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      console.error('Failed to load data:', err);
      setError(errorObj.response?.data?.error || 'Failed to load domain template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    setIsDeleting(true);
    try {
      await domainTemplatesApi.delete(projectId, template.id);
      router.push(`/projects/${projectId}/domain-templates`);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      console.error('Failed to delete:', err);
      setError(errorObj.response?.data?.error || 'Failed to delete domain template');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Badge helper functions for status, exposure type, TLS mode
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>;
      case 'pending': return <Badge variant="warning">Pending</Badge>;
      case 'error': return <Badge variant="error">Error</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const getExposureBadge = (exposureType: ExposureType) => {
    switch (exposureType) {
      case 'LoadBalancer':
        return <Badge variant="default" className="flex items-center gap-1"><Globe className="h-3 w-3" />LoadBalancer</Badge>;
      case 'ClusterIP':
        return <Badge variant="info" className="flex items-center gap-1"><Network className="h-3 w-3" />ClusterIP</Badge>;
      default: return <Badge variant="default">{exposureType}</Badge>;
    }
  };

  const getTlsModeBadge = (tlsMode: TLSMode) => {
    switch (tlsMode) {
      case 'tls_only': return <Badge variant="success">TLS Only</Badge>;
      case 'no_tls': return <Badge variant="warning">No TLS</Badge>;
      case 'both': return <Badge variant="info">HTTP + HTTPS</Badge>;
      default: return <Badge variant="default">{tlsMode}</Badge>;
    }
  };

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

  // Error state
  if (error || !template) {
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
    <div className="p-8">
      {/* Back link */}
      <Link href={`/projects/${projectId}/domain-templates`} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" />Back to Domain Templates
      </Link>

      {/* Header with name, badges, and Edit/Delete buttons */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
            <Server className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
              {getStatusBadge(template.status)}
              {getExposureBadge(template.exposureType)}
              {getTlsModeBadge(template.tlsMode)}
              {template.mergeGateways && (
                <Badge variant="info" className="flex items-center gap-1">Merged</Badge>
              )}
            </div>
            {template.description && <p className="text-gray-600 mt-1">{template.description}</p>}
          </div>
        </div>

        {permissions?.canManageDomainTemplates && (
          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}/domain-templates/${domainTemplateId}/edit`}>
              <Button variant="secondary"><Pencil className="h-4 w-4 mr-2" />Edit</Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </Button>
          </div>
        )}
      </div>

      {/* Error status message */}
      {template.statusMessage && template.status === 'error' && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-3">
            <p className="text-sm text-red-700">{template.statusMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* 3 Tabs: Overview, Manifests, Domains */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="manifests">Manifests</TabsTrigger>
          <TabsTrigger value="domains">Domains ({domains.length})</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Basic Info card */}
            <Card>
              <CardContent className="py-4">
                <h3 className="font-semibold text-gray-900 mb-4">Basic Info</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Name:</span> <span className="font-medium">{template.name}</span></div>
                  <div><span className="text-gray-500">Controller:</span> <span className="font-medium">{template.controllerName}</span></div>
                  <div><span className="text-gray-500">Service Type:</span> <span className="font-medium">{template.exposureType}</span></div>
                  <div><span className="text-gray-500">TLS Mode:</span> <span className="font-medium capitalize">{template.tlsMode.replace('_', ' ')}</span></div>
                  <div><span className="text-gray-500">Merge Gateways:</span> <span className="font-medium">{template.mergeGateways ? 'Enabled' : 'Disabled'}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Port Configuration card */}
            <Card>
              <CardContent className="py-4">
                <h3 className="font-semibold text-gray-900 mb-4">Port Configuration</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {template.tlsMode !== 'tls_only' && (
                    <div><span className="text-gray-500">HTTP Port:</span> <span className="font-medium">{template.httpPort}</span></div>
                  )}
                  {template.tlsMode !== 'no_tls' && (
                    <>
                      <div><span className="text-gray-500">HTTPS Port:</span> <span className="font-medium">{template.httpsPort}</span></div>
                      <div><span className="text-gray-500">TLS Policy:</span> <span className="font-medium capitalize">{template.tlsPolicy}</span></div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Service Settings card */}
            {(template.externalTrafficPolicy || template.loadBalancerClass || Object.keys(template.annotations || {}).length > 0) && (
              <Card>
                <CardContent className="py-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Service Settings</h3>
                  <div className="space-y-3 text-sm">
                    {template.externalTrafficPolicy && (
                      <div><span className="text-gray-500">External Traffic Policy:</span> <span className="font-medium">{template.externalTrafficPolicy}</span></div>
                    )}
                    {template.loadBalancerClass && (
                      <div><span className="text-gray-500">Load Balancer Class:</span> <span className="font-medium">{template.loadBalancerClass}</span></div>
                    )}
                    {template.annotations && Object.keys(template.annotations).length > 0 && (
                      <div>
                        <span className="text-gray-500 block mb-2">Service Annotations:</span>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          {Object.entries(template.annotations).map(([key, value]) => (
                            <div key={key} className="font-mono text-xs">
                              <span className="text-primary-600">{key}</span>
                              <span className="text-gray-400">: </span>
                              <span className="text-gray-700">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Infrastructure Settings card */}
            {(Object.keys(template.podAnnotations || {}).length > 0 || template.containerResources || template.scalingConfig) && (
              <Card>
                <CardContent className="py-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Infrastructure Settings</h3>
                  <div className="space-y-3 text-sm">
                    {template.podAnnotations && Object.keys(template.podAnnotations).length > 0 && (
                      <div>
                        <span className="text-gray-500 block mb-2">Pod Annotations:</span>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          {Object.entries(template.podAnnotations).map(([key, value]) => (
                            <div key={key} className="font-mono text-xs">
                              <span className="text-primary-600">{key}</span>
                              <span className="text-gray-400">: </span>
                              <span className="text-gray-700">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {template.containerResources && (
                      <div>
                        <span className="text-gray-500 block mb-2">Container Resources:</span>
                        <div className="grid grid-cols-2 gap-2">
                          {template.containerResources.requests?.cpu && <div><span className="text-gray-500">CPU Request:</span> <span className="font-medium">{template.containerResources.requests.cpu}</span></div>}
                          {template.containerResources.requests?.memory && <div><span className="text-gray-500">Memory Request:</span> <span className="font-medium">{template.containerResources.requests.memory}</span></div>}
                          {template.containerResources.limits?.cpu && <div><span className="text-gray-500">CPU Limit:</span> <span className="font-medium">{template.containerResources.limits.cpu}</span></div>}
                          {template.containerResources.limits?.memory && <div><span className="text-gray-500">Memory Limit:</span> <span className="font-medium">{template.containerResources.limits.memory}</span></div>}
                        </div>
                      </div>
                    )}
                    {template.scalingConfig && (
                      <div>
                        <span className="text-gray-500">Scaling:</span>{' '}
                        <span className="font-medium">
                          {template.scalingConfig.type === 'fixed'
                            ? `Fixed - ${template.scalingConfig.replicas} replica(s)`
                            : `HPA - ${template.scalingConfig.minReplicas} to ${template.scalingConfig.maxReplicas} replicas`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata card */}
            <Card>
              <CardContent className="py-4">
                <h3 className="font-semibold text-gray-900 mb-4">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">K8s GatewayClass:</span> <span className="font-mono text-xs">{template.k8sGatewayClassName}</span></div>
                  {template.k8sEnvoyProxyName && <div><span className="text-gray-500">K8s EnvoyProxy:</span> <span className="font-mono text-xs">{template.k8sEnvoyProxyName}</span></div>}
                  <div><span className="text-gray-500">Created:</span> <span className="font-medium">{new Date(template.createdAt).toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Updated:</span> <span className="font-medium">{new Date(template.updatedAt).toLocaleString()}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Observability — only shown when at least one config is set */}
            {(template.telemetryAccessLog || template.telemetryTracing || template.telemetryMetrics) && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-gray-900">Observability</h2>
                <AccessLogsCard
                  value={template.telemetryAccessLog ?? null}
                  onChange={() => {}}
                  disabled
                />
                <TracingCard
                  value={template.telemetryTracing ?? null}
                  onChange={() => {}}
                  disabled
                />
                <MetricsTuningCard
                  value={template.telemetryMetrics ?? null}
                  onChange={() => {}}
                  disabled
                />
              </section>
            )}

            {/* Scheduling & lifecycle — only shown when at least one config is set */}
            {(template.podPlacement || template.pdbConfig || template.deploymentStrategy) && (
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-gray-900">Scheduling &amp; lifecycle</h3>
                {template.podPlacement && (
                  <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                    <NodeSelectorEditor value={template.podPlacement.nodeSelector} onChange={() => {}} disabled />
                    <TolerationsEditor value={template.podPlacement.tolerations} onChange={() => {}} disabled />
                    <TopologySpreadEditor value={template.podPlacement.topologySpreadConstraints} onChange={() => {}} disabled />
                    {template.podPlacement.priorityClassName && (
                      <div className="text-sm">
                        <span className="text-xs text-gray-700">Priority class: </span>
                        <span className="font-mono">{template.podPlacement.priorityClassName}</span>
                      </div>
                    )}
                  </div>
                )}
                {template.deploymentStrategy && <DeploymentStrategyEditor value={template.deploymentStrategy} onChange={() => {}} disabled />}
                {template.pdbConfig && <PdbEditor value={template.pdbConfig} onChange={() => {}} disabled />}
              </section>
            )}
          </div>
        </TabsContent>

        {/* MANIFESTS TAB */}
        <TabsContent value="manifests">
          <Accordion type="multiple" defaultValue={['gatewayclass', 'envoyproxy']}>
            <AccordionItem value="gatewayclass">
              <AccordionTrigger value="gatewayclass">GatewayClass</AccordionTrigger>
              <AccordionContent value="gatewayclass">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {gatewayClassYaml || 'Loading...'}
                </pre>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="envoyproxy">
              <AccordionTrigger value="envoyproxy">EnvoyProxy</AccordionTrigger>
              <AccordionContent value="envoyproxy">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {envoyProxyYaml || 'Loading...'}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* DOMAINS TAB */}
        <TabsContent value="domains">
          {domains.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No domains yet</h3>
                <p className="text-gray-600">No domains are using this template</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <Link key={domain.id} href={`/projects/${projectId}/domains/${domain.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                          <Globe className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{domain.hostname}</h3>
                          <p className="text-sm text-gray-500">{domain.name}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Domain Template">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete the domain template <span className="font-semibold">{template.name}</span>?
          </p>
          {domains.length > 0 && (
            <p className="text-sm text-red-600">Warning: {domains.length} domain(s) are using this template. They may stop working.</p>
          )}
          <p className="text-sm text-red-600">This will also delete the GatewayClass and EnvoyProxy resources from your Kubernetes cluster.</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
