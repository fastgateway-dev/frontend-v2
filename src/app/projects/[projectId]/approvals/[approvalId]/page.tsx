'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Sparkles } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { approvalsApi, aiApi } from '@/lib/api';
import type { ApprovalRequest, ApprovalStage, AIReviewResult } from '@/types';
import { YamlDiffViewer } from '@/components/features/yaml-diff-viewer';
import { AIReviewCard } from '@/components/features/ai-review-card';
import { CommentFeed } from '@/components/features/comment-feed';

export default function ApprovalReviewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const approvalId = params.approvalId as string;

  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectComment, setRejectComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Diff state
  const [diffData, setDiffData] = useState<{
    action: string;
    currentYaml?: string;
    proposedYaml?: string;
    currentSecurityPolicyYaml?: string;
    proposedSecurityPolicyYaml?: string;
    currentBackendTrafficPolicyYaml?: string;
    proposedBackendTrafficPolicyYaml?: string;
    currentEnvoyExtensionPolicyYaml?: string;
    proposedEnvoyExtensionPolicyYaml?: string;
    currentBackendYaml?: string;
    proposedBackendYaml?: string;
    changeDescription?: string;
    aiReview?: AIReviewResult;
  } | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [isReviewingAI, setIsReviewingAI] = useState(false);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);

  useEffect(() => {
    loadApproval();
  }, [projectId, approvalId]);

  const loadApproval = async () => {
    try {
      const data = await approvalsApi.get(projectId, approvalId);

      // Redirect client attachment approvals to the correct page
      if (data.entityType === 'client_attachment') {
        router.replace(`/projects/${projectId}/client-approvals/${approvalId}`);
        return;
      }

      setApproval(data);

      // Load diff
      setIsLoadingDiff(true);
      try {
        const diff = await approvalsApi.getDiff(projectId, approvalId);
        setDiffData(diff);
      } catch (error: any) {
        console.error('Failed to load diff:', error);
        setDiffError(error.response?.data?.error || 'Failed to load diff');
      } finally {
        setIsLoadingDiff(false);
      }
    } catch (error: any) {
      console.error('Failed to load approval:', error);
      setError(error.response?.data?.error || 'Failed to load approval');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIReview = async () => {
    setIsReviewingAI(true);
    setAiReviewError(null);
    try {
      const result = await aiApi.reviewApproval(projectId, approvalId);
      setDiffData(prev => prev ? { ...prev, aiReview: result } : prev);
    } catch (err: any) {
      setAiReviewError(err.message || 'Failed to generate AI review');
    } finally {
      setIsReviewingAI(false);
    }
  };

  // Find the current actionable stage: the first pending stage where all previous stages are approved
  const getCurrentActionableStage = (): ApprovalStage | null => {
    if (!approval) return null;
    const stages = (approval as any).stages as ApprovalStage[] | undefined;
    if (!stages || stages.length === 0) return null;

    const sortedStages = [...stages].sort((a: ApprovalStage, b: ApprovalStage) => a.order - b.order);

    for (const stage of sortedStages) {
      if (stage.status === 'pending') {
        const previousStages = sortedStages.filter((s: ApprovalStage) => s.order < stage.order);
        const allPreviousApproved = previousStages.every((s: ApprovalStage) => s.status === 'approved');
        if (allPreviousApproved) {
          return stage;
        }
        return null;
      }
    }
    return null;
  };

  const handleApprove = async () => {
    const actionableStage = getCurrentActionableStage();
    if (!actionableStage) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await approvalsApi.approve(projectId, approvalId, actionableStage.id);
      router.push(`/projects/${projectId}/approvals`);
    } catch (error: any) {
      console.error('Failed to approve:', error);
      setError(error.response?.data?.error || 'Failed to approve');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    setError(null);
    try {
      await approvalsApi.cancel(projectId, approvalId);
      router.push(`/projects/${projectId}/approvals`);
    } catch (error: any) {
      console.error('Failed to cancel:', error);
      setError(error.response?.data?.error || 'Failed to cancel approval');
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) return;
    const actionableStage = getCurrentActionableStage();
    if (!actionableStage) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await approvalsApi.reject(projectId, approvalId, actionableStage.id, rejectComment);
      router.push(`/projects/${projectId}/approvals`);
    } catch (error: any) {
      console.error('Failed to reject:', error);
      setError(error.response?.data?.error || 'Failed to reject');
    } finally {
      setIsSubmitting(false);
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
      default:
        return <Badge>{action}</Badge>;
    }
  };

  // Determine per-resource diff mode based on whether current/proposed exist
  const getResourceDiffMode = (currentYaml?: string, proposedYaml?: string): 'create' | 'update' | 'delete' => {
    if (!currentYaml && proposedYaml) return 'create';
    if (currentYaml && !proposedYaml) return 'delete';
    return 'update';
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
          <Link href={`/projects/${projectId}/approvals`}>
            <Button className="mt-4">Back to Approvals</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href={`/projects/${projectId}/approvals`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Approvals
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Review Request</h1>
            {getActionBadge(approval.action)}
          </div>
          <p className="text-gray-600">
            {approval.configSnapshot?.matches?.[0]?.path?.value || 'Route'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Submitted by {approval.submitter?.username || 'Unknown'} on{' '}
            {new Date(approval.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Change Description & AI Review */}
      <div className="space-y-4 mb-6">
        {diffData?.changeDescription && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Change Description</h3>
              <blockquote className="border-l-4 border-gray-300 pl-4 text-sm text-gray-600 italic">
                {diffData.changeDescription}
              </blockquote>
            </CardContent>
          </Card>
        )}
        {diffData?.aiReview ? (
          <AIReviewCard review={diffData.aiReview} />
        ) : diffData && !isLoadingDiff ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">AI Review</h3>
                  <p className="text-sm text-gray-500 mt-1">No AI review was generated for this change.</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleAIReview}
                  disabled={isReviewingAI}
                >
                  {isReviewingAI ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Reviewing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Review with AI
                    </>
                  )}
                </Button>
              </div>
              {aiReviewError && (
                <p className="text-sm text-red-600 mt-2">{aiReviewError}</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Diff Content */}
      <div className="space-y-6 mb-8">
        {/* Loading State */}
        {isLoadingDiff && (
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading diff...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {diffError && (
          <Card>
            <CardContent className="py-8">
              <div className="text-red-600 text-center">{diffError}</div>
            </CardContent>
          </Card>
        )}

        {/* HTTPRoute Changes */}
        {diffData && (diffData.currentYaml || diffData.proposedYaml) && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">HTTPRoute Changes</h2>
              <YamlDiffViewer
                currentYaml={diffData.currentYaml}
                proposedYaml={diffData.proposedYaml || ''}
                mode={getResourceDiffMode(diffData.currentYaml, diffData.proposedYaml)}
              />
            </CardContent>
          </Card>
        )}

        {/* SecurityPolicy Changes */}
        {diffData && (diffData.currentSecurityPolicyYaml || diffData.proposedSecurityPolicyYaml) && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">SecurityPolicy Changes (CORS)</h2>
              <YamlDiffViewer
                currentYaml={diffData.currentSecurityPolicyYaml}
                proposedYaml={diffData.proposedSecurityPolicyYaml || ''}
                mode={getResourceDiffMode(diffData.currentSecurityPolicyYaml, diffData.proposedSecurityPolicyYaml)}
              />
            </CardContent>
          </Card>
        )}

        {/* BackendTrafficPolicy Changes */}
        {diffData && (diffData.currentBackendTrafficPolicyYaml || diffData.proposedBackendTrafficPolicyYaml) && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">BackendTrafficPolicy Changes (Compression)</h2>
              <YamlDiffViewer
                currentYaml={diffData.currentBackendTrafficPolicyYaml}
                proposedYaml={diffData.proposedBackendTrafficPolicyYaml || ''}
                mode={getResourceDiffMode(diffData.currentBackendTrafficPolicyYaml, diffData.proposedBackendTrafficPolicyYaml)}
              />
            </CardContent>
          </Card>
        )}

        {/* EnvoyExtensionPolicy Changes (WAF, Extensions) */}
        {diffData && (diffData.currentEnvoyExtensionPolicyYaml || diffData.proposedEnvoyExtensionPolicyYaml) && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">EnvoyExtensionPolicy Changes (WAF, Extensions)</h2>
              <YamlDiffViewer
                currentYaml={diffData.currentEnvoyExtensionPolicyYaml}
                proposedYaml={diffData.proposedEnvoyExtensionPolicyYaml || ''}
                mode={getResourceDiffMode(diffData.currentEnvoyExtensionPolicyYaml, diffData.proposedEnvoyExtensionPolicyYaml)}
              />
            </CardContent>
          </Card>
        )}

        {/* Backend CRD Changes (External Service) */}
        {diffData && (diffData.currentBackendYaml || diffData.proposedBackendYaml) && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Backend Changes (External Service)</h2>
              <YamlDiffViewer
                currentYaml={diffData.currentBackendYaml}
                proposedYaml={diffData.proposedBackendYaml || ''}
                mode={getResourceDiffMode(diffData.currentBackendYaml, diffData.proposedBackendYaml)}
              />
            </CardContent>
          </Card>
        )}

        {/* No changes */}
        {diffData && !diffData.currentYaml && !diffData.proposedYaml && !diffData.currentSecurityPolicyYaml && !diffData.proposedSecurityPolicyYaml && !diffData.currentBackendTrafficPolicyYaml && !diffData.proposedBackendTrafficPolicyYaml && !diffData.currentEnvoyExtensionPolicyYaml && !diffData.proposedEnvoyExtensionPolicyYaml && !diffData.currentBackendYaml && !diffData.proposedBackendYaml && (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No configuration changes to display
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Section */}
      {approval.status === 'pending' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
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
              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isSubmitting || isCancelling}
                >
                  Cancel Request
                </Button>
                <Button
                  variant="danger"
                  onClick={handleReject}
                  disabled={!rejectComment.trim()}
                  isLoading={isSubmitting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={handleApprove} isLoading={isSubmitting}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already reviewed */}
      {approval.status !== 'pending' && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {approval.status === 'approved' ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-700">Approved</span>
                  </>
                ) : approval.status === 'cancelled' ? (
                  <>
                    <XCircle className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-500">Cancelled</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium text-red-700">Rejected</span>
                  </>
                )}
                {approval.reviewer && (
                  <span className="text-sm text-gray-500">
                    by {approval.reviewer.username}
                  </span>
                )}
                {approval.reviewedAt && (
                  <span className="text-sm text-gray-500">
                    on {new Date(approval.reviewedAt).toLocaleString()}
                  </span>
                )}
              </div>
              {approval.status === 'approved' && (
                <Button
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isCancelling}
                >
                  Cancel Request
                </Button>
              )}
            </div>
            {approval.rejectionComment && (
              <p className="mt-2 text-sm text-gray-600">
                Reason: {approval.rejectionComment}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discussion */}
      <CommentFeed projectId={projectId} approvalId={approvalId} />

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Approval Request?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will cancel the approval request and revert any pending changes. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCancelConfirm(false)} disabled={isCancelling}>
                Keep Request
              </Button>
              <Button variant="danger" onClick={handleCancel} isLoading={isCancelling}>
                Cancel Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
