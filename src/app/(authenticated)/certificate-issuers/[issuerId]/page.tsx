'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Trash2, Plus, X, FolderKanban } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Badge, Select, Modal } from '@/components/ui';
import { certificateIssuersApi } from '@/lib/api/certificate-issuers';
import { dnsCredentialsApi } from '@/lib/api/dns-credentials';
import { projectsApi } from '@/lib/api/projects';
import { issuerStatusBadge } from '@/lib/utils/certificates';
import type {
  CertificateIssuer,
  IssuerStatusResponse,
  IssuerProjectGrant,
  Project,
  DNSProviderCredential,
} from '@/types';

function typeLabel(type: CertificateIssuer['type']): string {
  return type === 'self_signed_ca' ? 'Self-signed CA' : 'ACME';
}

export default function CertificateIssuerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issuerId = params.issuerId as string;

  const [issuer, setIssuer] = useState<CertificateIssuer | null>(null);
  const [statusInfo, setStatusInfo] = useState<IssuerStatusResponse | null>(null);
  const [grants, setGrants] = useState<IssuerProjectGrant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dnsCredentials, setDnsCredentials] = useState<DNSProviderCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [grantProjectId, setGrantProjectId] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokingProjectId, setRevokingProjectId] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [issuerData, statusData, grantsData, projectsData, dnsData] = await Promise.all([
        certificateIssuersApi.get(issuerId),
        certificateIssuersApi.getStatus(issuerId).catch(() => null),
        certificateIssuersApi.listGrants(issuerId).catch(() => []),
        projectsApi.list(1, 100).catch(() => ({ data: [] as Project[], total: 0, page: 1, limit: 100, totalPages: 0 })),
        dnsCredentialsApi.list().catch(() => []),
      ]);
      setIssuer(issuerData);
      setStatusInfo(statusData);
      setGrants(grantsData || []);
      setProjects(projectsData.data || []);
      setDnsCredentials(dnsData || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load certificate issuer');
    } finally {
      setIsLoading(false);
    }
  }, [issuerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadGrants = async () => {
    try {
      const data = await certificateIssuersApi.listGrants(issuerId);
      setGrants(data || []);
    } catch {
      // keep previous grants on failure
    }
  };

  const projectName = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.name || projectId;

  const dnsCredentialName = (id?: string) => {
    if (!id) return undefined;
    return dnsCredentials.find((c) => c.id === id)?.name || id;
  };

  const grantableProjects = projects.filter((p) => !grants.some((g) => g.projectId === p.id));

  const handleGrant = async () => {
    if (!grantProjectId) return;
    setGrantError(null);
    setIsGranting(true);
    try {
      await certificateIssuersApi.grant(issuerId, grantProjectId);
      setGrantProjectId('');
      await loadGrants();
    } catch (err: any) {
      setGrantError(err.response?.data?.error || 'Failed to grant project access');
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevoke = async (projectId: string) => {
    setRevokeError(null);
    setRevokingProjectId(projectId);
    try {
      await certificateIssuersApi.revokeGrant(issuerId, projectId);
      await loadGrants();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setRevokeError(err.response?.data?.error || 'A certificate in that project still uses this issuer');
      } else {
        setRevokeError(err.response?.data?.error || 'Failed to revoke project access');
      }
    } finally {
      setRevokingProjectId(null);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await certificateIssuersApi.delete(issuerId);
      router.push('/certificate-issuers');
    } catch (err: any) {
      if (err.response?.status === 409) {
        setDeleteError(err.response?.data?.error || 'This issuer is in use by a certificate and cannot be deleted');
      } else {
        setDeleteError(err.response?.data?.error || 'Failed to delete certificate issuer');
      }
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error && !issuer) {
    return (
      <div className="p-8">
        <Link
          href="/certificate-issuers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Certificate Issuers
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      </div>
    );
  }

  if (!issuer) return null;

  const status = statusInfo?.status ?? issuer.status;
  const statusMessage = statusInfo?.statusMessage ?? issuer.statusMessage;
  const statusSpec = issuerStatusBadge(status);

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/certificate-issuers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Certificate Issuers
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{issuer.name}</h1>
                <Badge variant="info">{typeLabel(issuer.type)}</Badge>
                <Badge variant={statusSpec.variant}>{statusSpec.label}</Badge>
              </div>
              {statusMessage && <p className="text-sm text-gray-500 mt-1">{statusMessage}</p>}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Overview */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">{new Date(issuer.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Last Updated</dt>
              <dd className="text-sm text-gray-900">{new Date(issuer.updatedAt).toLocaleString()}</dd>
            </div>

            {issuer.type === 'self_signed_ca' ? (
              <>
                {issuer.config.commonName && (
                  <div>
                    <dt className="text-sm text-gray-500">Common Name</dt>
                    <dd className="text-sm text-gray-900">{issuer.config.commonName}</dd>
                  </div>
                )}
                {issuer.config.keyAlgorithm && (
                  <div>
                    <dt className="text-sm text-gray-500">Key Algorithm</dt>
                    <dd className="text-sm text-gray-900">{issuer.config.keyAlgorithm}</dd>
                  </div>
                )}
                {issuer.config.keySize && (
                  <div>
                    <dt className="text-sm text-gray-500">Key Size</dt>
                    <dd className="text-sm text-gray-900">{issuer.config.keySize}</dd>
                  </div>
                )}
                {issuer.config.durationDays && (
                  <div>
                    <dt className="text-sm text-gray-500">Duration</dt>
                    <dd className="text-sm text-gray-900">{issuer.config.durationDays} days</dd>
                  </div>
                )}
              </>
            ) : (
              <>
                {issuer.config.server && (
                  <div className="md:col-span-2">
                    <dt className="text-sm text-gray-500">ACME Server</dt>
                    <dd className="text-sm text-gray-900 break-all">{issuer.config.server}</dd>
                  </div>
                )}
                {issuer.config.email && (
                  <div>
                    <dt className="text-sm text-gray-500">Email</dt>
                    <dd className="text-sm text-gray-900">{issuer.config.email}</dd>
                  </div>
                )}
                {issuer.config.dnsCredentialId && (
                  <div>
                    <dt className="text-sm text-gray-500">DNS Credential</dt>
                    <dd className="text-sm text-gray-900">
                      {dnsCredentialName(issuer.config.dnsCredentialId)}
                    </dd>
                  </div>
                )}
                {issuer.config.clusterIssuerName && (
                  <div>
                    <dt className="text-sm text-gray-500">Cluster Issuer</dt>
                    <dd className="text-sm text-gray-900">{issuer.config.clusterIssuerName}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Grants */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Project Grants</h2>
          <p className="text-sm text-gray-500 mt-1">
            Projects that are allowed to issue certificates using this issuer
          </p>
        </CardHeader>
        <CardContent>
          {grantError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {grantError}
            </div>
          )}
          {revokeError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {revokeError}
            </div>
          )}

          {grants.length === 0 ? (
            <div className="text-center py-8">
              <FolderKanban className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No projects have been granted access to this issuer</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 mb-6">
              {grants.map((grant) => (
                <div key={grant.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{projectName(grant.projectId)}</p>
                    <p className="text-xs text-gray-400">
                      Granted {new Date(grant.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(grant.projectId)}
                    disabled={revokingProjectId === grant.projectId}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {revokingProjectId === grant.projectId ? 'Revoking...' : 'Revoke'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {grantableProjects.length > 0 ? (
            <div className="flex items-end gap-3 border-t border-gray-200 pt-4">
              <div className="flex-1">
                <Select
                  id="grant-project"
                  label="Grant Project Access"
                  value={grantProjectId}
                  onChange={(e) => setGrantProjectId(e.target.value)}
                  options={[
                    { value: '', label: 'Select a project...' },
                    ...grantableProjects.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>
              <Button onClick={handleGrant} isLoading={isGranting} disabled={!grantProjectId}>
                <Plus className="h-4 w-4 mr-1" />
                Grant
              </Button>
            </div>
          ) : (
            projects.length > 0 && (
              <p className="text-sm text-gray-500 border-t border-gray-200 pt-4">
                All available projects already have access to this issuer.
              </p>
            )
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        </CardHeader>
        <CardContent>
          {deleteError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {deleteError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete this issuer</p>
              <p className="text-sm text-gray-500">
                This cannot be undone. The issuer must not be in use by any certificate.
              </p>
            </div>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Issuer
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Certificate Issuer">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{issuer.name}</span>? This
            action cannot be undone.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Issuer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
