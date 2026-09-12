'use client';

import { Badge } from '@/components/ui/badge';
import type { ProjectVersionInfo, VersionStatus } from '@/types/project-versions';

interface Props {
  data: ProjectVersionInfo | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function variantFor(status: VersionStatus): 'success' | 'warning' | 'default' {
  if (status === 'supported') return 'success';
  if (status === 'untested') return 'warning';
  return 'default';
}

function display(version: string): string {
  return version === '' ? '—' : version;
}

export function ProjectVersionChips({ data, isLoading, isRefreshing, onRefresh }: Props) {
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2">
        <span
          data-testid="version-chip-skeleton"
          className="inline-block h-5 w-20 rounded-full bg-gray-200 animate-pulse"
        />
        <span
          data-testid="version-chip-skeleton"
          className="inline-block h-5 w-28 rounded-full bg-gray-200 animate-pulse"
        />
      </div>
    );
  }

  const variant = variantFor(data.status);
  const egTooltip = [data.envoyGateway.image, data.envoyGateway.source, data.envoyGateway.error]
    .filter(Boolean)
    .join(' · ');
  const gwTooltip = [data.gatewayAPI.source, data.gatewayAPI.error]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant} title={egTooltip || undefined}>
        EG {display(data.envoyGateway.version)}
      </Badge>
      <Badge variant={variant} title={gwTooltip || undefined}>
        Gateway API {display(data.gatewayAPI.version)}
      </Badge>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        title="Refresh versions"
      >
        {isRefreshing ? '…' : '↻'}
      </button>
    </div>
  );
}
