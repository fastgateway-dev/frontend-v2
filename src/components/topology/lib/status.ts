import type { TopologyStatus } from '@/types/topology';

export function aggregateStatus(statuses: TopologyStatus[]): TopologyStatus {
  if (!statuses.length) return 'draft';
  const priority: Record<TopologyStatus, number> = {
    failed: 3,
    pending: 2,
    draft: 1,
    deployed: 0,
  };
  return statuses.reduce<TopologyStatus>(
    (acc, s) => (priority[s] > priority[acc] ? s : acc),
    'deployed',
  );
}

export interface StatusVisual {
  label: string;
  dotClass: string;
  edgeClass: string;
}

export function statusToVisual(s: TopologyStatus): StatusVisual {
  switch (s) {
    case 'deployed':
      return { label: 'Deployed', dotClass: 'bg-green-500', edgeClass: 'stroke-green-500' };
    case 'pending':
      return { label: 'Pending', dotClass: 'bg-yellow-500', edgeClass: 'stroke-yellow-500 stroke-dashed' };
    case 'failed':
      return { label: 'Failed', dotClass: 'bg-red-500', edgeClass: 'stroke-red-500' };
    case 'draft':
    default:
      return { label: 'Draft', dotClass: 'bg-gray-400', edgeClass: 'stroke-gray-300' };
  }
}
