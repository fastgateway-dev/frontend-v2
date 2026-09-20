'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Lock, Info, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal } from '@/components/ui';
import { certificateIssuersApi } from '@/lib/api/certificate-issuers';
import { issuerStatusBadge } from '@/lib/utils/certificates';
import type { CertificateIssuer, IssuerType } from '@/types';

function typeLabel(type: IssuerType): string {
  return type === 'self_signed_ca' ? 'Self-signed CA' : 'ACME';
}

export default function CertificateIssuersPage() {
  const [issuers, setIssuers] = useState<CertificateIssuer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const [issuerToDelete, setIssuerToDelete] = useState<CertificateIssuer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteErrorIssuerId, setDeleteErrorIssuerId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const data = await certificateIssuersApi.list();
      setIssuers(data || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setUnavailable(true);
      } else {
        setError(err.response?.data?.error || 'Failed to load certificate issuers');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!issuerToDelete) return;
    const targetId = issuerToDelete.id;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await certificateIssuersApi.delete(targetId);
      setIssuerToDelete(null);
      await loadData();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setDeleteError(err.response?.data?.error || 'This issuer is in use by a certificate and cannot be deleted');
      } else {
        setDeleteError(err.response?.data?.error || 'Failed to delete certificate issuer');
      }
      setDeleteErrorIssuerId(targetId);
      setIssuerToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificate Issuers</h1>
          <p className="text-gray-600 mt-1">
            Manage certificate issuers used to sign TLS certificates for your projects
          </p>
        </div>
        {!unavailable && (
          <Link href="/certificate-issuers/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Issuer
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg" />
          <div className="h-32 bg-gray-200 rounded-lg" />
        </div>
      ) : unavailable ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Certificate issuers unavailable</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Certificate issuers require FastGateway running in-cluster with cert-manager.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {issuers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No certificate issuers yet</h3>
                <p className="text-gray-600 mb-4">
                  Create a certificate issuer to start issuing TLS certificates for your projects.
                </p>
                <Link href="/certificate-issuers/create">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Issuer
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {issuers.map((issuer) => {
                const statusSpec = issuerStatusBadge(issuer.status);
                return (
                  <Link key={issuer.id} href={`/certificate-issuers/${issuer.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                              <Lock className="h-5 w-5 text-primary-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{issuer.name}</h3>
                                <Badge variant="info">{typeLabel(issuer.type)}</Badge>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Created {new Date(issuer.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={statusSpec.variant} title={issuer.statusMessage}>
                                {statusSpec.label}
                              </Badge>
                              {issuer.statusMessage && (
                                <p className="text-xs text-gray-500 max-w-xs truncate" title={issuer.statusMessage}>
                                  {issuer.statusMessage}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteError(null);
                                setDeleteErrorIssuerId(null);
                                setIssuerToDelete(issuer);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        {deleteErrorIssuerId === issuer.id && deleteError && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                            {deleteError}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal isOpen={!!issuerToDelete} onClose={() => setIssuerToDelete(null)} title="Delete Certificate Issuer">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{issuerToDelete?.name}</span>? This
            action cannot be undone.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIssuerToDelete(null)}>
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
