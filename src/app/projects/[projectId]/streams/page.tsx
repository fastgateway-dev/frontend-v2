'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Waypoints } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { streamsApi, projectsApi, permissionsApi } from '@/lib/api';
import type { Stream, Project, ProjectPermissions } from '@/types';
import { entrypointLabel } from '@/lib/utils/stream-entrypoint';
import { filterStreams, portsSummary, type StreamStatusFilter } from '@/lib/utils/stream-list';

const SEARCH_DEBOUNCE_MS = 300;

export default function StreamsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Client-side filters (the list endpoint has no search/status params).
  const [statusFilter, setStatusFilter] = useState<StreamStatusFilter>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadData = async () => {
    try {
      const [projectData, streamsData, permsData] = await Promise.all([
        projectsApi.get(projectId),
        streamsApi.list(projectId),
        permissionsApi.getProjectPermissions(projectId),
      ]);
      setProject(projectData);
      setStreams(streamsData.data);
      setPermissions(permsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setSearchInput('');
    setSearchQuery('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'error':
        return <Badge variant="error">Error</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const dash = <span className="text-gray-400">—</span>;
  const visibleStreams = filterStreams(streams, statusFilter, searchQuery);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
          <p className="text-gray-600 mt-1">Manage L4 (TCP/UDP) streams</p>
        </div>
        {permissions?.canManageDomains && (
          <Link href={`/projects/${projectId}/streams/create`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Stream
            </Button>
          </Link>
        )}
      </div>

      {streams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Waypoints className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No streams yet</h3>
            <p className="text-gray-600 mb-4">
              {permissions?.canManageDomains
                ? 'Create your first stream to expose TCP/UDP services'
                : 'No streams have been created for this project yet'}
            </p>
            {permissions?.canManageDomains && (
              <Link href={`/projects/${projectId}/streams/create`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Stream
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 max-w-3xl">
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StreamStatusFilter)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="error">Error</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                aria-label="Search streams by name"
                placeholder="Search by name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {visibleStreams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No streams found</h3>
                <p className="text-gray-600 mb-4">No streams match your filters.</p>
                <Button variant="secondary" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Namespace</th>
                      <th className="px-4 py-3 font-medium">Entry point</th>
                      <th className="px-4 py-3 font-medium">Routes</th>
                      <th className="px-4 py-3 font-medium">Ports</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStreams.map((stream) => {
                      const ports = portsSummary(stream.ports);
                      return (
                        <tr key={stream.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              href={`/projects/${projectId}/streams/${stream.id}`}
                              className="font-semibold text-gray-900 hover:text-primary-600"
                            >
                              {stream.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{stream.namespace}</td>
                          <td className="px-4 py-3">
                            {stream.mode ? (
                              <span className="inline-flex items-center gap-2">
                                <Badge variant={stream.mode === 'shared' ? 'info' : 'default'}>
                                  {entrypointLabel(stream.mode).badge}
                                </Badge>
                                {stream.gatewayTemplateName && (
                                  <span className="text-gray-600">{stream.gatewayTemplateName}</span>
                                )}
                              </span>
                            ) : (
                              dash
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{stream.routeCount ?? dash}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono" data-testid={`ports-${stream.id}`}>
                            {ports.shown.length === 0 ? (
                              dash
                            ) : (
                              <>
                                {ports.shown.join(', ')}
                                {ports.more > 0 && <span className="text-gray-500"> +{ports.more}</span>}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(stream.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
