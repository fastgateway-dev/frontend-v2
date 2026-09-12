'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Server, Search } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { projectsApi } from '@/lib/api';
import type { Project, ConnectionType } from '@/types';

const getConnectionTypeBadge = (connectionType: ConnectionType | undefined) => {
  switch (connectionType) {
    case 'in_cluster':
      return <Badge variant="info">in-cluster</Badge>;
    case 'kubeconfig':
      return <Badge variant="default">kubeconfig</Badge>;
    case 'api_token':
    default:
      return <Badge variant="default">api-token</Badge>;
  }
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchField, setSearchField] = useState<'name' | 'labels'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const labels = searchField === 'labels' ? debouncedQuery || undefined : undefined;
    const search = searchField === 'name' ? debouncedQuery || undefined : undefined;
    loadProjects(labels, search);
  }, [debouncedQuery, searchField]);

  const loadProjects = async (labels?: string, search?: string) => {
    try {
      const response = await projectsApi.list(1, 20, labels, search);
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your Kubernetes clusters</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <div className="flex">
            <select
              value={searchField}
              onChange={(e) => {
                setSearchField(e.target.value as 'name' | 'labels');
                setSearchQuery('');
              }}
              className="px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="name">Name</option>
              <option value="labels">Labels</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchField === 'labels'
                  ? 'Filter by labels (e.g. env=production,region=us-east)'
                  : 'Search projects by name...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-r-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? `No projects match your search "${searchQuery}"`
                : 'Create your first project to get started'}
            </p>
            {searchQuery ? (
              <Button variant="secondary" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            ) : (
              <Link href="/projects/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}/domains`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <Server className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{project.name}</h3>
                          {getConnectionTypeBadge(project.connectionType)}
                          {project.isConnected ? (
                            <Badge variant="success">Connected</Badge>
                          ) : (
                            <Badge variant="error">Disconnected</Badge>
                          )}
                        </div>
                        {project.labels && Object.keys(project.labels).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(project.labels).map(([key, value]) => (
                              <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                {key}{value ? `=${value}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-sm text-gray-500">
                          {project.connectionType === 'in_cluster'
                            ? 'Local Kubernetes cluster'
                            : project.k8sApiUrl || 'No URL configured'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {project.domainCount} domains · {project.routeCount} routes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
