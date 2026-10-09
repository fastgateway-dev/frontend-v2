'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Waypoints } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { streamsApi, projectsApi, permissionsApi } from '@/lib/api';
import type { Stream, Project, ProjectPermissions } from '@/types';

export default function StreamsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

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
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Namespace</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">LB Address</th>
                </tr>
              </thead>
              <tbody>
                {streams.map((stream) => (
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
                    <td className="px-4 py-3">{getStatusBadge(stream.status)}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono">
                      {stream.loadBalancerAddress || <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
