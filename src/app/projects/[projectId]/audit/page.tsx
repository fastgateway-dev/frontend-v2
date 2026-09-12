'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Download, Trash2, ArrowRight } from 'lucide-react';
import { Card, CardContent, Badge, Button, Modal, Input } from '@/components/ui';
import { auditApi } from '@/lib/api';
import type { AuditLog } from '@/types';

export default function AuditLogPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('90');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    loadLogs(page);
  }, [page]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await auditApi.list(projectId, 1, pageSize);
      setLogs(data.data);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async (p: number) => {
    try {
      const data = await auditApi.list(projectId, p, pageSize);
      setLogs(data.data);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const blob = await auditApi.export(projectId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `audit-log-${projectId}-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCleanup = async () => {
    const days = parseInt(cleanupDays, 10);
    if (isNaN(days) || days < 1) return;

    setIsCleaning(true);
    setCleanupResult(null);
    try {
      const result = await auditApi.cleanup(projectId, days);
      setCleanupResult(result.message);
      setPage(1);
      loadLogs(1);
    } catch (error) {
      console.error('Failed to cleanup audit logs:', error);
      setCleanupResult('Failed to cleanup audit logs.');
    } finally {
      setIsCleaning(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <Badge variant="success">CREATE</Badge>;
      case 'update':
        return <Badge variant="warning">UPDATE</Badge>;
      case 'delete':
        return <Badge variant="error">DELETE</Badge>;
      case 'approve':
        return <Badge variant="success">APPROVED</Badge>;
      case 'reject':
        return <Badge variant="error">REJECTED</Badge>;
      default:
        return <Badge>{action.toUpperCase()}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
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
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-600 mt-1">Track all changes and actions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            onClick={() => {
              setCleanupResult(null);
              setCleanupDays('90');
              setShowCleanupModal(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Cleanup
          </Button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting || logs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs yet</h3>
            <p className="text-gray-600">Actions will be logged here</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getActionBadge(log.action)}
                      <div>
                        <p className="font-medium text-gray-900">
                          {log.resourceType} {log.resourceName && `"${log.resourceName}"`}
                          {log.details?.domainName ? (
                            <span className="text-sm font-normal text-gray-500 ml-1">
                              ({String(log.details.domainName)})
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-gray-500">
                          by {log.username} · {formatDate(log.createdAt)}
                        </p>
                      </div>
                    </div>
                    {log.details?.approvalId ? (
                      <Link
                        href={
                          log.details.approvalEntityType === 'client_attachment'
                            ? `/projects/${projectId}/client-approvals/${String(log.details.approvalId)}`
                            : `/projects/${projectId}/approvals/${String(log.details.approvalId)}`
                        }
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                      >
                        View Approval
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} logs
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={showCleanupModal}
        onClose={() => {
          setShowCleanupModal(false);
          setCleanupResult(null);
        }}
        title="Cleanup Audit Logs"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This will permanently delete audit logs older than the specified number of days.
            This action cannot be undone.
          </p>

          <Input
            label="Delete logs older than (days)"
            type="number"
            min={1}
            value={cleanupDays}
            onChange={(e) => setCleanupDays(e.target.value)}
          />

          {cleanupResult && (
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{cleanupResult}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCleanupModal(false);
                setCleanupResult(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCleanup}
              disabled={isCleaning || !cleanupDays || parseInt(cleanupDays, 10) < 1}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCleaning ? 'Deleting...' : 'Delete Old Logs'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
