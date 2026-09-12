'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { clientAttachmentsApi } from '@/lib/api';
import type { Approval, ApprovalStage } from '@/types';

export default function ClientApprovalReviewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const approvalId = params.approvalId as string;

  const [approval, setApproval] = useState<Approval | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectComment, setRejectComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApproval();
  }, [projectId, approvalId]);

  const loadApproval = async () => {
    try {
      const data = await clientAttachmentsApi.getApproval(projectId, approvalId);
      setApproval(data);
    } catch (error: any) {
      console.error('Failed to load approval:', error);
      setError(error.response?.data?.error || 'Failed to load approval');
    } finally {
      setIsLoading(false);
    }
  };

  // Find the current actionable stage: the first pending stage where all previous stages are approved
  const getCurrentActionableStage = (): ApprovalStage | null => {
    if (!approval || !approval.stages || approval.stages.length === 0) return null;

    const sortedStages = [...approval.stages].sort((a, b) => a.order - b.order);

    for (const stage of sortedStages) {
      if (stage.status === 'pending') {
        // Check if all previous stages are approved
        const previousStages = sortedStages.filter((s) => s.order < stage.order);
        const allPreviousApproved = previousStages.every((s) => s.status === 'approved');
        if (allPreviousApproved) {
          return stage;
        }
        // If previous stages are not all approved, no actionable stage
        return null;
      }
    }
    return null;
  };

  const handleApproveStage = async (stageId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await clientAttachmentsApi.approveStage(projectId, approvalId, stageId);
      await loadApproval();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to approve stage');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectStage = async (stageId: string) => {
    if (!rejectComment.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await clientAttachmentsApi.rejectStage(projectId, approvalId, stageId, rejectComment);
      router.push(`/projects/${projectId}/client-approvals`);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to reject stage');
    } finally {
      setIsSubmitting(false);
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

  const getStageStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="error"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Approval not found</h2>
          <Link href={`/projects/${projectId}/client-approvals`}>
            <Button className="mt-4">Back to Client Approvals</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isPending = approval.status === 'pending';
  const actionableStage = getCurrentActionableStage();
  const configSnapshot = approval.configSnapshot as Record<string, boolean> | undefined;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href={`/projects/${projectId}/client-approvals`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Client Approvals
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Client Attachment Review</h1>
            {getActionBadge(approval.action)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Submitted by {approval.submitter?.username || 'Unknown'} on{' '}
            {new Date(approval.createdAt).toLocaleString()}
          </p>
          {approval.entityName && (
            <p className="text-sm text-gray-600 mt-1">
              {approval.entityName}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Attachment Details from config snapshot */}
      {configSnapshot && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attachment Details</h2>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Security Features</label>
              <div className="flex gap-2">
                {configSnapshot.enableIpAllowlist && (
                  <Badge variant="info">
                    <Shield className="h-3 w-3 mr-1" />
                    IP Allowlist
                  </Badge>
                )}
                {configSnapshot.enableApiKey && (
                  <Badge variant="info">API Key</Badge>
                )}
                {configSnapshot.enableJwt && (
                  <Badge variant="info">JWT</Badge>
                )}
                {configSnapshot.enableBasicAuth && (
                  <Badge variant="info">Basic Auth</Badge>
                )}
                {configSnapshot.enableMtls && (
                  <Badge variant="info">mTLS</Badge>
                )}
                {!configSnapshot.enableIpAllowlist && !configSnapshot.enableApiKey &&
                 !configSnapshot.enableJwt && !configSnapshot.enableBasicAuth &&
                 !configSnapshot.enableMtls && (
                  <span className="text-sm text-gray-400">No security features enabled</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Stages */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Stages</h2>
          {approval.stages && approval.stages.length > 0 ? (
            <div className="space-y-4">
              {[...approval.stages]
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <div key={stage.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">
                          Stage {stage.order}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Required permission: <span className="font-medium">{stage.requiredPermission}</span>
                          {stage.requiredTeamName && (
                            <> &middot; Team: <span className="font-medium">{stage.requiredTeamName}</span></>
                          )}
                        </p>
                      </div>
                      {getStageStatusBadge(stage.status)}
                    </div>
                    {stage.reviewer && (
                      <p className="text-sm text-gray-600">
                        Reviewed by {stage.reviewer.username}
                      </p>
                    )}
                    {stage.reviewedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(stage.reviewedAt).toLocaleString()}
                      </p>
                    )}
                    {stage.comment && (
                      <p className="text-sm text-red-600 mt-2">
                        Comment: {stage.comment}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No approval stages configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions - only show if overall status is pending and there is an actionable stage */}
      {isPending && actionableStage && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="p-4 border border-primary-200 rounded-lg bg-primary-50">
                <h3 className="text-sm font-semibold text-primary-800 mb-2">
                  Approve Stage {actionableStage.order}
                </h3>
                <p className="text-sm text-primary-700 mb-1">
                  Required permission: <span className="font-medium">{actionableStage.requiredPermission}</span>
                </p>
                {actionableStage.requiredTeamName && (
                  <p className="text-sm text-primary-700 mb-3">
                    Required team: <span className="font-medium">{actionableStage.requiredTeamName}</span>
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleApproveStage(actionableStage.id)}
                    isLoading={isSubmitting}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleRejectStage(actionableStage.id)}
                    disabled={!rejectComment.trim() || isSubmitting}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>

              {/* Rejection comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Comment (required for rejection)
                </label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Explain why this request is being rejected..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already fully resolved */}
      {!isPending && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              {approval.status === 'approved' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700">Fully Approved</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-700">Rejected</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
