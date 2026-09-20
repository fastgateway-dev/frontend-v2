'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, Badge, Select } from '@/components/ui';
import { certificatesApi, projectsApi } from '@/lib/api';
import { certStatusBadge, distStatusBadge } from '@/lib/utils/certificates';
import type { EnrichedCertificate } from '@/types';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'issuing', label: 'Issuing' },
  { value: 'ready', label: 'Ready' },
  { value: 'error', label: 'Error' },
];

const USAGE_OPTIONS = [
  { value: '', label: 'All usages' },
  { value: 'server', label: 'Server' },
  { value: 'client', label: 'Client' },
];

export default function CertificateFleetPage() {
  const [certificates, setCertificates] = useState<EnrichedCertificate[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [usage, setUsage] = useState('');

  const loadData = useCallback(async (filters: { status?: string; usage?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: { status?: string; usage?: string } = {};
      if (filters.status) params.status = filters.status;
      if (filters.usage) params.usage = filters.usage;

      const [certificatesData, projectsData] = await Promise.all([
        certificatesApi.fleet(params),
        projectsApi.list(1, 1000),
      ]);
      setCertificates(certificatesData || []);
      const names: Record<string, string> = {};
      for (const project of projectsData.data) {
        names[project.id] = project.name;
      }
      setProjectNames(names);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load certificates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData({ status, usage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, usage]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Certificates</h1>
          <p className="text-gray-600 mt-1">Managed certificates across every project</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6 max-w-md">
        <Select
          id="status-filter"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={STATUS_OPTIONS}
        />
        <Select
          id="usage-filter"
          label="Usage"
          value={usage}
          onChange={(e) => setUsage(e.target.value)}
          options={USAGE_OPTIONS}
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg" />
          <div className="h-32 bg-gray-200 rounded-lg" />
        </div>
      ) : certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates found</h3>
            <p className="text-gray-600">
              No managed certificates match the selected filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => {
            const statusSpec = certStatusBadge(cert.status);
            const distSpec = cert.distribution ? distStatusBadge(cert.distribution.status) : null;
            const projectName = projectNames[cert.projectId] || cert.projectId;
            return (
              <Link key={cert.id} href={`/projects/${cert.projectId}/certificates/${cert.id}`}>
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
                          <p className="text-sm text-gray-500">Project: {projectName}</p>
                          <p className="text-xs text-gray-500">Issuer: {cert.issuerName || cert.issuerId}</p>
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
