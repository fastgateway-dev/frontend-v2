'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, Eye, Shield } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { clientAttachmentsApi } from '@/lib/api';
import type { Approval } from '@/types';

export default function ClientApprovalsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApprovals();
  }, [projectId]);

  const loadApprovals = async () => {
    try {
      const data = await clientAttachmentsApi.listApprovals(projectId, 1, 50, 'pending');
      setApprovals(data.data);
    } catch (error) {
      console.error('Failed to load client approvals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'attach':
        return <Badge variant="success">ATTACH</Badge>;
      case 'update':
        return <Badge variant="warning">UPDATE</Badge>;
      case 'detach':
        return <Badge variant="error">DETACH</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="error">Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning">Pending</Badge>;
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
          <h1 className="text-2xl font-bold text-gray-900">Client Attachment Approvals</h1>
          <p className="text-gray-600 mt-1">
            {approvals.length} {approvals.length === 1 ? 'request' : 'requests'} pending
          </p>
        </div>
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">No pending client attachment approvals at the moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <Card key={approval.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getActionBadge(approval.action)}
                        <h3 className="font-semibold text-gray-900">
                          {approval.entityName || 'Client Attachment'}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500">
                        Submitted by {approval.submitter?.username || 'Unknown'} &middot;{' '}
                        {new Date(approval.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {approval.stages && approval.stages.length > 0 ? (
                          approval.stages.map((stage, index) => (
                            <span key={stage.id} className="text-xs text-gray-400 flex items-center gap-1">
                              Stage {index + 1}: {getStatusBadge(stage.status)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">
                            Overall: {getStatusBadge(approval.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href={`/projects/${projectId}/client-approvals/${approval.id}`}>
                    <Button>
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
