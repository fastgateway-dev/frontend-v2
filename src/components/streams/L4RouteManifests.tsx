'use client';

// L4 route Manifests tab: the TCPRoute/UDPRoute (carried in httpRouteYaml) and its
// BackendTrafficPolicy, read-only, in the domain Manifests tab's layout.

import { useEffect, useState } from 'react';
import { streamsApi } from '@/lib/api';
import type { RouteYAMLs } from '@/types';
import { l4RouteKind } from '@/lib/utils/l4route';
import { ManifestYaml } from './ManifestYaml';

interface Props {
  projectId: string;
  streamId: string;
  routeId: string;
  protocol: string;
}

export function L4RouteManifests({ projectId, streamId, routeId, protocol }: Props) {
  const [yamls, setYamls] = useState<RouteYAMLs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    streamsApi
      .getRouteYamls(projectId, streamId, routeId)
      .then((d) => {
        if (!cancelled) setYamls(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error || 'Failed to load manifests');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, streamId, routeId]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (!yamls) return <p className="text-sm text-gray-500">Loading manifests…</p>;
  if (!yamls.httpRouteYaml && !yamls.backendTrafficPolicyYaml) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No manifests available.</p>
      </div>
    );
  }

  return (
    <div>
      {yamls.httpRouteYaml && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{l4RouteKind(protocol)}</h3>
          <ManifestYaml yaml={yamls.httpRouteYaml} />
        </div>
      )}
      {yamls.backendTrafficPolicyYaml && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">BackendTrafficPolicy</h3>
          <ManifestYaml yaml={yamls.backendTrafficPolicyYaml} />
        </div>
      )}
    </div>
  );
}
