'use client';

// L4 (TCP/UDP) route detail: header + actions, pending-approval banner, and
// Overview / Manifests / History tabs. The L4 counterpart of the HTTP route
// detail page, on the stream-scoped endpoints.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Clock, Pencil, Rocket, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { streamsApi, permissionsApi } from '@/lib/api';
import { L4RouteManifests } from '@/components/streams/L4RouteManifests';
import { L4RouteHistory } from '@/components/streams/L4RouteHistory';
import { L4RouteDeleteModal } from '@/components/streams/L4RouteDeleteModal';
import { l4StatusBadge, policySummary, routeActions } from '@/lib/utils/l4route';
import type { ProjectPermissions, Route, Stream } from '@/types';

type ApiError = { response?: { data?: { error?: string } } };

export default function L4RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const streamId = params.streamId as string;
  const routeId = params.routeId as string;
  const streamUrl = `/projects/${projectId}/streams/${streamId}`;
  const routeUrl = `${streamUrl}/routes/${routeId}`;

  const [stream, setStream] = useState<Stream | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const loadData = async () => {
    try {
      const [streamData, routeData, permsData] = await Promise.all([
        streamsApi.get(projectId, streamId),
        streamsApi.getRoute(projectId, streamId, routeId),
        permissionsApi.getProjectPermissions(projectId).catch(() => null),
      ]);
      setStream(streamData);
      setRoute(routeData);
      setPermissions(permsData);
      setLoadError(null);
    } catch (e: unknown) {
      setLoadError((e as ApiError).response?.data?.error || 'Route not found');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, streamId, routeId]);

  const handleDeploy = async () => {
    setIsDeploying(true);
    setActionError(null);
    try {
      await streamsApi.deployRoute(projectId, streamId, routeId);
      await loadData();
    } catch (e: unknown) {
      setActionError((e as ApiError).response?.data?.error || 'Failed to deploy route');
    } finally {
      setIsDeploying(false);
    }
  };

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

  if (!route || !stream) {
    return (
      <div className="p-8">
        <Link href={streamUrl} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Stream
        </Link>
        <p className="text-red-700">{loadError || 'Route not found'}</p>
      </div>
    );
  }

  const actions = routeActions(route.status, Boolean(permissions?.canCreateRoutes));
  const status = l4StatusBadge(route.status);
  const isDeleteAction = route.pendingApproval?.action === 'delete';
  const backends = route.config?.backends ?? [];
  const policy = policySummary(route.backendTrafficPolicy?.config);

  return (
    <div className="p-8">
      <Link href={streamUrl} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to {stream.name}
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
            <Badge>{route.protocol.toUpperCase()}</Badge>
            {route.config?.listenerPort != null && (
              <span className="font-mono text-gray-700">:{route.config.listenerPort}</span>
            )}
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            Owner: {route.team?.name || 'Unknown Team'} · Stream: {stream.name}
          </p>
        </div>
        <div className="flex gap-2">
          {actions.canDeploy && (
            <Button onClick={handleDeploy} disabled={isDeploying} variant={isDeleteAction ? 'danger' : 'primary'}>
              <Rocket className="h-4 w-4 mr-1" />
              {isDeploying
                ? isDeleteAction ? 'Destroying...' : 'Deploying...'
                : isDeleteAction ? 'Destroy' : 'Deploy'}
            </Button>
          )}
          {actions.canEdit && (
            <Link href={`${routeUrl}/edit`}>
              <Button variant="secondary">
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </Link>
          )}
          {actions.canDelete && (
            <Button variant="danger" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>{actionError}</div>
        </div>
      )}

      {actions.awaitingApproval && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3" data-testid="approval-banner">
              <div className="flex items-center gap-2 text-yellow-800">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Waiting for approval</span>
              </div>
              <Link
                href={`/projects/${projectId}/approvals`}
                className="text-sm font-medium text-yellow-800 underline hover:no-underline whitespace-nowrap"
              >
                Review in Approvals
              </Link>
            </div>
            {route.pendingApproval?.rejectionComment && (
              <p className="mt-2 text-sm text-yellow-700">Rejection reason: {route.pendingApproval.rejectionComment}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="manifests">Manifests</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-6 text-sm">
                <section>
                  <h3 className="font-medium text-gray-900 mb-1">Description</h3>
                  <p className="text-gray-600">{route.description || 'No description'}</p>
                </section>
                <section>
                  <h3 className="font-medium text-gray-900 mb-2">Backends</h3>
                  {backends.length === 0 ? (
                    <p className="text-gray-500">No backends.</p>
                  ) : (
                    <table className="w-full" data-testid="backends-table">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-2 pr-4 font-medium">Namespace</th>
                          <th className="py-2 pr-4 font-medium">Service</th>
                          <th className="py-2 pr-4 font-medium">Port</th>
                          <th className="py-2 font-medium">Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backends.map((b, i) => (
                          <tr key={`${b.namespace}-${b.service}-${b.port}-${i}`} className="border-b border-gray-100 last:border-0">
                            <td className="py-2 pr-4 text-gray-700">{b.namespace}</td>
                            <td className="py-2 pr-4 font-mono text-gray-900">{b.service}</td>
                            <td className="py-2 pr-4 font-mono text-gray-700">{b.port}</td>
                            <td className="py-2 text-gray-700">{b.weight ?? 100}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
                <section>
                  <h3 className="font-medium text-gray-900 mb-1">Traffic policy</h3>
                  {policy.length === 0 ? (
                    <p className="text-gray-500">No traffic policy; Envoy defaults apply.</p>
                  ) : (
                    <ul className="list-disc pl-5 text-gray-700" data-testid="policy-summary">
                      {policy.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="text-gray-500">
                  <p>Created {new Date(route.createdAt).toLocaleString()}</p>
                  <p>Updated {new Date(route.updatedAt).toLocaleString()}</p>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="manifests">
              <L4RouteManifests projectId={projectId} streamId={streamId} routeId={routeId} protocol={route.protocol} />
            </TabsContent>

            <TabsContent value="history">
              <L4RouteHistory projectId={projectId} streamId={streamId} routeId={routeId} routeStatus={route.status} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <L4RouteDeleteModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onDeleted={() => router.push(streamUrl)}
        projectId={projectId}
        streamId={streamId}
        routeId={routeId}
        routeName={route.name}
        protocol={route.protocol}
      />
    </div>
  );
}
