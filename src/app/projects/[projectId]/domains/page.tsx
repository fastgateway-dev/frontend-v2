'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Globe, Search } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { domainsApi, projectsApi, permissionsApi } from '@/lib/api';
import type { Domain, Project, ProjectPermissions } from '@/types';

export default function DomainsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search state
  const [searchField, setSearchField] = useState<'hostname' | 'labels'>('hostname');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projectData, domainsData, permsData] = await Promise.all([
        projectsApi.get(projectId),
        domainsApi.list(projectId),
        permissionsApi.getProjectPermissions(projectId),
      ]);
      setProject(projectData);
      setDomains(domainsData.data);
      setPermissions(permsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Search domains with debounce
  const searchDomains = useCallback(async (query: string, field: string, status: string) => {
    setIsSearching(true);
    try {
      const search = field !== 'labels' ? query || undefined : undefined;
      const labels = field === 'labels' ? query || undefined : undefined;
      const domainsData = await domainsApi.list(
        projectId, 1, 100, search, status || undefined, labels
      );
      setDomains(domainsData.data);
    } catch (error) {
      console.error('Failed to search domains:', error);
    } finally {
      setIsSearching(false);
    }
  }, [projectId]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchDomains(searchQuery, searchField, statusFilter);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchField, statusFilter, searchDomains]);

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
          <p className="text-gray-600 mt-1">Manage domains and API gateways</p>
        </div>
        {permissions?.canManageDomains && (
          <Link href={`/projects/${projectId}/domains/create`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Domain
            </Button>
          </Link>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <div className="flex">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="error">Error</option>
            </select>
            <select
              value={searchField}
              onChange={(e) => {
                setSearchField(e.target.value as 'hostname' | 'labels');
                setSearchQuery('');
              }}
              className="px-3 py-2 border border-r-0 border-gray-300 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="hostname">Hostname</option>
              <option value="labels">Labels</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchField === 'labels'
                  ? 'Filter by labels (e.g. env=production,region=us-east)'
                  : 'Search by hostname...'}
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

      {domains.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || statusFilter ? 'No domains found' : 'No domains yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || statusFilter
                ? `No domains match your search${searchQuery ? ` "${searchQuery}"` : ''}${statusFilter ? ` with status "${statusFilter}"` : ''}`
                : permissions?.canManageDomains
                  ? 'Create your first domain to start routing traffic'
                  : 'No domains have been created for this project yet'}
            </p>
            {(searchQuery || statusFilter) ? (
              <Button variant="secondary" onClick={() => { setSearchQuery(''); setStatusFilter(''); }}>
                Clear Filters
              </Button>
            ) : permissions?.canManageDomains && (
              <Link href={`/projects/${projectId}/domains/create`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Domain
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => (
            <Link key={domain.id} href={`/projects/${projectId}/domains/${domain.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{domain.hostname}</h3>
                          <span className="text-gray-500">
                            {domain.tlsMode !== 'no_tls' ? `:${domain.httpsPort}` : `:${domain.httpPort}`}
                          </span>
                          {getStatusBadge(domain.status)}
                          {domain.namespace && domain.namespace !== 'fastgateway-system' && (
                            <Badge variant="info">{domain.namespace}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{domain.name}</p>
                        {domain.labels && Object.keys(domain.labels).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(domain.labels).map(([key, value]) => (
                              <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                {key}{value ? `=${value}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{domain.routeCount} routes</p>
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
