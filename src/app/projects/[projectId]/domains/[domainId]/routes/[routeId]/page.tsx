'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, Rocket, AlertCircle, Clock, CheckCircle, XCircle, Shield, History, GitCompareArrows } from 'lucide-react';
import { Button, Card, CardContent, Badge, Checkbox, Tabs, TabsList, TabsTrigger, TabsContent, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui';
import { domainsApi, routesApi, permissionsApi, clientAttachmentsApi, routeVersionsApi, projectsApi } from '@/lib/api';
import { MetricsTab } from '@/components/metrics/MetricsTab';
import type { RouteVersion } from '@/lib/api/route-versions';
import type { Domain, Route, Project, ProjectPermissions, ClientRouteAttachment, AttachmentStatus, EffectiveIPEntry, AuthorizationRule, JWTProviderConfig } from '@/types';
import { VersionCompareModal } from '@/components/version-compare-modal';
import { cn } from '@/lib/utils/cn';

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const domainId = params.domainId as string;
  const routeId = params.routeId as string;

  const [domain, setDomain] = useState<Domain | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loadStatus, setLoadStatus] = useState<number | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [httpRouteYaml, setHttpRouteYaml] = useState<string>('');
  const [securityPolicyYaml, setSecurityPolicyYaml] = useState<string>('');
  const [backendTrafficPolicyYaml, setBackendTrafficPolicyYaml] = useState<string>('');
  const [backendYaml, setBackendYaml] = useState<string>('');
  const [httpRouteFilterYaml, setHttpRouteFilterYaml] = useState<string>('');
  const [configMapYaml, setConfigMapYaml] = useState<string>('');
  const [envoyExtensionPolicyYaml, setEnvoyExtensionPolicyYaml] = useState<string>('');
  const [apiKeyClientResources, setApiKeyClientResources] = useState<Array<{
    clientId: string;
    clientName: string;
    httpRouteYaml: string;
    securityPolicyYaml: string;
    backendTrafficPolicyYaml?: string;
  }>>([]);
  const [attachedClients, setAttachedClients] = useState<ClientRouteAttachment[]>([]);
  const [effectiveIPs, setEffectiveIPs] = useState<EffectiveIPEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<RouteVersion[]>([]);
  const [versionsTotal, setVersionsTotal] = useState(0);
  const [versionsPage, setVersionsPage] = useState(1);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [compareVersions, setCompareVersions] = useState<{ a: RouteVersion; b: RouteVersion } | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId, domainId, routeId]);

  const loadData = async () => {
    try {
      const [domainData, routeData, permsData, yamlsData, projectData] = await Promise.all([
        domainsApi.get(projectId, domainId),
        routesApi.get(projectId, domainId, routeId),
        permissionsApi.getProjectPermissions(projectId),
        routesApi.getYamls(projectId, domainId, routeId),
        projectsApi.get(projectId),
      ]);
      setDomain(domainData);
      setRoute(routeData);
      setPermissions(permsData);
      setProject(projectData);
      setHttpRouteYaml(yamlsData.httpRouteYaml);
      setSecurityPolicyYaml(yamlsData.securityPolicyYaml || '');
      setBackendTrafficPolicyYaml(yamlsData.backendTrafficPolicyYaml || '');
      setBackendYaml(yamlsData.backendYaml || '');
      setHttpRouteFilterYaml(yamlsData.httpRouteFilterYaml || '');
      setConfigMapYaml(yamlsData.configMapYaml || '');
      setEnvoyExtensionPolicyYaml(yamlsData.envoyExtensionPolicyYaml || '');
      setApiKeyClientResources(yamlsData.apiKeyClientResources || []);

      // Fetch attached clients and effective IPs (may fail if user doesn't have access)
      try {
        const [clientsData, effectiveIPData] = await Promise.all([
          clientAttachmentsApi.listRouteClients(projectId, domainId, routeId),
          routesApi.getEffectiveIPs(projectId, domainId, routeId),
        ]);
        setAttachedClients(clientsData || []);
        setEffectiveIPs(effectiveIPData || []);
      } catch {
        setAttachedClients([]);
        setEffectiveIPs([]);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setLoadStatus(error.response?.status ?? null);
      setError(error.response?.data?.error || 'Failed to load route data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersions = async (page = 1) => {
    setIsLoadingVersions(true);
    try {
      const data = await routeVersionsApi.list(projectId, domainId, routeId, page);
      if (page === 1) {
        setVersions(data.data || []);
      } else {
        setVersions(prev => [...prev, ...(data.data || [])]);
      }
      setVersionsTotal(data.total);
      setVersionsPage(page);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleRollback = async (version: number) => {
    setIsRollingBack(true);
    try {
      await routeVersionsApi.rollback(projectId, domainId, routeId, version);
      router.push(`/projects/${projectId}/approvals`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate rollback');
    } finally {
      setIsRollingBack(false);
      setShowRollbackConfirm(null);
    }
  };

  const toggleVersionSelection = (version: number) => {
    setSelectedVersions(prev => {
      if (prev.includes(version)) {
        return prev.filter(v => v !== version);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  const openCompare = async (versionANum: number, versionBNum: number) => {
    setIsLoadingCompare(true);
    try {
      const [a, b] = await Promise.all([
        routeVersionsApi.get(projectId, domainId, routeId, versionANum),
        routeVersionsApi.get(projectId, domainId, routeId, versionBNum),
      ]);
      if (a.version < b.version) {
        setCompareVersions({ a, b });
      } else {
        setCompareVersions({ a: b, b: a });
      }
    } catch (err) {
      console.error('Failed to load versions for comparison:', err);
      setError('Failed to load version details for comparison');
    } finally {
      setIsLoadingCompare(false);
    }
  };

  const handleCompareWithCurrent = async (version: number) => {
    if (versions.length === 0) return;
    // versions[0] is always the latest (newest-first order, page 1 loaded first and appended)
    const currentVersion = versions[0];
    if (!currentVersion) return;
    await openCompare(version, currentVersion.version);
  };

  const handleCompareSelected = async () => {
    if (selectedVersions.length !== 2) return;
    await openCompare(selectedVersions[0], selectedVersions[1]);
  };

  const handleDelete = async () => {
    if (!route) return;
    setIsDeleting(true);
    setError(null);

    try {
      await routesApi.delete(projectId, domainId, routeId);
      router.push(`/projects/${projectId}/domains/${domainId}`);
    } catch (error: any) {
      console.error('Failed to delete route:', error);
      setError(error.response?.data?.error || 'Failed to submit delete request');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeploy = async () => {
    if (!route) return;
    const isDelete = route.pendingApproval?.action === 'delete';
    setIsDeploying(true);
    setError(null);

    try {
      await routesApi.deploy(projectId, domainId, routeId);
      await loadData();
    } catch (error: any) {
      const actionType = isDelete ? 'destroy' : 'deploy';
      console.error(`Failed to ${actionType} route:`, error);
      setError(error.response?.data?.error || `Failed to ${actionType} route. Please try again.`);
    } finally {
      setIsDeploying(false);
    }
  };

  const getAttachmentStatusBadge = (status: AttachmentStatus) => {
    const variants: Record<AttachmentStatus, { variant: 'default' | 'info' | 'success' | 'warning' | 'error'; label: string }> = {
      pending_attach: { variant: 'warning', label: 'Pending Attach' },
      pending_update: { variant: 'warning', label: 'Pending Update' },
      pending_detach: { variant: 'warning', label: 'Pending Detach' },
      approved: { variant: 'info', label: 'Approved' },
      active: { variant: 'success', label: 'Active' },
      removed: { variant: 'default', label: 'Removed' },
      rejected: { variant: 'error', label: 'Rejected' },
    };
    const config = variants[status] || { variant: 'default' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const canEdit = () => {
    if (!route || !permissions) return false;
    if (['pending_create', 'pending_update', 'pending_delete', 'approved', 'pending_deploy'].includes(route.status)) {
      return false;
    }
    return permissions.canCreateRoutes;
  };

  const canDelete = () => {
    if (!route || !permissions) return false;
    if (['pending_create', 'pending_update', 'pending_delete', 'approved', 'pending_deploy'].includes(route.status)) {
      return false;
    }
    return permissions.canCreateRoutes;
  };

  const canDeploy = () => {
    if (!route) return false;
    return route.status === 'approved' || route.status === 'pending_deploy';
  };

  const isDeleteAction = () => {
    return route?.pendingApproval?.action === 'delete';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'approved':
        if (isDeleteAction()) {
          return <Badge variant="error"><Clock className="h-3 w-3 mr-1" />Approved - Ready to Destroy</Badge>;
        }
        return <Badge variant="info"><Clock className="h-3 w-3 mr-1" />Approved - Ready to Deploy</Badge>;
      case 'pending_deploy':
        if (isDeleteAction()) {
          return <Badge variant="error"><Clock className="h-3 w-3 mr-1" />Pending Destroy</Badge>;
        }
        return <Badge variant="info"><Clock className="h-3 w-3 mr-1" />Pending Deploy</Badge>;
      case 'pending_create':
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Pending Create Approval</Badge>;
      case 'pending_update':
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Pending Update Approval</Badge>;
      case 'pending_delete':
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Pending Delete Approval</Badge>;
      case 'rejected':
        return <Badge variant="error"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Count configured items for tab badges
  const getTrafficCount = () => {
    if (!route) return 0;
    let count = 0;
    if (route.config.backends?.length || route.config.redirect) count++;
    if (route.config.mirrors?.length) count++;
    if (route.config.matches?.length) count++;
    if (route.config.requestHeaderModifier || route.config.responseHeaderModifier) count++;
    if (route.config.urlRewrite?.hostname || route.config.urlRewrite?.path) count++;
    if (route.backendTrafficPolicy?.config?.compression && route.backendTrafficPolicy.config.compression.length > 0) count++;
    if (route.backendTrafficPolicy?.config?.retry) count++;
    if (route.backendTrafficPolicy?.config?.timeout) count++;
    if (route.backendTrafficPolicy?.config?.loadBalancer) count++;
    if (route.backendTrafficPolicy?.config?.circuitBreaker) count++;
    if (route.backendTrafficPolicy?.config?.healthCheck) count++;
    if (route.backendTrafficPolicy?.config?.faultInjection) count++;
    if (route.backendTrafficPolicy?.config?.rateLimit) count++;
    if (route.backendTrafficPolicy?.config?.requestBuffer) count++;
    if (route.backendTrafficPolicy?.config?.responseOverride && route.backendTrafficPolicy.config.responseOverride.length > 0) count++;
    return count;
  };

  const getExtensionCount = () => {
    if (!route) return 0;
    let count = 0;
    if (route.extensionPolicy?.config?.lua) count++;
    if (route.extensionPolicy?.config?.wasm) count++;
    if (route.extensionPolicy?.config?.extProc) count++;
    return count;
  };

  // Helper for gRPC status code labels
  const getGrpcStatusLabel = (code: number): string => {
    const labels: Record<number, string> = {
      0: 'OK', 1: 'Cancelled', 2: 'Unknown', 3: 'Invalid Argument',
      4: 'Deadline Exceeded', 5: 'Not Found', 6: 'Already Exists',
      7: 'Permission Denied', 8: 'Resource Exhausted', 9: 'Failed Precondition',
      10: 'Aborted', 11: 'Out of Range', 12: 'Unimplemented',
      13: 'Internal', 14: 'Unavailable', 15: 'Data Loss', 16: 'Unauthenticated'
    };
    return labels[code] || `Code ${code}`;
  };

  // Helper for fault injection
  const hasFaultInjection = () => route?.backendTrafficPolicy?.config?.faultInjection != null;

  // Helper for rate limit
  const hasRateLimit = () => route?.backendTrafficPolicy?.config?.rateLimit != null;

  const getSecurityCount = () => {
    if (!route) return 0;
    let count = 0;
    if (route.securityPolicy?.config?.cors) count++;
    if (route.wafPolicy) count++;
    if (route.securityPolicy?.config?.extAuth) count++;
    if (route.securityMode === 'client') {
      if (effectiveIPs.length > 0) count++;
    } else {
      // General mode features
      if (route.securityPolicy?.config?.authorization) count++;
      if (route.securityPolicy?.config?.apiKeyAuth) count++;
      if (route.securityPolicy?.config?.jwt) count++;
      if (route.securityPolicy?.config?.oidc) count++;
    }
    return count;
  };

  const getManifestCount = () => {
    let count = 1; // HTTPRoute always exists
    if (securityPolicyYaml) count++;
    if (backendTrafficPolicyYaml) count++;
    if (backendYaml) count++;
    if (httpRouteFilterYaml) count++;
    if (configMapYaml) count++;
    if (envoyExtensionPolicyYaml) count++;
    return count;
  };

  // Check if sections have configuration
  const hasRequestMatching = () => route?.config.matches && route.config.matches.length > 0;
  const hasBackends = () => route?.config.backends && route.config.backends.length > 0;
  const hasMirrors = () => route?.config.mirrors && route.config.mirrors.length > 0;
  const hasRedirect = () => route?.config.routeType === 'redirect' && route?.config.redirect;
  const hasDirectResponse = () => route?.config.routeType === 'directResponse' && route?.config.directResponse;
  const hasHeaderModifiers = () => route?.config.requestHeaderModifier || route?.config.responseHeaderModifier;
  const hasUrlRewrite = () => route?.config.urlRewrite?.hostname || route?.config.urlRewrite?.path;
  const hasCors = () => route?.securityPolicy?.config?.cors;
  const hasCompression = () => route?.backendTrafficPolicy?.config?.compression && route.backendTrafficPolicy.config.compression.length > 0;
  const hasRetry = () => route?.backendTrafficPolicy?.config?.retry != null;
  const hasLoadBalancer = () => route?.backendTrafficPolicy?.config?.loadBalancer != null;
  const hasCircuitBreaker = () => route?.backendTrafficPolicy?.config?.circuitBreaker != null;
  const hasHealthCheck = () => route?.backendTrafficPolicy?.config?.healthCheck != null;
  const hasTimeouts = () => route?.backendTrafficPolicy?.config?.timeout != null;
  const hasRequestBuffer = () => route?.backendTrafficPolicy?.config?.requestBuffer != null;
  const hasResponseOverride = () => route?.backendTrafficPolicy?.config?.responseOverride && route.backendTrafficPolicy.config.responseOverride.length > 0;
  const hasLuaExtension = () => route?.extensionPolicy?.config?.lua != null;
  const hasWasmExtension = () => route?.extensionPolicy?.config?.wasm != null;
  const hasExtProcExtension = () => route?.extensionPolicy?.config?.extProc != null;

  // Trigger display mapping for retry
  const triggerDisplayMap: Record<string, string> = {
    '5xx': '5xx',
    'gateway-error': 'Gateway Error',
    'connect-failure': 'Connection Failure',
    'retriable-status-codes': 'Retriable Status Codes',
    'reset': 'Connection Reset',
    'reset-before-request': 'Reset Before Request',
    'retriable-4xx': 'Retriable 4xx',
    'refused-stream': 'Refused Stream',
    'cancelled': 'Cancelled',
    'deadline-exceeded': 'Deadline Exceeded',
    'internal': 'Internal Error',
    'resource-exhausted': 'Resource Exhausted',
    'unavailable': 'Unavailable',
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

  if (!route) {
    const isForbidden = loadStatus === 403;
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {isForbidden ? 'Access denied' : 'Route not found'}
          </h2>
          {isForbidden && (
            <p className="mt-2 text-sm text-gray-600">
              {error || "You don't have access to this route."}
            </p>
          )}
          <Link href={`/projects/${projectId}/domains/${domainId}`}>
            <Button className="mt-4">Back to Domain</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href={`/projects/${projectId}/domains/${domainId}`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {domain?.hostname}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
            {getStatusBadge(route.status)}
            <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
              {route.securityMode === 'client' ? 'Client Security' : 'General Security'}
            </span>
          </div>
          {route.description && (
            <p className="text-gray-600">{route.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            Owner: {route.team?.name || 'Unknown Team'}
          </p>
        </div>
        <div className="flex gap-2">
          {canDeploy() && (
            <Button onClick={handleDeploy} disabled={isDeploying} variant={isDeleteAction() ? 'danger' : 'primary'}>
              <Rocket className="h-4 w-4 mr-1" />
              {isDeploying
                ? (isDeleteAction() ? 'Destroying...' : 'Deploying...')
                : (isDeleteAction() ? 'Destroy' : 'Deploy')}
            </Button>
          )}
          {canEdit() && (
            <Link href={`/projects/${projectId}/domains/${domainId}/routes/${routeId}/edit`}>
              <Button variant="secondary">
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </Link>
          )}
          {canDelete() && (
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Pending Approval Info */}
      {route.pendingApproval && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <Clock className="h-5 w-5" />
              <span className="font-medium">
                {route.pendingApproval.action === 'create' && 'Route creation is pending approval'}
                {route.pendingApproval.action === 'update' && 'Route update is pending approval'}
                {route.pendingApproval.action === 'delete' && 'Route deletion is pending approval'}
              </span>
            </div>
            {route.pendingApproval.rejectionComment && (
              <p className="mt-2 text-sm text-yellow-700">
                Rejection reason: {route.pendingApproval.rejectionComment}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Warning - Clients attached but default policy allows bypass */}
      {route.securityStatus === 'warning' && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-amber-600 mt-0.5">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-amber-800 font-medium">
                  Security Warning
                </div>
                <p className="mt-1 text-sm text-amber-700">
                  This route has {route.clientCount || attachedClients.length} attached client(s), but the default traffic policy allows all requests without client identification.
                  Requests without an x-client-id header can bypass client security controls.
                </p>
                <p className="mt-2 text-sm text-amber-700">
                  <strong>Recommendation:</strong>{' '}
                  <Link href={`/projects/${projectId}/domains/${domainId}/routes/${routeId}/edit`} className="text-amber-800 underline hover:no-underline">
                    Edit the route
                  </Link>
                  {' '}and set the Default Traffic Policy to &quot;Deny&quot; or &quot;Require IP Allowlist&quot; in the Security tab.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Route Configuration with Tabs */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Tabs defaultValue="basic" onValueChange={(val) => {
            if (val === 'history' && versions.length === 0) {
              loadVersions();
            }
          }}>
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="traffic">
                Traffic
                {getTrafficCount() > 0 && (
                  <Badge variant="default" className="ml-2 text-xs">{getTrafficCount()}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="extensions">
                Extensions
                {getExtensionCount() > 0 && (
                  <Badge variant="default" className="ml-2 text-xs">{getExtensionCount()}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="security">
                Security
                {getSecurityCount() > 0 && (
                  <Badge variant="default" className="ml-2 text-xs">{getSecurityCount()}</Badge>
                )}
              </TabsTrigger>
              {route.securityMode === 'client' && (
                <TabsTrigger value="clients">
                  Clients
                  {attachedClients.length > 0 && (
                    <Badge variant="default" className="ml-2 text-xs">{attachedClients.length}</Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="manifests">
                Manifests
                <Badge variant="default" className="ml-2 text-xs">{getManifestCount()}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-1" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-gray-900">{route.name}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Protocol</label>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <Badge variant="default">{route.protocol?.toUpperCase() || 'HTTP'}</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[60px]">
                    <span className="text-gray-900">{route.description || <span className="text-gray-400 italic">No description</span>}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-gray-900">{route.team?.name || 'Unknown Team'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Route Type</label>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <Badge variant={route.config.routeType === 'redirect' ? 'warning' : route.config.routeType === 'directResponse' ? 'default' : 'info'}>
                        {route.protocol === 'grpc' ? 'gRPC Service' : route.config.routeType === 'redirect' ? 'HTTP Redirect' : route.config.routeType === 'directResponse' ? 'Direct Response' : 'Backend Service'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {getStatusBadge(route.status)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-gray-900">{new Date(route.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Metrics Tab */}
            <TabsContent value="metrics">
              <MetricsTab
                kind="route"
                projectId={projectId}
                domainId={domainId}
                routeId={routeId}
                metricsConfigured={Boolean(project?.metricsEndpointUrl)}
                canEditProject={Boolean(permissions?.isProjectAdmin || permissions?.isOwner)}
              />
            </TabsContent>

            {/* Traffic Tab */}
            <TabsContent value="traffic">
              <Accordion type="multiple" defaultValue={['backend', 'matching', 'headers', 'rewrite']}>
                {/* Route Type & Backend/Redirect/DirectResponse Section */}
                <AccordionItem value="backend">
                  <AccordionTrigger
                    value="backend"
                    badge={
                      (hasBackends() || hasRedirect() || hasDirectResponse()) ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    {route.config.routeType === 'redirect' ? 'Redirect Configuration' : route.config.routeType === 'directResponse' ? 'Direct Response' : 'Backend Services'}
                  </AccordionTrigger>
                  <AccordionContent value="backend">
                    {/* Backend Services - for backend routes */}
                    {(!route.config.routeType || route.config.routeType === 'backend') && (
                      <>
                        {hasBackends() ? (
                          <div className="space-y-3">
                            {route.config.backends!.length > 1 && (
                              <div className="p-3 bg-primary-50 rounded-lg flex items-center gap-2">
                                {route.config.backends!.some(b => b.fallback) ? (
                                  <>
                                    <Badge variant="warning">Failover</Badge>
                                    <span className="text-sm text-primary-700">
                                      {route.config.backends!.filter(b => !b.fallback).length} primary + {route.config.backends!.filter(b => b.fallback).length} fallback backend{route.config.backends!.filter(b => b.fallback).length > 1 ? 's' : ''}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Badge variant="info">Traffic Splitting</Badge>
                                    <span className="text-sm text-primary-700">
                                      Traffic is split across {route.config.backends!.length} backends
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                            {route.config.backends!.map((backend, idx) => (
                              <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={backend.type === 'external' ? 'warning' : 'default'} className="text-xs">
                                      {backend.type === 'external' ? 'External' : 'K8s'}
                                    </Badge>
                                    {backend.fallback && (
                                      <Badge variant="warning" className="text-xs">Fallback</Badge>
                                    )}
                                    <span className="text-sm font-medium text-gray-700">
                                      {backend.type === 'external'
                                        ? `${backend.address}:${backend.port}`
                                        : `${backend.namespace || 'default'}/${backend.service}:${backend.port}`}
                                    </span>
                                  </div>
                                  {!backend.fallback && route.config.backends!.filter(b => !b.fallback).length > 1 && backend.weight !== undefined && (
                                    <Badge variant="default">{backend.weight}%</Badge>
                                  )}
                                </div>
                                {backend.type === 'external' && backend.addressType && (
                                  <div className="text-xs text-gray-500 mb-2">
                                    Type: {backend.addressType === 'fqdn' ? 'FQDN (Hostname)' : 'IP Address'}
                                  </div>
                                )}
                                {!backend.fallback && route.config.backends!.filter(b => !b.fallback).length > 1 && backend.weight !== undefined && (
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${backend.weight}%` }} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">No backends configured</div>
                        )}
                      </>
                    )}

                    {/* Request Mirroring - for backend routes */}
                    {(!route.config.routeType || route.config.routeType === 'backend') && (
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Request Mirroring</h4>
                        {hasMirrors() ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-primary-50 rounded-lg flex items-center gap-2 mb-3">
                              <Badge variant="info">Traffic Shadowing</Badge>
                              <span className="text-sm text-primary-700">
                                Requests are mirrored to {route.config.mirrors!.length} destination{route.config.mirrors!.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            {route.config.mirrors!.map((mirror, idx) => (
                              <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-xs">K8s</Badge>
                                  <span className="text-sm font-medium text-gray-700">
                                    {mirror.namespace || 'default'}/{mirror.service}:{mirror.port}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">No request mirroring configured</div>
                        )}
                      </div>
                    )}

                    {/* Redirect Configuration - for redirect routes */}
                    {route.config.routeType === 'redirect' && (
                      <>
                        {hasRedirect() ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              {route.config.redirect!.scheme && (
                                <div>
                                  <span className="text-sm text-gray-500">Scheme:</span>
                                  <span className="ml-2 font-medium">{route.config.redirect!.scheme.toUpperCase()}</span>
                                </div>
                              )}
                              {route.config.redirect!.hostname && (
                                <div>
                                  <span className="text-sm text-gray-500">Hostname:</span>
                                  <span className="ml-2 font-medium">{route.config.redirect!.hostname}</span>
                                </div>
                              )}
                              {route.config.redirect!.port && (
                                <div>
                                  <span className="text-sm text-gray-500">Port:</span>
                                  <span className="ml-2">{route.config.redirect!.port}</span>
                                </div>
                              )}
                              {route.config.redirect!.statusCode && (
                                <div>
                                  <span className="text-sm text-gray-500">Status Code:</span>
                                  <Badge variant={route.config.redirect!.statusCode === 301 ? 'info' : 'warning'} className="ml-2">
                                    {route.config.redirect!.statusCode} - {route.config.redirect!.statusCode === 301 ? 'Permanent' : 'Temporary'}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            {route.config.redirect!.path && (
                              <div className="pt-2 border-t">
                                <span className="text-sm text-gray-500">Path Rewrite:</span>
                                <div className="mt-2 pl-4 space-y-1">
                                  <div className="text-sm">
                                    <span className="text-gray-500">Type:</span>
                                    <span className="ml-2">{route.config.redirect!.path.type}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-gray-500">Value:</span>
                                    <code className="ml-2 px-2 py-1 bg-gray-100 rounded">
                                      {route.config.redirect!.path.replacePrefixMatch || route.config.redirect!.path.replaceFullPath}
                                    </code>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">No redirect configuration</div>
                        )}
                      </>
                    )}

                    {/* Direct Response - for direct response routes */}
                    {route.config.routeType === 'directResponse' && (
                      <>
                        {hasDirectResponse() ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm text-gray-500">Status Code:</span>
                                <Badge variant="info" className="ml-2">
                                  {route.config.directResponse!.statusCode}
                                </Badge>
                              </div>
                              {route.config.directResponse!.contentType && (
                                <div>
                                  <span className="text-sm text-gray-500">Content Type:</span>
                                  <span className="ml-2 font-mono text-sm">{route.config.directResponse!.contentType}</span>
                                </div>
                              )}
                            </div>
                            {route.config.directResponse!.body?.inline && (
                              <div className="pt-2 border-t">
                                <span className="text-sm text-gray-500">Response Body:</span>
                                <div className="mt-2 bg-gray-900 rounded-lg p-4 text-sm font-mono">
                                  <pre className="text-green-400 whitespace-pre-wrap">
                                    {route.config.directResponse!.body.inline}
                                  </pre>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  {route.config.directResponse!.body.inline.length} bytes
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">No direct response configuration</div>
                        )}
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Health Check Section */}
                <AccordionItem value="health-check">
                  <AccordionTrigger
                    value="health-check"
                    badge={
                      hasHealthCheck() ? (() => {
                        const hc = route!.backendTrafficPolicy!.config.healthCheck!;
                        const parts = [];
                        if (hc.active) parts.push('Active');
                        if (hc.passive) parts.push('Passive');
                        return <Badge variant="success" className="text-xs">{parts.join(' + ') || 'Enabled'}</Badge>;
                      })() : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Health Check
                  </AccordionTrigger>
                  <AccordionContent value="health-check">
                    {hasHealthCheck() ? (() => {
                      const hc = route!.backendTrafficPolicy!.config.healthCheck!;
                      return (
                        <div className="space-y-4">
                          {hc.panicThreshold != null && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Panic Threshold</span>
                              <p className="text-sm text-gray-900 mt-0.5">{hc.panicThreshold}%</p>
                            </div>
                          )}

                          {hc.active && (
                            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-gray-800">Active Health Check</span>
                                <Badge variant="default" className="text-xs">{hc.active.type}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Timeout</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.active.timeout || <span className="text-gray-400">Default (1s)</span>}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Interval</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.active.interval || <span className="text-gray-400">Default (3s)</span>}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Unhealthy Threshold</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.active.unhealthyThreshold != null ? hc.active.unhealthyThreshold : <span className="text-gray-400">Default (3)</span>}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Healthy Threshold</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.active.healthyThreshold != null ? hc.active.healthyThreshold : <span className="text-gray-400">Default (1)</span>}
                                  </p>
                                </div>
                              </div>

                              {hc.active.type === 'HTTP' && hc.active.http && (
                                <div className="border-t pt-3 space-y-2">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <span className="text-sm font-medium text-gray-700">Path</span>
                                      <p className="text-sm text-gray-900 mt-0.5 font-mono">{hc.active.http.path}</p>
                                    </div>
                                    <div>
                                      <span className="text-sm font-medium text-gray-700">Method</span>
                                      <p className="text-sm text-gray-900 mt-0.5">{hc.active.http.method || 'GET'}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Expected Statuses</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {hc.active.http.expectedStatuses && hc.active.http.expectedStatuses.length > 0 ? (
                                        hc.active.http.expectedStatuses.map((code, idx) => (
                                          <Badge key={idx} variant="default" className="text-xs">{code}</Badge>
                                        ))
                                      ) : (
                                        <Badge variant="default" className="text-xs">200</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {hc.active.type === 'TCP' && hc.active.tcp && (
                                <div className="border-t pt-3 grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Send Payload</span>
                                    <p className="text-sm text-gray-900 mt-0.5">
                                      {hc.active.tcp.send?.text || <span className="text-gray-400">Not set</span>}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-700">Receive Payload</span>
                                    <p className="text-sm text-gray-900 mt-0.5">
                                      {hc.active.tcp.receive?.text || <span className="text-gray-400">Not set</span>}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {hc.active.type === 'GRPC' && hc.active.grpc && (
                                <div className="border-t pt-3">
                                  <span className="text-sm font-medium text-gray-700">Service Name</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.active.grpc.service || <span className="text-gray-400">Not set</span>}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {hc.passive && (
                            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                              <span className="text-sm font-semibold text-gray-800">Passive Health Check</span>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Consecutive Gateway Errors</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.passive.consecutiveGatewayErrors != null ? hc.passive.consecutiveGatewayErrors : <span className="text-gray-400">Not set</span>}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Consecutive 5xx Errors</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.passive.consecutive5xxErrors != null ? hc.passive.consecutive5xxErrors : <span className="text-gray-400">Not set</span>}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Interval</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.passive.interval || <span className="text-gray-400">Not set</span>}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Base Ejection Time</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {hc.passive.baseEjectionTime || <span className="text-gray-400">Not set</span>}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="text-gray-500 italic">No health check configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Fault Injection Section */}
                <AccordionItem value="fault-injection">
                  <AccordionTrigger
                    value="fault-injection"
                    badge={
                      hasFaultInjection() ? (() => {
                        const fi = route!.backendTrafficPolicy!.config.faultInjection!;
                        const hasDelay = fi.delay != null;
                        const hasAbort = fi.abort != null;
                        return (
                          <Badge variant="success" className="text-xs">
                            {hasDelay && hasAbort ? 'Delay + Abort' : hasDelay ? 'Delay' : 'Abort'}
                          </Badge>
                        );
                      })() : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Fault Injection
                  </AccordionTrigger>
                  <AccordionContent value="fault-injection">
                    {hasFaultInjection() ? (() => {
                      const fi = route!.backendTrafficPolicy!.config.faultInjection!;
                      return (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-500">
                            Fault injection configuration for testing application resilience.
                          </p>

                          {fi.delay && (
                            <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">Delay Injection</span>
                                <Badge variant="success" className="text-xs">Enabled</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Fixed Delay</span>
                                  <p className="text-sm text-gray-900 mt-0.5">{fi.delay.fixedDelay}</p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Percentage</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {fi.delay.percentage != null ? `${fi.delay.percentage}%` : '100% (all requests)'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {fi.abort && (
                            <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">Abort Injection</span>
                                <Badge variant="success" className="text-xs">Enabled</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Type</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    <Badge variant="default" className="text-xs">
                                      {fi.abort.httpStatus != null ? 'HTTP' : 'gRPC'}
                                    </Badge>
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Status Code</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {fi.abort.httpStatus != null
                                      ? fi.abort.httpStatus
                                      : `${getGrpcStatusLabel(fi.abort.grpcStatus!)} (${fi.abort.grpcStatus})`}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-700">Percentage</span>
                                  <p className="text-sm text-gray-900 mt-0.5">
                                    {fi.abort.percentage != null ? `${fi.abort.percentage}%` : '100% (all requests)'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="text-gray-500 italic">No fault injection configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Rate Limiting Section */}
                <AccordionItem value="rate-limiting">
                  <AccordionTrigger
                    value="rate-limiting"
                    badge={
                      hasRateLimit() ? (() => {
                        const rl = route!.backendTrafficPolicy!.config.rateLimit!;
                        const rule = rl.global?.rules?.[0];
                        return (
                          <Badge variant="success" className="text-xs">
                            {rule?.limit.requests}/{rule?.limit.unit}
                          </Badge>
                        );
                      })() : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Rate Limiting
                  </AccordionTrigger>
                  <AccordionContent value="rate-limiting">
                    {hasRateLimit() ? (() => {
                      const rl = route!.backendTrafficPolicy!.config.rateLimit!;
                      const rule = rl.global?.rules?.[0];
                      return (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-500">
                            Rate limiting configuration to control request volume.
                          </p>
                          <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">Global Rate Limit</span>
                              <Badge variant="success" className="text-xs">Enabled</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-700">Requests</span>
                                <p className="text-sm text-gray-900 mt-0.5">{rule?.limit.requests}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700">Per</span>
                                <p className="text-sm text-gray-900 mt-0.5">{rule?.limit.unit}</p>
                              </div>
                            </div>
                            {rule?.clientSelectors && rule.clientSelectors.length > 0 && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">Client Selectors</span>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {rule.clientSelectors.length} selector(s) configured
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="text-gray-500 italic">No rate limiting configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Request Buffer Section */}
                <AccordionItem value="request-buffer">
                  <AccordionTrigger
                    value="request-buffer"
                    badge={
                      hasRequestBuffer() ? (
                        <Badge variant="success" className="text-xs">
                          {route!.backendTrafficPolicy!.config.requestBuffer!.limit}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Request Buffering
                  </AccordionTrigger>
                  <AccordionContent value="request-buffer">
                    {hasRequestBuffer() ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500">
                          Buffer incoming requests before forwarding to backends.
                        </p>
                        <div className="p-4 border rounded-md bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Buffer Limit:</span>
                            <code className="text-sm bg-white px-2 py-0.5 rounded border">
                              {route!.backendTrafficPolicy!.config.requestBuffer!.limit}
                            </code>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No request buffering configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Response Override Section */}
                <AccordionItem value="response-override">
                  <AccordionTrigger
                    value="response-override"
                    badge={
                      hasResponseOverride() ? (
                        <Badge variant="success" className="text-xs">
                          {route!.backendTrafficPolicy!.config.responseOverride!.length} rule{route!.backendTrafficPolicy!.config.responseOverride!.length > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Response Override
                  </AccordionTrigger>
                  <AccordionContent value="response-override">
                    {hasResponseOverride() ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                          Override backend responses based on status codes.
                        </p>
                        {route!.backendTrafficPolicy!.config.responseOverride!.map((rule, idx) => (
                          <div key={idx} className="p-4 border rounded-md bg-gray-50 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">Rule {idx + 1}:</span>
                              <Badge variant="info">
                                {rule.match.statusCodes.map(sc => {
                                  if (sc.value) return sc.value.toString();
                                  if (sc.range) return `${sc.range.start}-${sc.range.end}`;
                                  return '';
                                }).filter(Boolean).join(', ')}
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700">Content-Type:</span>
                                <code className="bg-white px-2 py-0.5 rounded border">{rule.response.contentType}</code>
                              </div>
                              {rule.response.body && (
                                <div className="flex items-start gap-2">
                                  <span className="font-medium text-gray-700">Body Type:</span>
                                  <span>{rule.response.body.type}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No response override configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Timeout Section */}
                <AccordionItem value="timeouts">
                  <AccordionTrigger
                    value="timeouts"
                    badge={
                      hasTimeouts() ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Timeout
                  </AccordionTrigger>
                  <AccordionContent value="timeouts">
                    {hasTimeouts() ? (() => {
                      const timeout = route!.backendTrafficPolicy!.config!.timeout!;
                      const fields: { label: string; value: string | undefined }[] = [
                        { label: 'TCP Connect Timeout', value: timeout.tcp?.connectTimeout },
                        { label: 'HTTP Request Timeout', value: timeout.http?.requestTimeout },
                        { label: 'HTTP Connection Idle Timeout', value: timeout.http?.connectionIdleTimeout },
                        { label: 'HTTP Max Connection Duration', value: timeout.http?.maxConnectionDuration },
                        { label: 'HTTP Max Stream Duration', value: timeout.http?.maxStreamDuration },
                      ].filter(f => f.value);
                      return (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">
                            Timeout durations configured for this route.
                          </p>
                          <div className="space-y-2">
                            {fields.map((f) => (
                              <div key={f.label} className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">{f.label}:</span>
                                <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{f.value}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="text-gray-500 italic">No timeout configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Request Matching Section */}
                <AccordionItem value="matching">
                  <AccordionTrigger
                    value="matching"
                    badge={
                      hasRequestMatching() ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Request Matching
                  </AccordionTrigger>
                  <AccordionContent value="matching">
                    {hasRequestMatching() ? (
                      <div className="space-y-4">
                        {route.config.matches!.map((match, idx) => (
                          <div key={idx} className="space-y-4">
                            {route.protocol === 'grpc' ? (
                              <>
                                {/* gRPC Service */}
                                {match.grpcService && (
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-700">gRPC Service</h3>
                                    <div className="pl-3 border-l-2 border-gray-200 space-y-1">
                                      <div>
                                        <Badge variant="default">{match.grpcService.type}</Badge>
                                        <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">{match.grpcService.value}</code>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* gRPC Method */}
                                {match.grpcMethod && (
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-700">gRPC Method</h3>
                                    <div className="pl-3 border-l-2 border-gray-200 space-y-1">
                                      <div>
                                        <Badge variant="default">{match.grpcMethod.type}</Badge>
                                        <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">{match.grpcMethod.value}</code>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Path hint */}
                                {(match.grpcService || match.grpcMethod) && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Path: /{match.grpcService?.value || '*'}/{match.grpcMethod?.value || '*'}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Path Matching */}
                                {match.path && (
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-700">Path</h3>
                                    <div className="pl-3 border-l-2 border-gray-200 space-y-1">
                                      <div>
                                        <span className="text-sm text-gray-500">Type:</span>
                                        <span className="ml-2 font-medium">{match.path.type}</span>
                                      </div>
                                      <div>
                                        <span className="text-sm text-gray-500">Value:</span>
                                        <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">{match.path.value}</code>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* HTTP Method */}
                                {match.method && (
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-700">HTTP Method</h3>
                                    <div className="pl-3 border-l-2 border-gray-200">
                                      <Badge variant="default">{match.method}</Badge>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Header Matching (shared) */}
                            {match.headers && match.headers.length > 0 && (
                              <div className="space-y-2">
                                <h3 className="text-sm font-medium text-gray-700">Headers</h3>
                                <div className="pl-3 border-l-2 border-gray-200 space-y-2">
                                  {match.headers.map((header, hIdx) => (
                                    <div key={hIdx} className="text-sm">
                                      <code className="px-2 py-1 bg-gray-100 rounded">{header.name}</code>
                                      <span className="mx-2 text-gray-400">{header.type === 'Exact' ? '=' : '~'}</span>
                                      <code className="px-2 py-1 bg-primary-50 rounded text-primary-700">{header.value}</code>
                                      <span className="ml-2 text-xs text-gray-400">({header.type})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Query Parameter Matching (HTTP only) */}
                            {route.protocol !== 'grpc' && match.queryParams && match.queryParams.length > 0 && (
                              <div className="space-y-2">
                                <h3 className="text-sm font-medium text-gray-700">Query Parameters</h3>
                                <div className="pl-3 border-l-2 border-gray-200 space-y-2">
                                  {match.queryParams.map((param, pIdx) => (
                                    <div key={pIdx} className="text-sm">
                                      <code className="px-2 py-1 bg-gray-100 rounded">{param.name}</code>
                                      <span className="mx-2 text-gray-400">{param.type === 'Exact' ? '=' : '~'}</span>
                                      <code className="px-2 py-1 bg-green-50 rounded text-green-700">{param.value}</code>
                                      <span className="ml-2 text-xs text-gray-400">({param.type})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No request matching rules configured (matches all requests)</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Header Modifiers Section */}
                <AccordionItem value="headers">
                  <AccordionTrigger
                    value="headers"
                    badge={
                      hasHeaderModifiers() ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Header Modifiers
                  </AccordionTrigger>
                  <AccordionContent value="headers">
                    {hasHeaderModifiers() ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Request Headers */}
                        {route.config.requestHeaderModifier && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b">Request Headers</h3>
                            <div className="space-y-3">
                              {route.config.requestHeaderModifier.set && route.config.requestHeaderModifier.set.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Set</h4>
                                  <div className="space-y-1">
                                    {route.config.requestHeaderModifier.set.map((h, idx) => (
                                      <div key={idx} className="text-sm pl-3 border-l-2 border-primary-200">
                                        <code className="px-2 py-1 bg-gray-100 rounded">{h.name}</code>
                                        <span className="mx-2 text-gray-400">=</span>
                                        <code className="px-2 py-1 bg-primary-50 rounded text-primary-700">{h.value}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {route.config.requestHeaderModifier.add && route.config.requestHeaderModifier.add.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Add</h4>
                                  <div className="space-y-1">
                                    {route.config.requestHeaderModifier.add.map((h, idx) => (
                                      <div key={idx} className="text-sm pl-3 border-l-2 border-green-200">
                                        <code className="px-2 py-1 bg-gray-100 rounded">{h.name}</code>
                                        <span className="mx-2 text-gray-400">+</span>
                                        <code className="px-2 py-1 bg-green-50 rounded text-green-700">{h.value}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {route.config.requestHeaderModifier.remove && route.config.requestHeaderModifier.remove.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Remove</h4>
                                  <div className="space-y-1">
                                    {route.config.requestHeaderModifier.remove.map((name, idx) => (
                                      <div key={idx} className="text-sm pl-3 border-l-2 border-red-200">
                                        <code className="px-2 py-1 bg-red-50 rounded text-red-700 line-through">{name}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Response Headers */}
                        {route.config.responseHeaderModifier && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b">Response Headers</h3>
                            <div className="space-y-3">
                              {route.config.responseHeaderModifier.set && route.config.responseHeaderModifier.set.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Set</h4>
                                  <div className="space-y-1">
                                    {route.config.responseHeaderModifier.set.map((h, idx) => (
                                      <div key={idx} className="text-sm pl-3 border-l-2 border-primary-200">
                                        <code className="px-2 py-1 bg-gray-100 rounded">{h.name}</code>
                                        <span className="mx-2 text-gray-400">=</span>
                                        <code className="px-2 py-1 bg-primary-50 rounded text-primary-700">{h.value}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {route.config.responseHeaderModifier.add && route.config.responseHeaderModifier.add.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Add</h4>
                                  <div className="space-y-1">
                                    {route.config.responseHeaderModifier.add.map((h, idx) => (
                                      <div key={idx} className="text-sm pl-3 border-l-2 border-green-200">
                                        <code className="px-2 py-1 bg-gray-100 rounded">{h.name}</code>
                                        <span className="mx-2 text-gray-400">+</span>
                                        <code className="px-2 py-1 bg-green-50 rounded text-green-700">{h.value}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {route.config.responseHeaderModifier.remove && route.config.responseHeaderModifier.remove.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Remove</h4>
                                  <div className="space-y-1">
                                    {route.config.responseHeaderModifier.remove.map((name, idx) => (
                                      <div key={idx} className="text-sm pl-3 border-l-2 border-red-200">
                                        <code className="px-2 py-1 bg-red-50 rounded text-red-700 line-through">{name}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No header modifiers configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* URL Rewrite Section - HTTP only */}
                {route.protocol !== 'grpc' && (
                <AccordionItem value="rewrite">
                  <AccordionTrigger
                    value="rewrite"
                    badge={
                      hasUrlRewrite() ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    URL Rewrite
                  </AccordionTrigger>
                  <AccordionContent value="rewrite">
                    {hasUrlRewrite() ? (
                      <div className="space-y-4">
                        {route.config.urlRewrite?.hostname && (
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-gray-700">Hostname Rewrite</h3>
                            <div className="pl-3 border-l-2 border-purple-200">
                              <div className="text-sm">
                                <span className="text-gray-500">Rewrite to:</span>
                                <code className="ml-2 px-2 py-1 bg-purple-50 rounded text-purple-700">{route.config.urlRewrite.hostname}</code>
                              </div>
                            </div>
                          </div>
                        )}
                        {route.config.urlRewrite?.path && (
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium text-gray-700">Path Rewrite</h3>
                            <div className="pl-3 border-l-2 border-orange-200 space-y-1">
                              <div className="text-sm">
                                <span className="text-gray-500">Type:</span>
                                <Badge variant="default" className="ml-2">{route.config.urlRewrite.path.type}</Badge>
                              </div>
                              {route.config.urlRewrite.path.type === 'ReplacePrefixMatch' && route.config.urlRewrite.path.replacePrefixMatch !== undefined && (
                                <div className="text-sm">
                                  <span className="text-gray-500">Replace prefix with:</span>
                                  <code className="ml-2 px-2 py-1 bg-orange-50 rounded text-orange-700">
                                    {route.config.urlRewrite.path.replacePrefixMatch || '(empty - removes prefix)'}
                                  </code>
                                </div>
                              )}
                              {route.config.urlRewrite.path.type === 'ReplaceFullPath' && route.config.urlRewrite.path.replaceFullPath && (
                                <div className="text-sm">
                                  <span className="text-gray-500">Replace full path with:</span>
                                  <code className="ml-2 px-2 py-1 bg-orange-50 rounded text-orange-700">{route.config.urlRewrite.path.replaceFullPath}</code>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No URL rewrite configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Compression Section */}
                <AccordionItem value="compression">
                  <AccordionTrigger
                    value="compression"
                    badge={
                      hasCompression() ? (
                        <Badge variant="success" className="text-xs">
                          {route!.backendTrafficPolicy!.config!.compression!.length} type{route!.backendTrafficPolicy!.config!.compression!.length > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Response Compression
                  </AccordionTrigger>
                  <AccordionContent value="compression">
                    {hasCompression() ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500">
                          Responses from backend services are compressed before sending to clients.
                        </p>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-gray-700">Compression Types</h3>
                          <div className="flex flex-wrap gap-2">
                            {route!.backendTrafficPolicy!.config!.compression!.map((comp, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <Badge variant="info">{comp.type}</Badge>
                                <span className="text-xs text-gray-500">
                                  {comp.type === 'Gzip' && 'Most compatible'}
                                  {comp.type === 'Brotli' && 'Better ratio'}
                                  {comp.type === 'Zstd' && 'Fastest'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No response compression configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Retry Section */}
                <AccordionItem value="retry">
                  <AccordionTrigger
                    value="retry"
                    badge={
                      hasRetry() ? (
                        <Badge variant="success" className="text-xs">Enabled</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Retry Policy
                  </AccordionTrigger>
                  <AccordionContent value="retry">
                    {hasRetry() ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                          Failed requests to backend services are automatically retried.
                        </p>

                        {/* Retries count */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-500 mb-1">Number of Retries</div>
                            <div className="text-sm font-medium text-gray-900">
                              {route!.backendTrafficPolicy!.config!.retry!.numRetries ?? '2 (default)'}
                            </div>
                          </div>
                          {route!.backendTrafficPolicy!.config!.retry!.perRetryPolicy?.timeout && (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="text-xs text-gray-500 mb-1">Per-Attempt Timeout</div>
                              <div className="text-sm font-medium text-gray-900">
                                {route!.backendTrafficPolicy!.config!.retry!.perRetryPolicy.timeout}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Status Codes */}
                        {route!.backendTrafficPolicy!.config!.retry!.retryOn?.httpStatusCodes &&
                          route!.backendTrafficPolicy!.config!.retry!.retryOn.httpStatusCodes.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">HTTP Status Codes</h3>
                            <div className="flex flex-wrap gap-2">
                              {route!.backendTrafficPolicy!.config!.retry!.retryOn.httpStatusCodes.map((code) => (
                                <Badge key={code} variant="info">{code}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Triggers */}
                        {route!.backendTrafficPolicy!.config!.retry!.retryOn?.triggers &&
                          route!.backendTrafficPolicy!.config!.retry!.retryOn.triggers.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Triggers</h3>
                            <div className="flex flex-wrap gap-2">
                              {route!.backendTrafficPolicy!.config!.retry!.retryOn.triggers.map((trigger) => (
                                <Badge key={trigger} variant="default">
                                  {triggerDisplayMap[trigger] || trigger}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Backoff */}
                        {route!.backendTrafficPolicy!.config!.retry!.perRetryPolicy?.backOff && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Backoff</h3>
                            <div className="grid grid-cols-2 gap-4">
                              {route!.backendTrafficPolicy!.config!.retry!.perRetryPolicy.backOff.baseInterval && (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="text-xs text-gray-500 mb-1">Base Interval</div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {route!.backendTrafficPolicy!.config!.retry!.perRetryPolicy.backOff.baseInterval}
                                  </div>
                                </div>
                              )}
                              {route!.backendTrafficPolicy!.config!.retry!.perRetryPolicy.backOff.maxInterval && (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="text-xs text-gray-500 mb-1">Max Interval</div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {route!.backendTrafficPolicy!.config!.retry!.perRetryPolicy.backOff.maxInterval}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No retry policy configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Load Balancing Section */}
                <AccordionItem value="load-balancing">
                  <AccordionTrigger
                    value="load-balancing"
                    badge={
                      hasLoadBalancer() ? (
                        <Badge variant="success" className="text-xs">
                          {route!.backendTrafficPolicy!.config.loadBalancer!.type === 'ConsistentHash'
                            ? `ConsistentHash (${route!.backendTrafficPolicy!.config.loadBalancer!.consistentHash?.type})`
                            : route!.backendTrafficPolicy!.config.loadBalancer!.type}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Load Balancing
                  </AccordionTrigger>
                  <AccordionContent value="load-balancing">
                    {hasLoadBalancer() ? (() => {
                      const lb = route!.backendTrafficPolicy!.config.loadBalancer!;
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Algorithm:</span>
                            <Badge variant="info">{lb.type}</Badge>
                          </div>

                          {lb.type === 'ConsistentHash' && lb.consistentHash && (
                            <div className="space-y-3 pt-3 border-t">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Hash Key:</span>
                                <Badge variant="info">{lb.consistentHash.type}</Badge>
                              </div>

                              {lb.consistentHash.type === 'Header' && lb.consistentHash.header && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">Header Name:</span>
                                  <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{lb.consistentHash.header.name}</code>
                                </div>
                              )}

                              {lb.consistentHash.type === 'Cookie' && lb.consistentHash.cookie && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Cookie Name:</span>
                                    <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{lb.consistentHash.cookie.name}</code>
                                  </div>
                                  {lb.consistentHash.cookie.ttl && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">TTL:</span>
                                      <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{lb.consistentHash.cookie.ttl}</code>
                                    </div>
                                  )}
                                  {lb.consistentHash.cookie.attributes && Object.keys(lb.consistentHash.cookie.attributes).length > 0 && (
                                    <div>
                                      <span className="text-sm text-gray-600">Attributes:</span>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {Object.entries(lb.consistentHash.cookie.attributes).map(([key, value]) => (
                                          <span key={key} className="inline-flex items-center px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs">
                                            {key}={value}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="text-gray-500 italic">No load balancing configured (defaults to Least Request)</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Circuit Breaker Section */}
                <AccordionItem value="circuit-breaker">
                  <AccordionTrigger
                    value="circuit-breaker"
                    badge={
                      hasCircuitBreaker() ? (
                        <Badge variant="success" className="text-xs">Enabled</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    Circuit Breaker
                  </AccordionTrigger>
                  <AccordionContent value="circuit-breaker">
                    {hasCircuitBreaker() ? (() => {
                      const cb = route!.backendTrafficPolicy!.config.circuitBreaker!;
                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-sm font-medium text-gray-700">Max Connections</span>
                              <p className="text-sm text-gray-900 mt-0.5">
                                {cb.maxConnections != null ? cb.maxConnections : <span className="text-gray-400">Default (1024)</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-700">Max Pending Requests</span>
                              <p className="text-sm text-gray-900 mt-0.5">
                                {cb.maxPendingRequests != null ? cb.maxPendingRequests : <span className="text-gray-400">Default (1024)</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-700">Max Parallel Requests</span>
                              <p className="text-sm text-gray-900 mt-0.5">
                                {cb.maxParallelRequests != null ? cb.maxParallelRequests : <span className="text-gray-400">Default (1024)</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-700">Max Parallel Retries</span>
                              <p className="text-sm text-gray-900 mt-0.5">
                                {cb.maxParallelRetries != null ? cb.maxParallelRetries : <span className="text-gray-400">Default (1024)</span>}
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Max Requests Per Connection</span>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {cb.maxRequestsPerConnection != null ? cb.maxRequestsPerConnection : <span className="text-gray-400">Unlimited</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="text-gray-500 italic">No circuit breaker configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </TabsContent>

            {/* Extensions Tab */}
            <TabsContent value="extensions">
              <div className="space-y-6">
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <h4 className="text-sm font-medium text-primary-800 mb-1">Envoy Extensions</h4>
                  <p className="text-xs text-primary-600">
                    Custom Lua scripts, WebAssembly (Wasm) modules, or external processing (ext-proc) services that extend Envoy&apos;s request/response processing.
                  </p>
                </div>

                <Accordion type="multiple" defaultValue={['lua', 'wasm', 'ext-proc']}>
                  {/* Lua Extension Section */}
                  <AccordionItem value="lua">
                    <AccordionTrigger
                      value="lua"
                      badge={
                        hasLuaExtension() ? (
                          <Badge variant="success" className="text-xs">
                            {route!.extensionPolicy!.config.lua!.type === 'Inline' ? 'Inline' : 'ConfigMap'}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">Not configured</Badge>
                        )
                      }
                    >
                      Lua Extension
                    </AccordionTrigger>
                    <AccordionContent value="lua">
                      {hasLuaExtension() ? (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-500">
                            Lua script for request/response processing.
                          </p>
                          <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">Source Type:</span>
                              <Badge variant="info">{route!.extensionPolicy!.config.lua!.type}</Badge>
                            </div>
                            {route!.extensionPolicy!.config.lua!.type === 'Inline' && route!.extensionPolicy!.config.lua!.inline && (
                              <div className="space-y-2">
                                <span className="text-sm font-medium text-gray-700">Script:</span>
                                <pre className="p-3 bg-gray-900 text-gray-100 rounded-md text-xs overflow-x-auto">
                                  {route!.extensionPolicy!.config.lua!.inline}
                                </pre>
                              </div>
                            )}
                            {route!.extensionPolicy!.config.lua!.type === 'ValueRef' && route!.extensionPolicy!.config.lua!.valueRef && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">ConfigMap:</span>
                                  <code className="text-sm bg-white px-2 py-0.5 rounded border">
                                    {route!.extensionPolicy!.config.lua!.valueRef.name}
                                  </code>
                                </div>
                                {route!.extensionPolicy!.config.lua!.valueRef.namespace && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">Namespace:</span>
                                    <code className="text-sm bg-white px-2 py-0.5 rounded border">
                                      {route!.extensionPolicy!.config.lua!.valueRef.namespace}
                                    </code>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 italic">No Lua extension configured</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Wasm Extension Section */}
                  <AccordionItem value="wasm">
                    <AccordionTrigger
                      value="wasm"
                      badge={
                        hasWasmExtension() ? (
                          <Badge variant="success" className="text-xs">
                            {route!.extensionPolicy!.config.wasm!.name}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">Not configured</Badge>
                        )
                      }
                    >
                      Wasm Extension
                    </AccordionTrigger>
                    <AccordionContent value="wasm">
                      {hasWasmExtension() ? (() => {
                        const wasm = route!.extensionPolicy!.config.wasm!;
                        return (
                          <div className="space-y-4">
                            <p className="text-sm text-gray-500">
                              WebAssembly module for request/response processing.
                            </p>
                            <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Name:</span>
                                <code className="text-sm bg-white px-2 py-0.5 rounded border">{wasm.name}</code>
                              </div>
                              {wasm.rootID && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">Root ID:</span>
                                  <code className="text-sm bg-white px-2 py-0.5 rounded border">{wasm.rootID}</code>
                                </div>
                              )}
                              {wasm.code.http && (
                                <div className="space-y-2">
                                  <span className="text-sm font-medium text-gray-700">HTTP Source:</span>
                                  <div className="pl-3 border-l-2 border-gray-200 text-sm">
                                    <div>URL: <code className="bg-white px-1 py-0.5 rounded border">{wasm.code.http.url}</code></div>
                                    {wasm.code.http.sha256 && <div>SHA256: <code className="bg-white px-1 py-0.5 rounded border">{wasm.code.http.sha256}</code></div>}
                                  </div>
                                </div>
                              )}
                              {wasm.code.image && (
                                <div className="space-y-2">
                                  <span className="text-sm font-medium text-gray-700">OCI Image:</span>
                                  <div className="pl-3 border-l-2 border-gray-200 text-sm">
                                    <div>URL: <code className="bg-white px-1 py-0.5 rounded border">{wasm.code.image.url}</code></div>
                                    {wasm.code.image.sha256 && <div>SHA256: <code className="bg-white px-1 py-0.5 rounded border">{wasm.code.image.sha256}</code></div>}
                                    {wasm.code.image.pullSecret && <div>Pull Secret: <code className="bg-white px-1 py-0.5 rounded border">{wasm.code.image.pullSecret.name}</code></div>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="text-gray-500 italic">No Wasm extension configured</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* External Processing Section */}
                  <AccordionItem value="ext-proc">
                    <AccordionTrigger
                      value="ext-proc"
                      badge={
                        hasExtProcExtension() ? (
                          <Badge variant="success" className="text-xs">
                            {route!.extensionPolicy!.config.extProc!.backendRef.name}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">Not configured</Badge>
                        )
                      }
                    >
                      External Processing (ext-proc)
                    </AccordionTrigger>
                    <AccordionContent value="ext-proc">
                      {hasExtProcExtension() ? (() => {
                        const extProc = route!.extensionPolicy!.config.extProc!;
                        return (
                          <div className="space-y-4">
                            <p className="text-sm text-gray-500">
                              External gRPC service for request/response processing.
                            </p>
                            <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Service:</span>
                                <code className="text-sm bg-white px-2 py-0.5 rounded border">{extProc.backendRef.name}</code>
                              </div>
                              {extProc.backendRef.namespace && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">Namespace:</span>
                                  <code className="text-sm bg-white px-2 py-0.5 rounded border">{extProc.backendRef.namespace}</code>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Port:</span>
                                <code className="text-sm bg-white px-2 py-0.5 rounded border">{extProc.backendRef.port}</code>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Fail Open:</span>
                                <Badge variant={extProc.failOpen ? 'warning' : 'default'}>
                                  {extProc.failOpen ? 'Yes' : 'No'}
                                </Badge>
                              </div>
                              {extProc.processingMode && (
                                <div className="space-y-2">
                                  <span className="text-sm font-medium text-gray-700">Processing Mode:</span>
                                  <div className="pl-3 border-l-2 border-gray-200 text-sm space-y-1">
                                    {extProc.processingMode.request?.body && (
                                      <div>Request Body: <Badge variant="info">{extProc.processingMode.request.body}</Badge></div>
                                    )}
                                    {extProc.processingMode.response?.body && (
                                      <div>Response Body: <Badge variant="info">{extProc.processingMode.response.body}</Badge></div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="text-gray-500 italic">No external processing configured</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security">
              <Accordion type="multiple" defaultValue={['cors', 'effective-ips', 'ip-allowlist', 'apikey-auth', 'jwt-auth', 'oidc', 'ext-auth']}>
                {/* CORS Section */}
                <AccordionItem value="cors">
                  <AccordionTrigger
                    value="cors"
                    badge={
                      hasCors() ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    CORS Configuration
                  </AccordionTrigger>
                  <AccordionContent value="cors">
                    {hasCors() ? (
                      <div className="grid grid-cols-2 gap-6">
                        {route.securityPolicy!.config.cors!.allowOrigins && route.securityPolicy!.config.cors!.allowOrigins.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Allowed Origins</h3>
                            <div className="flex flex-wrap gap-1">
                              {route.securityPolicy!.config.cors!.allowOrigins.map((origin, idx) => (
                                <code key={idx} className="px-2 py-1 bg-primary-50 rounded text-primary-700 text-sm">{origin}</code>
                              ))}
                            </div>
                          </div>
                        )}
                        {route.securityPolicy!.config.cors!.allowMethods && route.securityPolicy!.config.cors!.allowMethods.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Allowed Methods</h3>
                            <div className="flex flex-wrap gap-1">
                              {route.securityPolicy!.config.cors!.allowMethods.map((method, idx) => (
                                <Badge key={idx} variant="default">{method}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {route.securityPolicy!.config.cors!.allowHeaders && route.securityPolicy!.config.cors!.allowHeaders.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Allowed Headers</h3>
                            <div className="flex flex-wrap gap-1">
                              {route.securityPolicy!.config.cors!.allowHeaders.map((header, idx) => (
                                <code key={idx} className="px-2 py-1 bg-gray-100 rounded text-gray-700 text-sm">{header}</code>
                              ))}
                            </div>
                          </div>
                        )}
                        {route.securityPolicy!.config.cors!.exposeHeaders && route.securityPolicy!.config.cors!.exposeHeaders.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Expose Headers</h3>
                            <div className="flex flex-wrap gap-1">
                              {route.securityPolicy!.config.cors!.exposeHeaders.map((header, idx) => (
                                <code key={idx} className="px-2 py-1 bg-green-50 rounded text-green-700 text-sm">{header}</code>
                              ))}
                            </div>
                          </div>
                        )}
                        {route.securityPolicy!.config.cors!.maxAge !== undefined && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Max Age</h3>
                            <code className="px-2 py-1 bg-gray-100 rounded text-gray-700 text-sm">{route.securityPolicy!.config.cors!.maxAge}s</code>
                          </div>
                        )}
                        {route.securityPolicy!.config.cors!.allowCredentials !== undefined && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Allow Credentials</h3>
                            <Badge variant={route.securityPolicy!.config.cors!.allowCredentials ? 'success' : 'default'}>
                              {route.securityPolicy!.config.cors!.allowCredentials ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No CORS configuration</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* General mode: IP Allowlisting */}
                <AccordionItem value="ip-allowlist">
                  <AccordionTrigger
                    value="ip-allowlist"
                    badge={
                      route.securityMode === 'client' ? (
                        <Badge variant="default" className="text-xs">Client mode</Badge>
                      ) : route.securityPolicy?.config?.authorization ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    IP Allowlisting
                  </AccordionTrigger>
                  <AccordionContent value="ip-allowlist">
                    {route.securityMode === 'client' ? (
                      <div className="text-gray-500 italic">Not available in client mode. Use client attachments for IP allowlisting.</div>
                    ) : route.securityPolicy?.config?.authorization ? (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500">Default Action: {route.securityPolicy.config.authorization.defaultAction}</p>
                        {route.securityPolicy.config.authorization.rules?.map((rule: AuthorizationRule, i: number) => (
                          <div key={i} className="space-y-1">
                            <p className="text-sm font-medium">Action: {rule.action}</p>
                            <div className="flex flex-wrap gap-1">
                              {rule.principal?.clientCIDRs?.map((cidr: string, j: number) => (
                                <span key={j} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">{cidr}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No IP allowlisting configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* General mode: API Key Authentication */}
                <AccordionItem value="apikey-auth">
                  <AccordionTrigger
                    value="apikey-auth"
                    badge={
                      route.securityMode === 'client' ? (
                        <Badge variant="default" className="text-xs">Client mode</Badge>
                      ) : route.securityPolicy?.config?.apiKeyAuth ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    API Key Authentication
                  </AccordionTrigger>
                  <AccordionContent value="apikey-auth">
                    {route.securityMode === 'client' ? (
                      <div className="text-gray-500 italic">Not available in client mode. Use client attachments for API key authentication.</div>
                    ) : route.securityPolicy?.config?.apiKeyAuth ? (
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500">Secret Name</p>
                          <p className="text-sm">{route.securityPolicy.config.apiKeyAuth.credentialRefs?.[0]?.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Header</p>
                          <p className="text-sm">{route.securityPolicy.config.apiKeyAuth.extractFrom?.[0]?.headers?.[0]}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No API key authentication configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* General mode: JWT Validation */}
                <AccordionItem value="jwt-auth">
                  <AccordionTrigger
                    value="jwt-auth"
                    badge={
                      route.securityMode === 'client' ? (
                        <Badge variant="default" className="text-xs">Client mode</Badge>
                      ) : route.securityPolicy?.config?.jwt ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    JWT Validation
                  </AccordionTrigger>
                  <AccordionContent value="jwt-auth">
                    {route.securityMode === 'client' ? (
                      <div className="text-gray-500 italic">Not available in client mode. Use client attachments for JWT validation.</div>
                    ) : route.securityPolicy?.config?.jwt ? (
                      <>
                        {route.securityPolicy.config.jwt.providers?.map((provider: JWTProviderConfig, i: number) => (
                          <div key={i} className="space-y-2">
                            <div>
                              <p className="text-sm text-gray-500">Issuer</p>
                              <p className="text-sm">{provider.issuer}</p>
                            </div>
                            {provider.remoteJWKS?.uri && (
                              <div>
                                <p className="text-sm text-gray-500">JWKS URL</p>
                                <p className="text-sm break-all">{provider.remoteJWKS.uri}</p>
                              </div>
                            )}
                            {provider.audiences && provider.audiences.length > 0 && (
                              <div>
                                <p className="text-sm text-gray-500">Audiences</p>
                                <div className="flex flex-wrap gap-1">
                                  {provider.audiences.map((aud: string, j: number) => (
                                    <span key={j} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">{aud}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-gray-500 italic">No JWT validation configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* General mode: OIDC / SSO Login */}
                <AccordionItem value="oidc">
                  <AccordionTrigger
                    value="oidc"
                    badge={
                      route.securityMode === 'client' ? (
                        <Badge variant="default" className="text-xs">Client mode</Badge>
                      ) : route.securityPolicy?.config?.oidc ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    OIDC / SSO Login
                  </AccordionTrigger>
                  <AccordionContent value="oidc">
                    {route.securityMode === 'client' ? (
                      <div className="text-gray-500 italic">Not available in client mode. OIDC/SSO requires general security mode.</div>
                    ) : route.securityPolicy?.config?.oidc ? (
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500">Issuer</p>
                          <p className="text-sm">{route.securityPolicy.config.oidc.provider?.issuer}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Client ID</p>
                          <p className="text-sm">{route.securityPolicy.config.oidc.clientId}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Redirect URL</p>
                          <p className="text-sm break-all">{route.securityPolicy.config.oidc.redirectURL}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Logout Path</p>
                          <p className="text-sm">{route.securityPolicy.config.oidc.logoutPath}</p>
                        </div>
                        {route.securityPolicy.config.oidc.scopes && route.securityPolicy.config.oidc.scopes.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-500">Scopes</p>
                            <div className="flex flex-wrap gap-1">
                              {route.securityPolicy.config.oidc.scopes.map((scope: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">{scope}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {route.securityPolicy.config.oidc.cookieDomain && (
                          <div>
                            <p className="text-sm text-gray-500">Cookie Domain</p>
                            <p className="text-sm">{route.securityPolicy.config.oidc.cookieDomain}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No OIDC / SSO login configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* External Authorization (both modes) */}
                <AccordionItem value="ext-auth">
                  <AccordionTrigger
                    value="ext-auth"
                    badge={
                      route.securityPolicy?.config?.extAuth ? (
                        <Badge variant="success" className="text-xs">Configured</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    External Authorization
                  </AccordionTrigger>
                  <AccordionContent value="ext-auth">
                    {route.securityPolicy?.config?.extAuth ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Type</p>
                            <p className="text-sm font-medium uppercase">{route.securityPolicy.config.extAuth.type}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Fail Open</p>
                            <Badge variant={route.securityPolicy.config.extAuth.failOpen ? 'warning' : 'default'}>
                              {route.securityPolicy.config.extAuth.failOpen ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                        </div>

                        {/* HTTP Config */}
                        {route.securityPolicy.config.extAuth.type === 'http' && route.securityPolicy.config.extAuth.http && (
                          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                            <h4 className="text-sm font-medium">HTTP Backend</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-gray-500">Service</p>
                                <p>{route.securityPolicy.config.extAuth.http.backendRef.name}</p>
                              </div>
                              {route.securityPolicy.config.extAuth.http.backendRef.namespace && (
                                <div>
                                  <p className="text-gray-500">Namespace</p>
                                  <p>{route.securityPolicy.config.extAuth.http.backendRef.namespace}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-500">Port</p>
                                <p>{route.securityPolicy.config.extAuth.http.backendRef.port}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Path</p>
                                <p>{route.securityPolicy.config.extAuth.http.path}</p>
                              </div>
                            </div>
                            {route.securityPolicy.config.extAuth.http.headersToBackend && route.securityPolicy.config.extAuth.http.headersToBackend.length > 0 && (
                              <div>
                                <p className="text-sm text-gray-500">Headers to Backend</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {route.securityPolicy.config.extAuth.http.headersToBackend.map((h: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm">{h}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* gRPC Config */}
                        {route.securityPolicy.config.extAuth.type === 'grpc' && route.securityPolicy.config.extAuth.grpc && (
                          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                            <h4 className="text-sm font-medium">gRPC Backend</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-gray-500">Service</p>
                                <p>{route.securityPolicy.config.extAuth.grpc.backendRef.name}</p>
                              </div>
                              {route.securityPolicy.config.extAuth.grpc.backendRef.namespace && (
                                <div>
                                  <p className="text-gray-500">Namespace</p>
                                  <p>{route.securityPolicy.config.extAuth.grpc.backendRef.namespace}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-500">Port</p>
                                <p>{route.securityPolicy.config.extAuth.grpc.backendRef.port}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Header Forwarding */}
                        {(route.securityPolicy.config.extAuth.headersToDownstreamOnDeny && route.securityPolicy.config.extAuth.headersToDownstreamOnDeny.length > 0) && (
                          <div>
                            <p className="text-sm text-gray-500">Headers to Downstream on Deny</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {route.securityPolicy.config.extAuth.headersToDownstreamOnDeny.map((h: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-red-50 text-red-700 rounded text-sm">{h}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(route.securityPolicy.config.extAuth.headersToDownstreamOnAllow && route.securityPolicy.config.extAuth.headersToDownstreamOnAllow.length > 0) && (
                          <div>
                            <p className="text-sm text-gray-500">Headers to Downstream on Allow</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {route.securityPolicy.config.extAuth.headersToDownstreamOnAllow.map((h: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm">{h}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(route.securityPolicy.config.extAuth.headersToUpstreamOnAllow && route.securityPolicy.config.extAuth.headersToUpstreamOnAllow.length > 0) && (
                          <div>
                            <p className="text-sm text-gray-500">Headers to Upstream on Allow</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {route.securityPolicy.config.extAuth.headersToUpstreamOnAllow.map((h: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-sm">{h}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Request Body */}
                        {route.securityPolicy.config.extAuth.withRequestBody && (
                          <div>
                            <p className="text-sm text-gray-500">Include Request Body</p>
                            <p className="text-sm">Max {route.securityPolicy.config.extAuth.withRequestBody.maxBytes} bytes</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No external authorization configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* WAF Protection */}
                <AccordionItem value="waf">
                  <AccordionTrigger
                    value="waf"
                    badge={
                      route.wafPolicy ? (
                        <Badge variant={route.wafPolicy.config.mode === 'block' ? 'success' : 'warning'} className="text-xs capitalize">
                          {route.wafPolicy.config.mode}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">Not configured</Badge>
                      )
                    }
                  >
                    WAF Protection
                  </AccordionTrigger>
                  <AccordionContent value="waf">
                    {route.wafPolicy ? (
                      <div className="space-y-4">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          <dt className="text-gray-500">Mode</dt>
                          <dd className="font-medium capitalize">{route.wafPolicy.config.mode}</dd>

                          <dt className="text-gray-500">Rulesets</dt>
                          <dd className="font-medium">
                            {route.wafPolicy.config.rulesets && route.wafPolicy.config.rulesets.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {route.wafPolicy.config.rulesets.map((ruleset, idx) => (
                                  <Badge key={idx} variant="default">{ruleset}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </dd>

                          <dt className="text-gray-500">Paranoia Level</dt>
                          <dd className="font-medium">{route.wafPolicy.config.paranoiaLevel ?? 1}</dd>

                          <dt className="text-gray-500">Anomaly Threshold</dt>
                          <dd className="font-medium">{route.wafPolicy.config.anomalyThreshold ?? 5}</dd>
                        </dl>

                        {route.wafPolicy.config.disabledRuleIDs && route.wafPolicy.config.disabledRuleIDs.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Disabled Rules</p>
                            <div className="flex flex-wrap gap-1">
                              {route.wafPolicy.config.disabledRuleIDs.map((ruleId, idx) => (
                                <code key={idx} className="px-2 py-1 bg-gray-100 rounded text-gray-700 text-xs">{ruleId}</code>
                              ))}
                            </div>
                          </div>
                        )}

                        {route.wafPolicy.config.customDirectives && route.wafPolicy.config.customDirectives.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Custom Directives</p>
                            <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                              {route.wafPolicy.config.customDirectives.join('\n')}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No WAF protection configured</div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Client mode: Client IP Allowlist Section */}
                {route.securityMode === 'client' && effectiveIPs.length > 0 && (
                  <AccordionItem value="effective-ips">
                    <AccordionTrigger
                      value="effective-ips"
                      badge={
                        <Badge variant="info" className="text-xs">
                          {effectiveIPs.length} IP{effectiveIPs.length > 1 ? 's' : ''}
                        </Badge>
                      }
                    >
                      Client IP Allowlist
                    </AccordionTrigger>
                    <AccordionContent value="effective-ips">
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500">
                          IP addresses from attached clients with IP allowlisting enabled.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CIDR</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {effectiveIPs.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    <code className="text-sm px-2 py-1 bg-primary-50 rounded text-primary-700">{entry.cidr}</code>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-700">
                                    {entry.clientName}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-500">
                                    {entry.description || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </TabsContent>

            {/* Clients Tab */}
            {route.securityMode === 'client' && (
            <TabsContent value="clients">
              <Accordion type="multiple" defaultValue={['clients']}>
                <AccordionItem value="clients">
                  <AccordionTrigger
                    value="clients"
                    badge={
                      attachedClients.length > 0 ? (
                        <Badge variant="success" className="text-xs">
                          {attachedClients.length} client{attachedClients.length > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">No clients</Badge>
                      )
                    }
                  >
                    Attached Clients
                  </AccordionTrigger>
                  <AccordionContent value="clients">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Clients attached to this route for security policy enforcement. Manage attachments from the Edit page.
                        </p>
                      </div>
                      {attachedClients.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Security Features</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate Limit</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Routing Header</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {attachedClients.map((att) => (
                                <tr key={att.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <div>
                                      <span className="text-sm font-medium text-gray-900">
                                        {att.client?.name || att.clientId}
                                      </span>
                                      {att.client?.description && (
                                        <p className="text-xs text-gray-500 mt-0.5">{att.client.description}</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant="default">{att.client?.team?.name || 'Unknown'}</Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1 flex-wrap">
                                      {att.enableIpAllowlist && <Badge variant="info">IP Allow</Badge>}
                                      {att.enableApiKey && <Badge variant="info">API Key</Badge>}
                                      {att.enableJwt && <Badge variant="info">JWT</Badge>}
                                      {att.enableBasicAuth && <Badge variant="info">Auth</Badge>}
                                      {att.enableMtls && <Badge variant="info">mTLS</Badge>}
                                      {!att.enableIpAllowlist && !att.enableApiKey && !att.enableJwt && !att.enableBasicAuth && !att.enableMtls && (
                                        <span className="text-sm text-gray-400">None</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {att.rateLimitConfig?.global?.rules && att.rateLimitConfig.global.rules.length > 0 ? (
                                      <div className="text-xs">
                                        <span className="font-medium text-gray-900">
                                          {att.rateLimitConfig.global.rules[0].limit.requests} req/{att.rateLimitConfig.global.rules[0].limit.unit}
                                        </span>
                                        {att.rateLimitConfig.global.rules[0].clientSelectors && att.rateLimitConfig.global.rules[0].clientSelectors.length > 0 && (
                                          <span className="text-gray-500 ml-1">
                                            (+selectors)
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {(att.enableApiKey || att.enableJwt) ? (
                                      <code className="text-xs font-mono bg-primary-50 text-primary-800 px-2 py-1 rounded break-all">
                                        {att.client?.clientIdHeaderName || 'x-client-id'}: {att.clientId}
                                      </code>
                                    ) : (
                                      <span className="text-xs text-gray-400">N/A</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {getAttachmentStatusBadge(att.status)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <Shield className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No clients attached to this route</p>
                          <p className="text-gray-400 text-xs mt-1">Attach clients to enforce IP allowlisting and other security features</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
            )}

            {/* Manifests Tab */}
            <TabsContent value="manifests">
              <Accordion type="multiple" defaultValue={['httproute']}>
                <AccordionItem value="httproute">
                  <AccordionTrigger value="httproute">
                    HTTPRoute
                  </AccordionTrigger>
                  <AccordionContent value="httproute">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                      {httpRouteYaml}
                    </pre>
                  </AccordionContent>
                </AccordionItem>

                {securityPolicyYaml && (
                  <AccordionItem value="security-policy">
                    <AccordionTrigger value="security-policy">
                      SecurityPolicy
                    </AccordionTrigger>
                    <AccordionContent value="security-policy">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {securityPolicyYaml}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {backendTrafficPolicyYaml && (
                  <AccordionItem value="backend-traffic-policy">
                    <AccordionTrigger value="backend-traffic-policy">
                      BackendTrafficPolicy
                    </AccordionTrigger>
                    <AccordionContent value="backend-traffic-policy">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {backendTrafficPolicyYaml}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {backendYaml && (
                  <AccordionItem value="backend">
                    <AccordionTrigger value="backend">
                      Backend
                    </AccordionTrigger>
                    <AccordionContent value="backend">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {backendYaml}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {httpRouteFilterYaml && (
                  <AccordionItem value="httproutefilter">
                    <AccordionTrigger value="httproutefilter">
                      HTTPRouteFilter (Direct Response)
                    </AccordionTrigger>
                    <AccordionContent value="httproutefilter">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {httpRouteFilterYaml}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {configMapYaml && (
                  <AccordionItem value="configmap">
                    <AccordionTrigger value="configmap">
                      ConfigMap (Response Body)
                    </AccordionTrigger>
                    <AccordionContent value="configmap">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {configMapYaml}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {envoyExtensionPolicyYaml && (
                  <AccordionItem value="envoy-extension-policy">
                    <AccordionTrigger value="envoy-extension-policy">
                      EnvoyExtensionPolicy
                    </AccordionTrigger>
                    <AccordionContent value="envoy-extension-policy">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {envoyExtensionPolicyYaml}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Per-Client API Key Resources */}
                {apiKeyClientResources.length > 0 && (
                  <AccordionItem value="api-key-clients">
                    <AccordionTrigger value="api-key-clients">
                      API Key Client Routes ({apiKeyClientResources.length})
                    </AccordionTrigger>
                    <AccordionContent value="api-key-clients">
                      <div className="space-y-6">
                        {apiKeyClientResources.map((clientResource, index) => (
                          <div key={clientResource.clientId} className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 mb-3">
                              Client: {clientResource.clientName}
                              <span className="text-gray-500 text-sm ml-2">({clientResource.clientId.substring(0, 8)}...)</span>
                            </h4>
                            <p className="text-sm text-gray-500 mb-3">
                              API key values are redacted for security. The actual key is stored in Kubernetes Secrets.
                            </p>
                            <Accordion type="multiple" defaultValue={[`client-${index}-httproute`]}>
                              <AccordionItem value={`client-${index}-httproute`}>
                                <AccordionTrigger value={`client-${index}-httproute`}>
                                  HTTPRoute
                                </AccordionTrigger>
                                <AccordionContent value={`client-${index}-httproute`}>
                                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                    {clientResource.httpRouteYaml}
                                  </pre>
                                </AccordionContent>
                              </AccordionItem>
                              <AccordionItem value={`client-${index}-securitypolicy`}>
                                <AccordionTrigger value={`client-${index}-securitypolicy`}>
                                  SecurityPolicy
                                </AccordionTrigger>
                                <AccordionContent value={`client-${index}-securitypolicy`}>
                                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                    {clientResource.securityPolicyYaml}
                                  </pre>
                                </AccordionContent>
                              </AccordionItem>
                              {clientResource.backendTrafficPolicyYaml && (
                                <AccordionItem value={`client-${index}-btp`}>
                                  <AccordionTrigger value={`client-${index}-btp`}>
                                    BackendTrafficPolicy
                                  </AccordionTrigger>
                                  <AccordionContent value={`client-${index}-btp`}>
                                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                      {clientResource.backendTrafficPolicyYaml}
                                    </pre>
                                  </AccordionContent>
                                </AccordionItem>
                              )}
                            </Accordion>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardContent className="py-6">
                  {isLoadingVersions ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">Loading version history...</p>
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No version history yet. Versions are created when a route is deployed.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Compare Selected button */}
                      {selectedVersions.length === 2 && (
                        <div className="flex justify-end">
                          <Button
                            variant="secondary"
                            onClick={handleCompareSelected}
                            disabled={isLoadingCompare}
                          >
                            <GitCompareArrows className="h-4 w-4 mr-1" />
                            {isLoadingCompare ? 'Loading...' : `Compare v${Math.min(...selectedVersions)} → v${Math.max(...selectedVersions)}`}
                          </Button>
                        </div>
                      )}
                      {versions.map((v, idx) => {
                        const isCurrent = idx === 0 && versionsPage === 1;
                        const isSelected = selectedVersions.includes(v.version);
                        return (
                          <div key={v.id} className={cn(
                            'flex items-start justify-between p-4 border rounded-lg',
                            isSelected && 'border-primary-300 bg-primary-50/30'
                          )}>
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleVersionSelection(v.version)}
                                className="mt-1"
                              />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-sm">v{v.version}</span>
                                  {isCurrent && (
                                    <Badge variant="success">current</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  Deployed by {v.deployer?.username || 'unknown'} on{' '}
                                  {new Date(v.createdAt).toLocaleString()}
                                </p>
                                {v.changeDescription && (
                                  <p className="text-sm text-gray-700 italic">&ldquo;{v.changeDescription}&rdquo;</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isCurrent && versions.length > 1 && (
                                <Button
                                  variant="ghost"
                                  onClick={() => handleCompareWithCurrent(v.version)}
                                  disabled={isLoadingCompare}
                                >
                                  <GitCompareArrows className="h-4 w-4 mr-1" />
                                  Compare
                                </Button>
                              )}
                              {!isCurrent && route?.status === 'active' && (
                                <Button
                                  variant="secondary"
                                  onClick={() => setShowRollbackConfirm(v.version)}
                                  disabled={isRollingBack}
                                >
                                  Rollback
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {versionsTotal > versions.length && (
                        <div className="flex justify-center pt-2">
                          <Button variant="ghost" onClick={() => loadVersions(versionsPage + 1)}>
                            Load More
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Rollback to version {showRollbackConfirm}?
              </h2>
              <p className="text-gray-600 mb-6">
                This will create a new approval request to revert the route configuration
                to version {showRollbackConfirm}. The rollback will not take effect until
                it is approved and deployed.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowRollbackConfirm(null)}
                  disabled={isRollingBack}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleRollback(showRollbackConfirm)}
                  isLoading={isRollingBack}
                >
                  Confirm Rollback
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Version Compare Modal */}
      {compareVersions && (
        <VersionCompareModal
          isOpen={true}
          onClose={() => {
            setCompareVersions(null);
            setSelectedVersions([]);
          }}
          versionA={compareVersions.a}
          versionB={compareVersions.b}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Route</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete the route <strong>{route.name}</strong>?
                This will submit a delete request for approval.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
                  Submit Delete Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
