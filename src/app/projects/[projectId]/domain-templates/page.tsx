'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Server, Globe, Network } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { domainTemplatesApi, projectsApi } from '@/lib/api';
import { hostnameListeners, streamListener, listenerLabel } from '@/lib/utils/gateway-listeners';
import type { DomainTemplate, Project, ExposureType } from '@/types';

export default function DomainTemplatesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [domainTemplates, setDomainTemplates] = useState<DomainTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projectData, templatesData] = await Promise.all([
        projectsApi.get(projectId),
        domainTemplatesApi.list(projectId),
      ]);
      setProject(projectData);
      setDomainTemplates(templatesData.data);
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

  const getExposureBadge = (exposureType: ExposureType) => {
    switch (exposureType) {
      case 'LoadBalancer':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            LoadBalancer
          </Badge>
        );
      case 'ClusterIP':
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <Network className="h-3 w-3" />
            ClusterIP
          </Badge>
        );
      default:
        return <Badge>{exposureType}</Badge>;
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
          <h1 className="text-2xl font-bold text-gray-900">Gateway Templates</h1>
          <p className="text-gray-600 mt-1">Manage gateway templates for {project?.name}</p>
        </div>
        <Link href={`/projects/${projectId}/domain-templates/create`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </Link>
      </div>

      {domainTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No gateway templates yet</h3>
            <p className="text-gray-600 mb-4">Create a gateway template to start configuring domains and streams</p>
            <Link href={`/projects/${projectId}/domain-templates/create`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {domainTemplates.map((template) => (
            <Link key={template.id} href={`/projects/${projectId}/domain-templates/${template.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Server className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        {getStatusBadge(template.status)}
                        {getExposureBadge(template.exposureType)}
                        {hostnameListeners(template.listeners ?? []).length > 0 && (
                          <Badge variant="success">Domain</Badge>
                        )}
                        {streamListener(template.listeners ?? []) && (
                          <Badge variant="info">Stream</Badge>
                        )}
                        {template.mergeGateways && (
                          <Badge variant="info" className="flex items-center gap-1">Merged</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        {(template.listeners ?? []).map((l) => (
                          <span key={l.name} className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                            {listenerLabel(l)}
                          </span>
                        ))}
                        {Object.keys(template.annotations || {}).length > 0 && (
                          <span>{Object.keys(template.annotations).length} annotation(s)</span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                      )}
                      {template.statusMessage && template.status === 'error' && (
                        <p className="text-sm text-red-500 mt-1">{template.statusMessage}</p>
                      )}
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
