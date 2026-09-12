'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProjectVersionInfo } from '@/types/project-versions';

interface Props {
  projectId: string;
  data: ProjectVersionInfo | null;
}

function dismissKey(projectId: string, eg: string, gw: string): string {
  return `versionBannerDismissed:${projectId}:${eg}:${gw}`;
}

export function VersionCompatBanner({ projectId, data }: Props) {
  const key = useMemo(() => {
    if (!data) return null;
    return dismissKey(projectId, data.envoyGateway.version, data.gatewayAPI.version);
  }, [projectId, data]);

  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!key) {
      setDismissed(false);
      return;
    }
    setDismissed(sessionStorage.getItem(key) === '1');
  }, [key]);

  if (!data || data.status !== 'untested' || dismissed) return null;

  const handleDismiss = () => {
    if (key) sessionStorage.setItem(key, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex items-start gap-3">
      <div className="flex-1 text-sm text-yellow-900">
        <p className="font-medium">
          This project is running an untested combination: Envoy Gateway {data.envoyGateway.version} with Gateway
          API {data.gatewayAPI.version}.
        </p>
        <p className="mt-1">
          FastGateway has been verified against:{' '}
          {data.supportedPairs
            .map((p) => `EG ${p.envoyGateway} + Gateway API ${p.gatewayAPI}`)
            .join(', ')}
          .{' '}
          <a
            href="https://fastgateway.dev/docs/getting-started/compatibility-matrix"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Compatibility matrix
          </a>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="text-yellow-900 hover:text-yellow-700 text-sm font-medium"
      >
        Dismiss
      </button>
    </div>
  );
}
