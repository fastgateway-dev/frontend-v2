'use client';

// Stream Manifests tab: the stream Gateway plus each live route's TCPRoute/UDPRoute
// and BackendTrafficPolicy, collapsible and read-only.

import { useEffect, useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui';
import { streamsApi } from '@/lib/api';
import type { StreamYAMLs } from '@/types';
import { l4RouteKind } from '@/lib/utils/l4route';
import { ManifestYaml } from './ManifestYaml';

interface Props {
  projectId: string;
  streamId: string;
}

export function StreamManifests({ projectId, streamId }: Props) {
  const [data, setData] = useState<StreamYAMLs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    streamsApi
      .getYamls(projectId, streamId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error || 'Failed to load manifests');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, streamId]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-sm text-gray-500">Loading manifests…</p>;

  return (
    <div className="space-y-3">
      <Accordion type="multiple" defaultValue={['gateway']}>
        <AccordionItem value="gateway">
          <AccordionTrigger value="gateway">Gateway</AccordionTrigger>
          <AccordionContent value="gateway">
            <ManifestYaml yaml={data.gatewayYaml} />
          </AccordionContent>
        </AccordionItem>
        {data.routes.map((r) => {
          const key = `route-${r.routeId}`;
          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger value={key}>{`${l4RouteKind(r.protocol)} · ${r.name}`}</AccordionTrigger>
              <AccordionContent value={key}>
                <div className="space-y-4">
                  <ManifestYaml yaml={r.routeYaml} />
                  {r.backendTrafficPolicyYaml && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">BackendTrafficPolicy</h4>
                      <ManifestYaml yaml={r.backendTrafficPolicyYaml} />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      {data.routes.length === 0 && (
        <p className="text-sm text-gray-500">No live routes yet, so the Gateway has only the placeholder listener.</p>
      )}
    </div>
  );
}
