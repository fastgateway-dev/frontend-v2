'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { certificatesApi, projectsApi, permissionsApi } from '@/lib/api';
import { hasCertPerm, certStatusBadge, distStatusBadge } from '@/lib/utils/certificates';
import type { EnrichedCertificate, Project, ProjectPermissions } from '@/types';

export default function CertificatesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [certificates, setCertificates] = useState<EnrichedCertificate[]>([]);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, certificatesData, permsData] = await Promise.all([
        projectsApi.get(projectId),
        certificatesApi.list(projectId),
        permissionsApi.getProjectPermissions(projectId),
      ]);
      setProject(projectData);
      setCertificates(certificatesData);
      setPermissions(permsData);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load certificates');
    } finally {
      setIsLoading(false);
    }
  };

  const canCreate = hasCertPerm(permissions, 'certificate.create');

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
          <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
          <p className="text-gray-600 mt-1">{project?.name}</p>
        </div>
        {canCreate && (
          <Link href={`/projects/${projectId}/certificates/create`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Certificate
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates yet.</h3>
            <p className="text-gray-600 mb-4">
              {canCreate
                ? 'Create your first managed certificate to secure traffic for this project.'
                : 'No certificates have been created for this project yet.'}
            </p>
            {canCreate && (
              <Link href={`/projects/${projectId}/certificates/create`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Certificate
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => {
            const statusSpec = certStatusBadge(cert.status);
            const distSpec = cert.distribution ? distStatusBadge(cert.distribution.status) : null;
            const domainCount = cert.domains?.length ?? 0;
            const domainsLabel =
              domainCount === 0
                ? 'No domains attached'
                : domainCount === 1
                ? cert.domains[0].hostname
                : `${domainCount} domains`;
            return (
              <Link key={cert.id} href={`/projects/${projectId}/certificates/${cert.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                          <ShieldCheck className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{cert.name}</h3>
                            <Badge variant="info">{cert.usage === 'server' ? 'Server' : 'Client'}</Badge>
                          </div>
                          <p className="text-sm text-gray-500">Issuer: {cert.issuerName || cert.issuerId}</p>
                          <p className="text-xs text-gray-500" title={cert.domains?.map((d) => d.hostname).join(', ')}>
                            {domainsLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={statusSpec.variant} title={cert.statusMessage}>
                            {statusSpec.label}
                          </Badge>
                          {distSpec ? (
                            <Badge variant={distSpec.variant} title={cert.distribution?.message}>
                              {distSpec.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {cert.notAfter ? `Expires ${new Date(cert.notAfter).toLocaleDateString()}` : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
