'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, AlertTriangle, Plus, Pencil, Rocket } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal } from '@/components/ui';
import { streamsApi, permissionsApi } from '@/lib/api';
import { L4MetricsCard } from '@/components/metrics/L4MetricsCard';
import type { Stream, StreamRoute, ProjectPermissions } from '@/types';

export default function StreamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const streamId = params.streamId as string;

  const [stream, setStream] = useState<Stream | null>(null);
  const [routes, setRoutes] = useState<StreamRoute[]>([]);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deployingRouteId, setDeployingRouteId] = useState<string | null>(null);
  const [routeActionError, setRouteActionError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId, streamId]);

  const loadData = async () => {
    try {
      const [streamData, routesData, permsData] = await Promise.all([
        streamsApi.get(projectId, streamId),
        streamsApi.listRoutes(projectId, streamId).catch(() => ({ data: [] as StreamRoute[] })),
        permissionsApi.getProjectPermissions(projectId),
      ]);
      setStream(streamData);
      setRoutes(routesData.data || []);
      setPermissions(permsData);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error('Failed to load stream:', error);
      setLoadError(err.response?.data?.error || 'Failed to load stream');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await streamsApi.delete(projectId, streamId);
      router.push(`/projects/${projectId}/streams`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      // e.g. 409 "remove routes first"
      setDeleteError(err.response?.data?.error || 'Failed to delete stream');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeployRoute = async (routeId: string) => {
    setDeployingRouteId(routeId);
    setRouteActionError(null);
    try {
      await streamsApi.deployRoute(projectId, streamId, routeId);
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setRouteActionError(err.response?.data?.error || 'Failed to deploy route');
    } finally {
      setDeployingRouteId(null);
    }
  };

  const canDeployRoute = (route: StreamRoute) => route.status === 'approved' || route.status === 'pending_deploy';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'approved':
        return <Badge variant="info">Approved - Ready to Deploy</Badge>;
      case 'pending':
      case 'pending_deploy':
      case 'pending_create':
      case 'pending_update':
      case 'pending_delete':
        return <Badge variant="warning">{status === 'pending' ? 'Pending' : 'Pending Approval'}</Badge>;
      case 'error':
      case 'rejected':
        return <Badge variant="error">{status === 'error' ? 'Error' : 'Rejected'}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Ports in use, derived from the stream's L4 routes (one listener port per route).
  const portsInUse = routes
    .filter((r) => typeof r.config?.listenerPort === 'number' && r.config.listenerPort > 0)
    .map((r) => ({ port: r.config!.listenerPort as number, protocol: (r.protocol || '').toUpperCase(), route: r.name }))
    .sort((a, b) => a.port - b.port);

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

  if (!stream) {
    return (
      <div className="p-8">
        <Link
          href={`/projects/${projectId}/streams`}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Streams
        </Link>
        <p className="text-red-700">{loadError || 'Stream not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link
        href={`/projects/${projectId}/streams`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Streams
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{stream.name}</h1>
            {getStatusBadge(stream.status)}
          </div>
          <p className="text-gray-600 mt-1">
            Namespace: {stream.namespace}
            {stream.k8sGatewayName && ` · Gateway: ${stream.k8sGatewayName}`}
            {stream.k8sGatewayClass && ` · Class: ${stream.k8sGatewayClass}`}
          </p>
        </div>
        {permissions?.canManageDomains && (
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </div>

      {stream.statusMessage && stream.status === 'error' && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{stream.statusMessage}</p>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Failed to delete stream</h4>
              <p className="mt-1 text-sm text-red-700">{deleteError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Load Balancer Address</h3>
            {stream.loadBalancerAddress ? (
              <p className="font-mono text-gray-900">{stream.loadBalancerAddress}</p>
            ) : (
              <p className="text-sm text-gray-400">Not available yet</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Ports in use</h3>
            {portsInUse.length === 0 ? (
              <p className="text-sm text-gray-400">No ports in use</p>
            ) : (
              <ul className="space-y-1" data-testid="ports-in-use">
                {portsInUse.map((p) => (
                  <li key={`${p.protocol}-${p.port}-${p.route}`} className="text-sm text-gray-900">
                    <span className="font-mono">{p.port}</span>
                    <span className="text-gray-500"> / {p.protocol}</span>
                    <span className="text-gray-500"> — {p.route}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <L4MetricsCard projectId={projectId} streamId={streamId} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Routes
              {routes.length > 0 && <Badge variant="default" className="ml-2 text-xs">{routes.length}</Badge>}
            </h2>
            {permissions?.canCreateRoutes && (
              <Link href={`/projects/${projectId}/streams/${streamId}/routes/create`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add route
                </Button>
              </Link>
            )}
          </div>
          {routeActionError && <p className="mb-3 text-sm text-red-700">{routeActionError}</p>}
          {routes.length === 0 ? (
            <p className="text-sm text-gray-500">No routes yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Protocol</th>
                  <th className="py-2 pr-4 font-medium">Port</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <tr key={route.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-900">{route.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{(route.protocol || '').toUpperCase()}</td>
                    <td className="py-2 pr-4 text-gray-600 font-mono">{route.config?.listenerPort ?? '—'}</td>
                    <td className="py-2 pr-4">{getStatusBadge(route.status)}</td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">
                        {permissions?.canCreateRoutes && (
                          <Link href={`/projects/${projectId}/streams/${streamId}/routes/${route.id}/edit`}>
                            <Button size="sm" variant="secondary" aria-label={`Edit ${route.name}`}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </Link>
                        )}
                        {canDeployRoute(route) && (
                          <Button
                            size="sm"
                            onClick={() => handleDeployRoute(route.id)}
                            disabled={deployingRouteId === route.id}
                          >
                            <Rocket className="h-4 w-4 mr-1" />
                            {deployingRouteId === route.id ? 'Deploying...' : 'Deploy'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Stream">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete the stream <span className="font-semibold">{stream.name}</span>?
          </p>
          <p className="text-sm text-red-600">
            This will remove the stream&apos;s Gateway from your Kubernetes cluster. A stream that still has routes cannot be deleted.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
