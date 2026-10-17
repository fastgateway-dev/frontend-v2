'use client';

// Delete confirmation for an L4 route: shows what the delete removes
// (previewDeleteRoute), then submits the delete request for approval. A failed
// preview does not block the request; the server decides.

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { streamsApi } from '@/lib/api';
import type { PreviewDeleteResult } from '@/types';
import { l4RouteKind } from '@/lib/utils/l4route';
import { L4ManifestDiff } from './L4ManifestDiff';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  projectId: string;
  streamId: string;
  routeId: string;
  routeName: string;
  protocol: string;
}

type ApiError = { response?: { data?: { error?: string } } };

export function L4RouteDeleteModal({ isOpen, onClose, onDeleted, projectId, streamId, routeId, routeName, protocol }: Props) {
  const [preview, setPreview] = useState<PreviewDeleteResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    setError(null);
    streamsApi
      .previewDeleteRoute(projectId, streamId, routeId)
      .then((d) => {
        if (!cancelled) setPreview(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setPreviewError((e as ApiError).response?.data?.error || 'request failed');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, streamId, routeId]);

  const submit = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await streamsApi.deleteRoute(projectId, streamId, routeId);
      onDeleted();
    } catch (e: unknown) {
      setError((e as ApiError).response?.data?.error || 'Failed to submit delete request');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Route" size="xl">
      <div className="space-y-4">
        <p className="text-gray-600">
          Are you sure you want to delete the route <strong>{routeName}</strong>? This submits a delete request for
          approval; these manifests are removed once it is approved and deployed.
        </p>
        {previewError ? (
          <p role="alert" data-testid="delete-preview-error" className="text-sm text-amber-700">
            Could not load the delete preview ({previewError}). You can still submit the request.
          </p>
        ) : preview ? (
          <L4ManifestDiff
            routeKind={l4RouteKind(protocol)}
            current={{ route: preview.currentYaml, btp: preview.currentBackendTrafficPolicyYaml }}
          />
        ) : (
          <p className="text-sm text-gray-500">Loading preview…</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} isLoading={isDeleting}>
            Submit Delete Request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
