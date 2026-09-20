'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Route as RouteIcon, Rocket, Info, Search, Shield } from 'lucide-react';
import { Button, Card, CardContent, Badge, Select, Tabs, TabsList, TabsTrigger, TabsContent, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui';
import { domainsApi, routesApi, permissionsApi, projectsApi, certificatesApi } from '@/lib/api';
import { MetricsTab } from '@/components/metrics/MetricsTab';
import { NewRouteModal } from '@/components/NewRouteModal';
import { aiApi } from '@/lib/api/ai';
import { certStatusBadge } from '@/lib/utils/certificates';
import type { Domain, Route, Project, ProjectPermissions, DomainSettings, EnrichedCertificate } from '@/types';

export default function DomainDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const domainId = params.domainId as string;

  const [domain, setDomain] = useState<Domain | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deployingRouteId, setDeployingRouteId] = useState<string | null>(null);

  // Domain Settings state
  const [domainSettings, setDomainSettings] = useState<DomainSettings | null>(null);

  // Managed certificate attach/detach state
  const [certificates, setCertificates] = useState<EnrichedCertificate[]>([]);
  const [selectedCertificateId, setSelectedCertificateId] = useState('');
  const [isAttachingCert, setIsAttachingCert] = useState(false);
  const [isDetachingCert, setIsDetachingCert] = useState(false);
  const [certActionError, setCertActionError] = useState<string | null>(null);

  // YAML manifest state
  const [gatewayYaml, setGatewayYaml] = useState('');
  const [clientTrafficPolicyYaml, setClientTrafficPolicyYaml] = useState('');
  const [backendTrafficPolicyYaml, setBackendTrafficPolicyYaml] = useState('');
  const [envoyExtensionPolicyYaml, setEnvoyExtensionPolicyYaml] = useState('');

  // AI enabled state
  const [aiEnabled, setAiEnabled] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'name' | 'path' | 'owner' | 'labels'>('all');
  const [isSearching, setIsSearching] = useState(false);

  // New route modal state
  const [newRouteModalOpen, setNewRouteModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId, domainId]);

  const loadData = async () => {
    try {
      const [domainData, routesData, permsData, settingsData, yamlsData, aiStatus, projectData, certificatesData] = await Promise.all([
        domainsApi.get(projectId, domainId),
        routesApi.list(projectId, domainId),
        permissionsApi.getProjectPermissions(projectId),
        domainsApi.getSettings(projectId, domainId).catch(() => null),
        domainsApi.getYamls(projectId, domainId).catch(() => null),
        aiApi.getStatus().catch(() => ({ enabled: false })),
        projectsApi.get(projectId).catch(() => null),
        certificatesApi.list(projectId).catch(() => []),
      ]);
      setDomain(domainData);
      setRoutes(routesData.data);
      setPermissions(permsData);
      setProject(projectData);
      setCertificates(certificatesData);
      if (settingsData) {
        setDomainSettings(settingsData);
      }
      setGatewayYaml(yamlsData?.gatewayYaml || '');
      setClientTrafficPolicyYaml(yamlsData?.clientTrafficPolicyYaml || '');
      setBackendTrafficPolicyYaml(yamlsData?.backendTrafficPolicyYaml || '');
      setEnvoyExtensionPolicyYaml(yamlsData?.envoyExtensionPolicyYaml || '');
      setAiEnabled(aiStatus.enabled);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Search routes with debounce
  const searchRoutes = useCallback(async (query: string, field: 'all' | 'name' | 'path' | 'owner' | 'labels') => {
    setIsSearching(true);
    try {
      const search = field !== 'labels' ? query || undefined : undefined;
      const searchFieldParam = field !== 'labels' && query ? field : undefined;
      const labels = field === 'labels' ? query || undefined : undefined;
      const routesData = await routesApi.list(
        projectId, domainId, 1, 100, undefined, undefined,
        search, searchFieldParam, labels
      );
      setRoutes(routesData.data);
    } catch (error) {
      console.error('Failed to search routes:', error);
    } finally {
      setIsSearching(false);
    }
  }, [projectId, domainId]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchRoutes(searchQuery, searchField);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchField, searchRoutes]);

  const handleDeploy = async (routeId: string) => {
    setDeployingRouteId(routeId);
    try {
      await routesApi.deploy(projectId, domainId, routeId);
      await loadData();
    } catch (error) {
      console.error('Failed to deploy route:', error);
      alert('Failed to deploy route. Please try again.');
    } finally {
      setDeployingRouteId(null);
    }
  };

  const canDeployRoute = (route: Route) => {
    return route.status === 'approved' || route.status === 'pending_deploy';
  };

  const attachableCertificates = certificates.filter(
    (c) => c.usage === 'server' && c.status === 'ready'
  );
  const attachedCertificate = domain?.managedCertificateId
    ? certificates.find((c) => c.id === domain.managedCertificateId) || null
    : null;

  const handleAttachCertificate = async () => {
    if (!selectedCertificateId) return;
    setCertActionError(null);
    setIsAttachingCert(true);
    try {
      const updated = await domainsApi.attachCertificate(projectId, domainId, selectedCertificateId);
      setDomain(updated);
      setSelectedCertificateId('');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      if (error.response?.status === 422) {
        setCertActionError(error.response?.data?.error || 'This certificate cannot be attached (wrong usage or not ready).');
      } else {
        setCertActionError(error.response?.data?.error || 'Failed to attach certificate.');
      }
    } finally {
      setIsAttachingCert(false);
    }
  };

  const handleDetachCertificate = async () => {
    setCertActionError(null);
    setIsDetachingCert(true);
    try {
      const updated = await domainsApi.detachCertificate(projectId, domainId);
      setDomain(updated);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      setCertActionError(error.response?.data?.error || 'Failed to detach certificate.');
    } finally {
      setIsDetachingCert(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'approved':
        return <Badge variant="info">Approved - Ready to Deploy</Badge>;
      case 'pending_deploy':
        return <Badge variant="info">Pending Deploy</Badge>;
      case 'pending_create':
      case 'pending_update':
      case 'pending_delete':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'rejected':
        return <Badge variant="error">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
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
      <Link
        href={`/projects/${projectId}/domains`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Domains
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{domain?.hostname}</h1>
          <p className="text-gray-600 mt-1">
            {domain?.tlsMode !== 'tls_only' && `HTTP: ${domain?.httpPort}`}
            {domain?.tlsMode === 'both' && ' · '}
            {domain?.tlsMode !== 'no_tls' && `HTTPS: ${domain?.httpsPort}`}
            {' · TLS: '}{domain?.tlsSecretName
              ? `${domain.tlsSecretName}${domain.tlsSecretNamespace && domain.tlsSecretNamespace !== 'fastgateway-system' ? ` (${domain.tlsSecretNamespace})` : ''}`
              : 'None'}
          </p>
        </div>
        {permissions?.canCreateRoutes && (
          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}/domains/${domainId}/import`}>
              <Button variant="secondary">
                Import Route
              </Button>
            </Link>
            <Button onClick={() => setNewRouteModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Route
            </Button>
          </div>
        )}
      </div>

      <NewRouteModal
        isOpen={newRouteModalOpen}
        onClose={() => setNewRouteModalOpen(false)}
        projectId={projectId}
        domainId={domainId}
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Managed Certificate
          </h2>

          {attachedCertificate ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{attachedCertificate.name}</span>
                <Badge variant={certStatusBadge(attachedCertificate.status).variant}>
                  {certStatusBadge(attachedCertificate.status).label}
                </Badge>
              </div>
              {permissions?.canManageDomains && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDetachCertificate}
                  disabled={isDetachingCert}
                >
                  {isDetachingCert ? 'Detaching...' : 'Detach'}
                </Button>
              )}
            </div>
          ) : domain?.managedCertificateId ? (
            <p className="text-sm text-gray-500">
              A managed certificate is attached (id: {domain.managedCertificateId}), but its details could not be loaded.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              No managed certificate attached.
              {domain?.tlsSecretName
                ? ' TLS currently falls back to the legacy secret shown above.'
                : ' TLS has no legacy secret configured either.'}
            </p>
          )}

          {permissions?.canManageDomains && !attachedCertificate && (
            <div className="flex items-end gap-2 mt-3">
              <div className="flex-1 max-w-sm">
                <Select
                  label="Attach a server certificate"
                  value={selectedCertificateId}
                  onChange={(e) => {
                    setSelectedCertificateId(e.target.value);
                    setCertActionError(null);
                  }}
                  options={[
                    { value: '', label: attachableCertificates.length ? 'Select a certificate...' : 'No ready server certificates available' },
                    ...attachableCertificates.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  disabled={attachableCertificates.length === 0}
                />
              </div>
              <Button
                onClick={handleAttachCertificate}
                disabled={!selectedCertificateId || isAttachingCert}
              >
                {isAttachingCert ? 'Attaching...' : 'Attach'}
              </Button>
            </div>
          )}

          {certActionError && (
            <p className="mt-2 text-sm text-red-600">{certActionError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Tabs
            defaultValue="routes"
            onValueChange={(v) => {
              if (v === 'topology') {
                router.push(`/projects/${projectId}/domains/${domainId}/topology`);
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="routes">
                Routes
                {routes.length > 0 && (
                  <Badge variant="default" className="ml-2 text-xs">{routes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="topology">
                Topology
              </TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="settings">
                Settings
              </TabsTrigger>
              <TabsTrigger value="manifests">
                Manifests
              </TabsTrigger>
            </TabsList>

            {/* Routes Tab */}
            <TabsContent value="routes">
              {/* Search Bar */}
              <div className="flex items-center gap-2 mb-4 mt-2">
                <div className="relative flex-1 max-w-md">
                  <div className="flex">
                    <select
                      value={searchField}
                      onChange={(e) => {
                        setSearchField(e.target.value as 'all' | 'name' | 'path' | 'owner' | 'labels');
                        setSearchQuery('');
                      }}
                      className="px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Fields</option>
                      <option value="name">Name</option>
                      <option value="path">Path</option>
                      <option value="owner">Owner</option>
                      <option value="labels">Labels</option>
                    </select>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder={searchField === 'labels'
                          ? 'Filter by labels (e.g. env=production,region=us-east)'
                          : 'Search routes...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-r-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
                {isSearching && (
                  <span className="text-sm text-gray-500">Searching...</span>
                )}
              </div>

              {routes.length === 0 ? (
                <div className="py-12 text-center">
                  <RouteIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? 'No routes found' : 'No routes yet'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery
                      ? `No routes match your search "${searchQuery}"${searchField !== 'all' ? ` in ${searchField}` : ''}`
                      : permissions?.canCreateRoutes
                        ? 'Create your first route to start routing traffic'
                        : 'No routes have been created for this domain yet'}
                  </p>
                  {searchQuery && (
                    <Button variant="secondary" onClick={() => { setSearchQuery(''); }}>
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {routes.map((route) => (
                    <Link
                      key={route.id}
                      href={`/projects/${projectId}/domains/${domainId}/routes/${route.id}`}
                      className="block"
                    >
                      <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{route.name}</h3>
                              {route.protocol === 'grpc' && (
                                <Badge variant="info" className="text-xs">GRPC</Badge>
                              )}
                              {getStatusBadge(route.status)}
                              {route.securityStatus === 'warning' && (
                                <Badge variant="warning" className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  Unprotected
                                </Badge>
                              )}
                              {(route.securityMode === 'general' || !route.securityMode) && route.securityPolicy?.config?.oidc && (
                                <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">OIDC</Badge>
                              )}
                              {(route.securityMode === 'general' || !route.securityMode) && route.securityPolicy?.config?.jwt && (
                                <Badge variant="info" className="dark:bg-primary-900 dark:text-primary-200">JWT</Badge>
                              )}
                              {(route.securityMode === 'general' || !route.securityMode) && route.securityPolicy?.config?.apiKeyAuth && (
                                <Badge variant="success" className="dark:bg-green-900 dark:text-green-200">API Key</Badge>
                              )}
                              {(route.securityMode === 'general' || !route.securityMode) && route.securityPolicy?.config?.authorization && (
                                <Badge variant="warning" className="dark:bg-yellow-900 dark:text-yellow-200">IP</Badge>
                              )}
                              {route.securityMode === 'client' && (route.clientCount ?? 0) > 0 && (
                                <Badge className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">Clients: {route.clientCount}</Badge>
                              )}
                            </div>
                            {route.labels && Object.keys(route.labels).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(route.labels).map(([key, value]) => (
                                  <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                    {key}{value ? `=${value}` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-sm text-gray-500 mt-1">
                              {route.protocol === 'grpc' ? (
                                <>
                                  {route.config.matches?.[0]?.grpcService?.value || route.config.matches?.[0]?.grpcMethod?.value
                                    ? `/${route.config.matches?.[0]?.grpcService?.value || '*'}/${route.config.matches?.[0]?.grpcMethod?.value || '*'}`
                                    : 'All gRPC methods'}
                                </>
                              ) : (
                                <>{route.config.matches?.[0]?.path?.type}: {route.config.matches?.[0]?.path?.value}</>
                              )}
                              {route.config.routeType === 'redirect' ? (
                                <span> → Redirect {route.config.redirect?.statusCode || 301}</span>
                              ) : route.config.backends?.[0] ? (
                                <span> → {route.config.backends[0].service}:{route.config.backends[0].port}</span>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {canDeployRoute(route) && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeploy(route.id);
                                }}
                                disabled={deployingRouteId === route.id}
                              >
                                <Rocket className="h-4 w-4 mr-1" />
                                {deployingRouteId === route.id ? 'Deploying...' : 'Deploy'}
                              </Button>
                            )}
                            <Badge variant="info">{route.team?.name || 'Unknown Team'}</Badge>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Metrics Tab */}
            <TabsContent value="metrics">
              <MetricsTab
                kind="domain"
                projectId={projectId}
                domainId={domainId}
                metricsConfigured={Boolean(project?.metricsEndpointUrl)}
                canEditProject={Boolean(permissions?.isProjectAdmin || permissions?.isOwner)}
              />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              {permissions?.canManageDomains && (
                <div className="flex justify-end mb-4 mt-2">
                  <Link href={`/projects/${projectId}/domains/${domainId}/settings`}>
                    <Button variant="secondary">Edit Settings</Button>
                  </Link>
                </div>
              )}

              {(() => {
                const s = domainSettings?.settings;
                const conn = s?.clientConnection;
                const ipd = s?.clientIPDetection;
                const timeout = s?.timeout;
                const tls = s?.tls;
                const mtls = s?.mtls;
                const btp = domainSettings?.backendTrafficPolicy;
                const ext = domainSettings?.extensionPolicy;

                const renderValue = (label: string, value: string | number | boolean | undefined | null) => {
                  if (value === undefined || value === null || value === '') return null;
                  return (
                    <div className="flex justify-between py-1">
                      <span className="text-sm text-gray-500">{label}</span>
                      <span className="text-sm font-medium text-gray-900">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
                    </div>
                  );
                };

                return (
                  <Accordion type="multiple" defaultValue={['client-settings', 'backend-settings', 'extensions']}>
                    {/* Client Settings Group */}
                    <AccordionItem value="client-settings">
                      <AccordionTrigger value="client-settings">Client Settings</AccordionTrigger>
                      <AccordionContent value="client-settings">
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">Client-facing settings applied via ClientTrafficPolicy.</p>
                          <Accordion type="multiple" defaultValue={['connection', 'ipdetection', 'timeouts', 'protocol', 'tls', 'mtls']}>
                            {/* Client Connection */}
                            <AccordionItem value="connection">
                              <AccordionTrigger value="connection">Client Connection</AccordionTrigger>
                              <AccordionContent value="connection">
                                <div className="space-y-3 p-3">
                                  {conn?.tcpKeepalive ? (
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 mb-1">TCP Keepalive</h4>
                                      {renderValue('Probes', conn.tcpKeepalive.probes)}
                                      {renderValue('Idle Time', conn.tcpKeepalive.idleTime)}
                                      {renderValue('Interval', conn.tcpKeepalive.interval)}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400">TCP Keepalive: Not configured</p>
                                  )}
                                  {renderValue('PROXY Protocol', conn?.proxyProtocol?.enabled)}
                                  {conn?.connectionLimit ? (
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 mb-1">Connection Limits</h4>
                                      {renderValue('Max Connections', conn.connectionLimit.maxConnections)}
                                      {renderValue('Close Delay', conn.connectionLimit.closeDelay)}
                                      {renderValue('Max Duration', conn.connectionLimit.maxConnectionDuration)}
                                      {renderValue('Max Requests/Conn', conn.connectionLimit.maxRequestsPerConnection)}
                                    </div>
                                  ) : null}
                                  {renderValue('Buffer Limit', conn?.bufferLimit)}
                                  {!conn && <p className="text-sm text-gray-400">Not configured</p>}
                                </div>
                              </AccordionContent>
                            </AccordionItem>

                            {/* Client IP Detection */}
                            <AccordionItem value="ipdetection">
                              <AccordionTrigger value="ipdetection">Client IP Detection</AccordionTrigger>
                              <AccordionContent value="ipdetection">
                                <div className="p-3">
                                  {ipd?.xForwardedFor ? (
                                    <div>
                                      <p className="text-sm text-gray-700">Method: X-Forwarded-For</p>
                                      {renderValue('Trusted Hops', ipd.xForwardedFor.numTrustedHops)}
                                    </div>
                                  ) : ipd?.customHeader ? (
                                    <div>
                                      <p className="text-sm text-gray-700">Method: Custom Header</p>
                                      {renderValue('Header Name', ipd.customHeader.name)}
                                      {renderValue('Fail Closed', ipd.customHeader.failClosed)}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400">Not configured (using L4 source IP)</p>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>

                            {/* Client Timeout */}
                            <AccordionItem value="timeouts">
                              <AccordionTrigger value="timeouts">Client Timeout</AccordionTrigger>
                              <AccordionContent value="timeouts">
                                <div className="p-3">
                                  {timeout?.http ? (
                                    <div>
                                      {renderValue('Request Received Timeout', timeout.http.requestReceivedTimeout)}
                                      {renderValue('HTTP Idle Timeout', timeout.http.idleTimeout)}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400">Not configured</p>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>

                            {/* Protocol */}
                            <AccordionItem value="protocol">
                              <AccordionTrigger value="protocol">Protocol</AccordionTrigger>
                              <AccordionContent value="protocol">
                                <div className="p-3">
                                  {renderValue('HTTP/3 (QUIC)', s?.http3?.enabled) || (
                                    <p className="text-sm text-gray-400">HTTP/3: Disabled</p>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>

                            {/* TLS Settings */}
                            <AccordionItem value="tls">
                              <AccordionTrigger value="tls">TLS Settings</AccordionTrigger>
                              <AccordionContent value="tls">
                                <div className="p-3">
                                  {tls ? (
                                    <div>
                                      {renderValue('Min Version', tls.minVersion)}
                                      {renderValue('Max Version', tls.maxVersion)}
                                      {tls.ciphers && tls.ciphers.length > 0 && (
                                        <div className="mt-2">
                                          <span className="text-sm text-gray-500">Ciphers:</span>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {tls.ciphers.map((c, i) => (
                                              <Badge key={i} variant="default" className="text-xs">{c}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400">Not configured (using defaults)</p>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>

                            {/* mTLS */}
                            <AccordionItem value="mtls">
                              <AccordionTrigger value="mtls">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  <span>Mutual TLS (Client Certificates)</span>
                                  {mtls?.enabled && <Badge variant="success" className="ml-2">Enabled</Badge>}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent value="mtls">
                                <div className="p-3">
                                  {mtls?.enabled ? (
                                    <div className="space-y-3">
                                      {renderValue('Validation Mode', mtls.optional ? 'Optional' : 'Required')}
                                      {mtls.caCerts && mtls.caCerts.length > 0 && (
                                        <div>
                                          <span className="text-sm text-gray-500">CA Certificates:</span>
                                          <div className="mt-1 space-y-1">
                                            {mtls.caCerts.map((ca) => (
                                              <div key={ca.id} className="flex items-center gap-2 text-sm">
                                                <Badge variant="info">{ca.name}</Badge>
                                                <span className="text-xs text-gray-500">{ca.secretName}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {mtls.sanWhitelist && mtls.sanWhitelist.length > 0 && (
                                        <div>
                                          <span className="text-sm text-gray-500">SAN Whitelist:</span>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {mtls.sanWhitelist.map((san, i) => (
                                              <Badge key={i} variant="info">{san.type}: {san.value}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {mtls.hashWhitelist && mtls.hashWhitelist.length > 0 && (
                                        <div>
                                          <span className="text-sm text-gray-500">Hash Whitelist:</span>
                                          <div className="mt-1 space-y-1">
                                            {mtls.hashWhitelist.map((h, i) => (
                                              <div key={i} className="text-xs font-mono text-gray-700 truncate">{h}</div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400">Not configured</p>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Backend Settings Group */}
                    <AccordionItem value="backend-settings">
                      <AccordionTrigger value="backend-settings">Backend Settings</AccordionTrigger>
                      <AccordionContent value="backend-settings">
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">Backend traffic policies applied via BackendTrafficPolicy.</p>
                          {btp ? (
                            <Accordion type="multiple" defaultValue={[]}>
                              {btp.compression && btp.compression.length > 0 && (
                                <AccordionItem value="btp-compression">
                                  <AccordionTrigger value="btp-compression" badge={<Badge variant="success">{btp.compression.length} type{btp.compression.length > 1 ? 's' : ''}</Badge>}>
                                    Response Compression
                                  </AccordionTrigger>
                                  <AccordionContent value="btp-compression">
                                    <div className="p-3">
                                      <div className="flex flex-wrap gap-1">
                                        {btp.compression.map((c, i) => (
                                          <Badge key={i} variant="info">{c.type}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {btp.retry && (
                                <AccordionItem value="btp-retry">
                                  <AccordionTrigger value="btp-retry" badge={<Badge variant="success">Configured</Badge>}>
                                    Retry Policy
                                  </AccordionTrigger>
                                  <AccordionContent value="btp-retry">
                                    <div className="p-3 space-y-1">
                                      {renderValue('Max Retries', btp.retry.numRetries)}
                                      {btp.retry.retryOn?.httpStatusCodes && btp.retry.retryOn.httpStatusCodes.length > 0 && renderValue('Status Codes', btp.retry.retryOn.httpStatusCodes.join(', '))}
                                      {btp.retry.retryOn?.triggers && btp.retry.retryOn.triggers.length > 0 && renderValue('Triggers', btp.retry.retryOn.triggers.join(', '))}
                                      {btp.retry.perRetryPolicy?.timeout && renderValue('Per-Retry Timeout', btp.retry.perRetryPolicy.timeout)}
                                      {btp.retry.perRetryPolicy?.backOff?.baseInterval && renderValue('Backoff Base Interval', btp.retry.perRetryPolicy.backOff.baseInterval)}
                                      {btp.retry.perRetryPolicy?.backOff?.maxInterval && renderValue('Backoff Max Interval', btp.retry.perRetryPolicy.backOff.maxInterval)}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {btp.loadBalancer && (
                                <AccordionItem value="btp-lb">
                                  <AccordionTrigger value="btp-lb" badge={<Badge variant="success">{btp.loadBalancer.type}</Badge>}>
                                    Load Balancing
                                  </AccordionTrigger>
                                  <AccordionContent value="btp-lb">
                                    <div className="p-3 space-y-1">
                                      {renderValue('Algorithm', btp.loadBalancer.type)}
                                      {btp.loadBalancer.consistentHash && (
                                        <>
                                          {renderValue('Hash Type', btp.loadBalancer.consistentHash.type)}
                                          {btp.loadBalancer.consistentHash.header && renderValue('Header', btp.loadBalancer.consistentHash.header.name)}
                                          {btp.loadBalancer.consistentHash.cookie && renderValue('Cookie', btp.loadBalancer.consistentHash.cookie.name)}
                                          {btp.loadBalancer.consistentHash.cookie?.ttl && renderValue('Cookie TTL', btp.loadBalancer.consistentHash.cookie.ttl)}
                                        </>
                                      )}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {btp.circuitBreaker && (
                                <AccordionItem value="btp-cb">
                                  <AccordionTrigger value="btp-cb" badge={<Badge variant="success">Configured</Badge>}>
                                    Circuit Breaker
                                  </AccordionTrigger>
                                  <AccordionContent value="btp-cb">
                                    <div className="p-3 space-y-1">
                                      {renderValue('Max Connections', btp.circuitBreaker.maxConnections)}
                                      {renderValue('Max Pending Requests', btp.circuitBreaker.maxPendingRequests)}
                                      {renderValue('Max Parallel Requests', btp.circuitBreaker.maxParallelRequests)}
                                      {renderValue('Max Parallel Retries', btp.circuitBreaker.maxParallelRetries)}
                                      {renderValue('Max Requests/Connection', btp.circuitBreaker.maxRequestsPerConnection)}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {btp.timeout && (
                                <AccordionItem value="btp-timeout">
                                  <AccordionTrigger value="btp-timeout" badge={<Badge variant="success">Configured</Badge>}>
                                    Backend Timeout
                                  </AccordionTrigger>
                                  <AccordionContent value="btp-timeout">
                                    <div className="p-3 space-y-1">
                                      {btp.timeout.tcp && renderValue('TCP Connect Timeout', btp.timeout.tcp.connectTimeout)}
                                      {btp.timeout.http?.requestTimeout && renderValue('Request Timeout', btp.timeout.http.requestTimeout)}
                                      {btp.timeout.http?.connectionIdleTimeout && renderValue('Connection Idle Timeout', btp.timeout.http.connectionIdleTimeout)}
                                      {btp.timeout.http?.maxConnectionDuration && renderValue('Max Connection Duration', btp.timeout.http.maxConnectionDuration)}
                                      {btp.timeout.http?.maxStreamDuration && renderValue('Max Stream Duration', btp.timeout.http.maxStreamDuration)}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {btp.requestBuffer && (
                                <AccordionItem value="btp-buffer">
                                  <AccordionTrigger value="btp-buffer" badge={<Badge variant="success">Configured</Badge>}>
                                    Request Buffering
                                  </AccordionTrigger>
                                  <AccordionContent value="btp-buffer">
                                    <div className="p-3">
                                      {renderValue('Max Request Bytes', btp.requestBuffer.limit)}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {btp.responseOverride && btp.responseOverride.length > 0 && (
                                <AccordionItem value="btp-override">
                                  <AccordionTrigger value="btp-override" badge={<Badge variant="success">{btp.responseOverride.length} rule{btp.responseOverride.length > 1 ? 's' : ''}</Badge>}>
                                    Response Override
                                  </AccordionTrigger>
                                  <AccordionContent value="btp-override">
                                    <div className="p-3 space-y-2">
                                      {btp.responseOverride.map((ro, i) => (
                                        <div key={i} className="text-sm">
                                          <span className="font-medium">Status {ro.match?.statusCodes?.map(sc => `${sc.type === 'Value' ? sc.value : `${sc.range?.start}-${sc.range?.end}`}`).join(', ')}</span>
                                          <span className="text-gray-500"> → {ro.response?.contentType} ({ro.response?.body?.type || 'empty'})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                            </Accordion>
                          ) : (
                            <p className="text-sm text-gray-400">No backend traffic policies configured</p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Extensions Group */}
                    <AccordionItem value="extensions">
                      <AccordionTrigger value="extensions">Extensions</AccordionTrigger>
                      <AccordionContent value="extensions">
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">Envoy extensions applied via EnvoyExtensionPolicy.</p>
                          {ext ? (
                            <Accordion type="multiple" defaultValue={[]}>
                              {ext.lua && (
                                <AccordionItem value="ext-lua">
                                  <AccordionTrigger value="ext-lua" badge={<Badge variant="success">{ext.lua.type === 'Inline' ? 'Inline' : 'ConfigMap'}</Badge>}>
                                    Lua Extension
                                  </AccordionTrigger>
                                  <AccordionContent value="ext-lua">
                                    <div className="p-3">
                                      {renderValue('Type', ext.lua.type)}
                                      {ext.lua.type === 'Inline' && ext.lua.inline && (
                                        <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{ext.lua.inline}</pre>
                                      )}
                                      {ext.lua.valueRef && (
                                        <div className="mt-1">
                                          {renderValue('ConfigMap', ext.lua.valueRef.name)}
                                          {renderValue('Namespace', ext.lua.valueRef.namespace)}
                                        </div>
                                      )}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {ext.wasm && (
                                <AccordionItem value="ext-wasm">
                                  <AccordionTrigger value="ext-wasm" badge={<Badge variant="success">{ext.wasm.name}</Badge>}>
                                    Wasm Extension
                                  </AccordionTrigger>
                                  <AccordionContent value="ext-wasm">
                                    <div className="p-3 space-y-1">
                                      {renderValue('Name', ext.wasm.name)}
                                      {renderValue('Root ID', ext.wasm.rootID)}
                                      {renderValue('Code Type', ext.wasm.code?.type)}
                                      {ext.wasm.code?.http && renderValue('URL', ext.wasm.code.http.url)}
                                      {ext.wasm.code?.image && renderValue('Image', ext.wasm.code.image.url)}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                              {ext.extProc && (
                                <AccordionItem value="ext-extproc">
                                  <AccordionTrigger value="ext-extproc" badge={<Badge variant="success">{ext.extProc.backendRef?.name || 'ext-proc'}</Badge>}>
                                    External Processing (ext-proc)
                                  </AccordionTrigger>
                                  <AccordionContent value="ext-extproc">
                                    <div className="p-3 space-y-1">
                                      {renderValue('Service', ext.extProc.backendRef?.name)}
                                      {renderValue('Namespace', ext.extProc.backendRef?.namespace)}
                                      {renderValue('Port', ext.extProc.backendRef?.port)}
                                      {renderValue('Fail Open', ext.extProc.failOpen)}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                            </Accordion>
                          ) : (
                            <p className="text-sm text-gray-400">No extensions configured</p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                );
              })()}
            </TabsContent>

            {/* Manifests Tab */}
            <TabsContent value="manifests">
              {clientTrafficPolicyYaml && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">ClientTrafficPolicy</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {clientTrafficPolicyYaml}
                  </pre>
                </div>
              )}

              {backendTrafficPolicyYaml && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">BackendTrafficPolicy</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {backendTrafficPolicyYaml}
                  </pre>
                </div>
              )}

              {envoyExtensionPolicyYaml && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">EnvoyExtensionPolicy</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {envoyExtensionPolicyYaml}
                  </pre>
                </div>
              )}

              {gatewayYaml && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Gateway</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {gatewayYaml}
                  </pre>
                </div>
              )}

              {!gatewayYaml && !clientTrafficPolicyYaml && !backendTrafficPolicyYaml && !envoyExtensionPolicyYaml && (
                <div className="text-center py-8 text-gray-500">
                  <p>No manifests available. Domain may not be fully deployed yet.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
