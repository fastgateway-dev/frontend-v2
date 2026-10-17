'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, AlertTriangle, Plus, Rocket } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { streamsApi, permissionsApi } from '@/lib/api';
import { L4MetricsCard } from '@/components/metrics/L4MetricsCard';
import { StreamEntrypointPanel } from '@/components/streams/StreamEntrypointPanel';
import { StreamManifests } from '@/components/streams/StreamManifests';
import { l4StatusBadge } from '@/lib/utils/l4route';
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
  // Bumped after a deploy so the Entry point panel re-reads port statuses.
  const [refreshKey, setRefreshKey] = useState(0);

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
      setRefreshKey((k) => k + 1);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setRouteActionError(err.response?.data?.error || 'Failed to deploy route');
    } finally {
      setDeployingRouteId(null);
    }
  };

  const canDeployRoute = (route: StreamRoute) => route.status === 'approved' || route.status === 'pending_deploy';

  const statusBadge = (status: string) => {
    const b = l4StatusBadge(status);
    return <Badge variant={b.variant}>{b.label}</Badge>;
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
            {statusBadge(stream.status)}
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

      <div className="mb-6">
        <StreamEntrypointPanel projectId={projectId} streamId={streamId} refreshKey={refreshKey} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="routes">
            <TabsList>
              <TabsTrigger value="routes">
                Routes
                {routes.length > 0 && <Badge variant="default" className="ml-2 text-xs">{routes.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="manifests">Manifests</TabsTrigger>
            </TabsList>

            <TabsContent value="routes">
              {permissions?.canCreateRoutes && (
                <div className="flex justify-end mb-4">
                  <Link href={`/projects/${projectId}/streams/${streamId}/routes/create`}>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add route
                    </Button>
                  </Link>
                </div>
              )}
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
                      <th className="py-2 pr-4 font-medium">Owner team</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route) => (
                      <tr key={route.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/projects/${projectId}/streams/${streamId}/routes/${route.id}`}
                            className="font-medium text-gray-900 hover:text-primary-600"
                          >
                            {route.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{(route.protocol || '').toUpperCase()}</td>
                        <td className="py-2 pr-4 text-gray-600 font-mono">{route.config?.listenerPort ?? '—'}</td>
                        <td className="py-2 pr-4 text-gray-600">{route.team?.name || '—'}</td>
                        <td className="py-2 pr-4">{statusBadge(route.status)}</td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-2">
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
            </TabsContent>

            <TabsContent value="metrics">
              <L4MetricsCard projectId={projectId} streamId={streamId} />
            </TabsContent>

            <TabsContent value="manifests">
              <StreamManifests projectId={projectId} streamId={streamId} />
            </TabsContent>
          </Tabs>
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
