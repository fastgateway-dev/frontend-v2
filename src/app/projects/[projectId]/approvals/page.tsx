'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, Eye, Route, Shield, Lock, XCircle, MinusCircle } from 'lucide-react';
import { Button, Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Select } from '@/components/ui';
import { approvalsApi, clientAttachmentsApi } from '@/lib/api';
import type { ApprovalRequest, Approval, ApprovalStatus, ApprovalStage } from '@/types';

// Unified approval item for display
interface UnifiedApproval {
  id: string;
  entityType: 'route' | 'client_attachment' | 'certificate';
  entityName: string;
  domainName?: string;
  action: string;
  status: ApprovalStatus;
  submitter?: { id: string; username: string };
  stages?: Array<{
    id: string;
    order: number;
    status: ApprovalStatus;
    requiredPermission: string;
    reviewer?: { id: string; username: string };
    reviewedAt?: string;
    comment?: string;
  }>;
  createdAt: string;
  // For navigation
  detailUrl: string;
}

export default function ApprovalsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [approvals, setApprovals] = useState<UnifiedApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'route' | 'client' | 'certificate'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadApprovals();
  }, [projectId, statusFilter]);

  const loadApprovals = async () => {
    try {
      setIsLoading(true);

      // Fetch from both endpoints in parallel
      const [routeApprovalsRes, clientApprovalsRes] = await Promise.all([
        approvalsApi.list(projectId, 1, 50, statusFilter).catch(() => ({ data: [] })),
        clientAttachmentsApi.listApprovals(projectId, 1, 50, statusFilter).catch(() => ({ data: [] })),
      ]);

      // Convert route/certificate approvals to unified format
      // Note: approvalsApi.list has no entityType filter — it returns BOTH route and
      // certificate approvals from the shared approval engine, so honor each row's own
      // entityType instead of assuming 'route'.
      const routeApprovals: UnifiedApproval[] = (routeApprovalsRes.data || []).map((r: ApprovalRequest) => {
        const entityType = r.entityType ?? 'route';
        const entityName = entityType === 'certificate'
          ? (r.entityName || 'Certificate')
          : (r.entityName || r.configSnapshot?.matches?.[0]?.path?.value || r.route?.name || 'Route');
        return {
          id: r.id,
          entityType,
          entityName,
          domainName: r.domainName,
          action: r.action,
          status: r.status,
          submitter: r.submitter ? { id: r.submittedBy, username: r.submitter.username } : undefined,
          stages: r.stages?.map((s: ApprovalStage) => ({
            id: s.id,
            order: s.order,
            status: s.status,
            requiredPermission: s.requiredPermission,
            reviewer: s.reviewer ? { id: s.reviewedBy || '', username: s.reviewer.username } : undefined,
            reviewedAt: s.reviewedAt,
            comment: s.comment,
          })),
          createdAt: r.createdAt,
          detailUrl: `/projects/${projectId}/approvals/${r.id}`,
        };
      });

      // Convert client approvals to unified format
      const clientApprovals: UnifiedApproval[] = (clientApprovalsRes.data || []).map((c: Approval) => ({
        id: c.id,
        entityType: 'client_attachment' as const,
        entityName: c.entityName || 'Client Attachment',
        domainName: c.domainName,
        action: c.action,
        status: c.status,
        submitter: c.submitter ? { id: c.submittedBy, username: c.submitter.username } : undefined,
        stages: c.stages?.map(s => ({
          id: s.id,
          order: s.order,
          status: s.status,
          requiredPermission: s.requiredPermission,
          reviewer: s.reviewer ? { id: s.reviewedBy || '', username: s.reviewer.username } : undefined,
          reviewedAt: s.reviewedAt,
          comment: s.comment,
        })),
        createdAt: c.createdAt,
        detailUrl: `/projects/${projectId}/client-approvals/${c.id}`,
      }));

      // Merge and sort by createdAt (newest first)
      const merged = [...routeApprovals, ...clientApprovals].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setApprovals(merged);
    } catch (error) {
      console.error('Failed to load approvals:', error);
    } finally {
      setIsLoading(false);
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
      case 'attach':
        return <Badge variant="success">ATTACH</Badge>;
      case 'detach':
        return <Badge variant="error">DETACH</Badge>;
      default:
        return <Badge>{action.toUpperCase()}</Badge>;
    }
  };

  const getEntityTypeBadge = (entityType: 'route' | 'client_attachment' | 'certificate') => {
    if (entityType === 'route') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
          <Route className="h-3 w-3" />
          Route
        </span>
      );
    }
    if (entityType === 'certificate') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
          <Lock className="h-3 w-3" />
          Certificate
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
        <Shield className="h-3 w-3" />
        Client
      </span>
    );
  };

  const getStatusIcon = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return (
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
        );
      case 'rejected':
        return (
          <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
        );
      case 'cancelled':
        return (
          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <MinusCircle className="h-5 w-5 text-gray-500" />
          </div>
        );
      default:
        return (
          <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
        );
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">APPROVED</Badge>;
      case 'rejected':
        return <Badge variant="error">REJECTED</Badge>;
      case 'cancelled':
        return <Badge variant="default">CANCELLED</Badge>;
      default:
        return <Badge variant="warning">PENDING</Badge>;
    }
  };

  const getReviewerInfo = (stages?: UnifiedApproval['stages']) => {
    if (!stages || stages.length === 0) return null;
    const reviewedStages = stages.filter(s => s.reviewer && s.reviewedAt);
    if (reviewedStages.length === 0) return null;
    const lastReviewed = reviewedStages[reviewedStages.length - 1];
    return (
      <p className="text-sm text-gray-500">
        Reviewed by {lastReviewed.reviewer?.username} &middot;{' '}
        {new Date(lastReviewed.reviewedAt!).toLocaleDateString()}
        {lastReviewed.comment && (
          <span className="text-gray-400 italic ml-1">&mdash; &ldquo;{lastReviewed.comment}&rdquo;</span>
        )}
      </p>
    );
  };

  const getStagesBadges = (stages?: UnifiedApproval['stages']) => {
    if (!stages || stages.length === 0) return null;
    return (
      <div className="flex items-center gap-2 mt-1">
        {stages.map((stage, index) => (
          <span key={stage.id} className="text-xs text-gray-500">
            Stage {index + 1}:{' '}
            <span className={
              stage.status === 'approved' ? 'text-green-600' :
              stage.status === 'rejected' ? 'text-red-600' :
              stage.status === 'cancelled' ? 'text-gray-400' :
              'text-yellow-600'
            }>
              {stage.status}
            </span>
          </span>
        ))}
      </div>
    );
  };

  // Filter approvals based on active tab
  const filteredApprovals = approvals.filter(a => {
    if (activeTab === 'all') return true;
    if (activeTab === 'route') return a.entityType === 'route';
    if (activeTab === 'client') return a.entityType === 'client_attachment';
    if (activeTab === 'certificate') return a.entityType === 'certificate';
    return true;
  });

  const routeCount = approvals.filter(a => a.entityType === 'route').length;
  const clientCount = approvals.filter(a => a.entityType === 'client_attachment').length;
  const certificateCount = approvals.filter(a => a.entityType === 'certificate').length;

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
          <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
          <p className="text-gray-600 mt-1">
            {filteredApprovals.length} {filteredApprovals.length === 1 ? 'approval' : 'approvals'}
            {statusFilter ? ` (${statusFilter})` : ''}
          </p>
        </div>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'route' | 'client' | 'certificate')}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            All ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="route">
            Routes ({routeCount})
          </TabsTrigger>
          <TabsTrigger value="client">
            Clients ({clientCount})
          </TabsTrigger>
          <TabsTrigger value="certificate">
            Certificates ({certificateCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No approvals found</h3>
                <p className="text-gray-600">
                  {statusFilter
                    ? `No ${statusFilter} approvals`
                    : 'No approvals at the moment'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredApprovals.map((approval) => (
                <Card key={`${approval.entityType}-${approval.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(approval.status)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {getEntityTypeBadge(approval.entityType)}
                            {getActionBadge(approval.action)}
                            {getStatusBadge(approval.status)}
                            <h3 className="font-semibold text-gray-900">
                              {approval.entityName}
                            </h3>
                          </div>
                          {approval.domainName && (
                            <p className="text-sm text-gray-600 mb-0.5">
                              {approval.domainName}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">
                            Submitted by {approval.submitter?.username || 'Unknown'} &middot;{' '}
                            {new Date(approval.createdAt).toLocaleDateString()}
                          </p>
                          {getReviewerInfo(approval.stages)}
                          {approval.status === 'pending' && getStagesBadges(approval.stages)}
                        </div>
                      </div>
                      <Link href={approval.detailUrl}>
                        <Button variant={approval.status === 'pending' ? 'primary' : 'secondary'}>
                          <Eye className="h-4 w-4 mr-2" />
                          {approval.status === 'pending' ? 'Review' : 'View'}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
