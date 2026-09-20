'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Clock, RefreshCw, Trash2, Download, Lock } from 'lucide-react';
import { Button, Card, CardHeader, CardContent, Badge } from '@/components/ui';
import { certificatesApi, permissionsApi } from '@/lib/api';
import { hasCertPerm, certStatusBadge, distStatusBadge } from '@/lib/utils/certificates';
import { cn } from '@/lib/utils/cn';
import type { ManagedCertificate, CertificateDistribution, ProjectPermissions, CertificateIssuer } from '@/types';

const POLL_INTERVAL_MS = 4000;

function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
}

export default function CertificateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const certificateId = params.certificateId as string;

  const [cert, setCert] = useState<ManagedCertificate | null>(null);
  const [distribution, setDistribution] = useState<CertificateDistribution | null>(null);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [issuerNamesById, setIssuerNamesById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRequestingExport, setIsRequestingExport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportRequested, setExportRequested] = useState(false);

  const loadDistribution = useCallback(async () => {
    try {
      const dist = await certificatesApi.getDistribution(projectId, certificateId);
      setDistribution(dist);
    } catch {
      // Not yet distributed (e.g. 404) — treat as "not distributed yet".
      setDistribution(null);
    }
  }, [projectId, certificateId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [certData, permsData, issuersData] = await Promise.all([
        certificatesApi.get(projectId, certificateId),
        permissionsApi.getProjectPermissions(projectId),
        certificatesApi.issuersForProject(projectId).catch((): CertificateIssuer[] => []),
      ]);
      setCert(certData);
      setPermissions(permsData);
      setIssuerNamesById(
        Object.fromEntries(issuersData.map((issuer) => [issuer.id, issuer.name]))
      );
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to load certificate'));
    } finally {
      setIsLoading(false);
    }
    await loadDistribution();
  }, [projectId, certificateId, loadDistribution]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshCert = useCallback(async () => {
    try {
      const certData = await certificatesApi.get(projectId, certificateId);
      setCert(certData);
    } catch (err) {
      console.error('Failed to refresh certificate:', err);
    }
  }, [projectId, certificateId]);

  // Light polling of certificate status while transitional (pending/issuing),
  // and of the certificate itself while a locally-requested export is still awaiting approval.
  const isTransitional = cert ? (cert.status === 'pending' || cert.status === 'issuing') : false;
  const isExportPending = exportRequested && !cert?.exportAvailable;

  useEffect(() => {
    if (!isTransitional && !isExportPending) return;

    let cancelled = false;
    let inFlight = false;

    const intervalId = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        if (isTransitional) {
          const statusData = await certificatesApi.getStatus(projectId, certificateId);
          if (cancelled) return;
          setCert((prev) => prev ? {
            ...prev,
            status: statusData.status,
            notAfter: statusData.notAfter ?? prev.notAfter,
            statusMessage: statusData.message ?? prev.statusMessage,
          } : prev);
        }
        if (isExportPending) {
          const certData = await certificatesApi.get(projectId, certificateId);
          if (cancelled) return;
          setCert((prev) => prev ? {
            ...prev,
            exportAvailable: certData.exportAvailable,
          } : prev);
        }
      } catch (err) {
        console.error('Failed to poll certificate status:', err);
      } finally {
        inFlight = false;
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isTransitional, isExportPending, projectId, certificateId]);

  const handleResync = async () => {
    setIsResyncing(true);
    setActionError(null);
    try {
      await certificatesApi.resync(projectId, certificateId);
      await loadDistribution();
    } catch (err: unknown) {
      setActionError(extractErrorMessage(err, 'Failed to resync certificate'));
    } finally {
      setIsResyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!cert) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await certificatesApi.delete(projectId, certificateId);
      router.push(`/projects/${projectId}/certificates`);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      const fallback = e.response?.status === 409
        ? 'This certificate is referenced by a domain or client and cannot be deleted.'
        : 'Failed to delete certificate';
      setActionError(e.response?.data?.error || fallback);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadExport = async () => {
    if (!cert) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await certificatesApi.downloadExport(projectId, certificateId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cert.name}.pem`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      if (e.response?.status === 410) {
        setExportError('That export was already used or expired — request a new one.');
        await refreshCert();
      } else {
        setExportError(e.response?.data?.error || 'Failed to download export');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleRequestExport = async () => {
    setIsRequestingExport(true);
    setExportError(null);
    try {
      await certificatesApi.requestExport(projectId, certificateId);
      setExportRequested(true);
      await refreshCert();
    } catch (err: unknown) {
      setExportError(extractErrorMessage(err, 'Failed to request export'));
    } finally {
      setIsRequestingExport(false);
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

  if (!cert) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Certificate not found</h2>
          {error && <p className="mt-2 text-sm text-gray-600">{error}</p>}
          <Link href={`/projects/${projectId}/certificates`}>
            <Button className="mt-4">Back to Certificates</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusSpec = certStatusBadge(cert.status);
  const distSpec = distribution ? distStatusBadge(distribution.status) : null;
  const canResync = hasCertPerm(permissions, 'certificate.edit');
  const canDelete = hasCertPerm(permissions, 'certificate.delete');
  const canExport = hasCertPerm(permissions, 'certificate.edit');
  const showExportSection = cert.usage === 'client' && cert.status === 'ready';

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href={`/projects/${projectId}/certificates`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Certificates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{cert.name}</h1>
            <Badge variant={statusSpec.variant}>{statusSpec.label}</Badge>
          </div>
          <p className="text-sm text-gray-500">{cert.usage === 'server' ? 'Server' : 'Client'} certificate</p>
        </div>
        {canDelete && (
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
      </div>

      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>{actionError}</div>
        </div>
      )}

      {/* Pending Approval Banner */}
      {cert.status === 'pending' && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-yellow-800">
                <Clock className="h-5 w-5" />
                <span className="font-medium">This certificate is awaiting approval.</span>
              </div>
              <Link href={`/projects/${projectId}/approvals`} className="text-sm font-medium text-yellow-800 underline hover:no-underline whitespace-nowrap">
                View Approvals
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Message Banner */}
      {cert.statusMessage && (
        <div
          className={cn(
            'mb-6 p-4 rounded-lg border',
            cert.status === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-gray-50 border-gray-200 text-gray-700'
          )}
        >
          {cert.statusMessage}
        </div>
      )}

      {/* Facts Card */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Details</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usage</label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900">{cert.usage === 'server' ? 'Server' : 'Client'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issuer</label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900">{issuerNamesById[cert.issuerId] || cert.issuerId}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Mode</label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900">
                  {cert.keyMode === 'csr' ? 'CSR (bring your own key)' : cert.keyMode === 'managed' ? 'Managed' : '—'}
                </span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Hostnames</label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900">{cert.dnsNames && cert.dnsNames.length > 0 ? cert.dnsNames.join(', ') : '—'}</span>
              </div>
            </div>
            {cert.usage === 'client' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-900">{cert.subject || '—'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URI SANs</label>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-900">{cert.uriSans && cert.uriSans.length > 0 ? cert.uriSans.join(', ') : '—'}</span>
                  </div>
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fingerprint</label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900 font-mono text-sm">{cert.fingerprint || '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900">{cert.notAfter ? new Date(cert.notAfter).toLocaleString() : '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900">{new Date(cert.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Section */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Distribution</h2>
          {canResync && (
            <Button variant="secondary" size="sm" onClick={handleResync} isLoading={isResyncing}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Resync now
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {distribution ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {distSpec && <Badge variant={distSpec.variant}>{distSpec.label}</Badge>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Synced</label>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-900">{distribution.lastSyncedAt ? new Date(distribution.lastSyncedAt).toLocaleString() : '—'}</span>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Pushed Fingerprint</label>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-900 font-mono text-sm">{distribution.lastPushedFingerprint || '—'}</span>
                </div>
              </div>
              {distribution.message && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-900">{distribution.message}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">Not distributed yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      {showExportSection && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Export</h2>
          </CardHeader>
          <CardContent>
            {exportError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>{exportError}</div>
              </div>
            )}
            {cert.keyMode === 'csr' ? (
              <p className="text-gray-500 flex items-center gap-2">
                <Lock className="h-4 w-4 flex-shrink-0" />
                You hold the private key (CSR mode). No export is available.
              </p>
            ) : !canExport ? (
              <p className="text-gray-500 italic">You don&apos;t have permission to export this certificate.</p>
            ) : cert.exportAvailable ? (
              <Button onClick={handleDownloadExport} isLoading={isExporting}>
                <Download className="h-4 w-4 mr-1" />
                Download bundle
              </Button>
            ) : exportRequested ? (
              <div className="flex items-center justify-between gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Export requested — pending approval.</span>
                </div>
                <Link href={`/projects/${projectId}/approvals`} className="text-sm font-medium text-yellow-800 underline hover:no-underline whitespace-nowrap">
                  View Approvals
                </Link>
              </div>
            ) : (
              <Button onClick={handleRequestExport} isLoading={isRequestingExport}>
                Request export
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Certificate</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete the certificate <strong>{cert.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
                  Delete Certificate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
