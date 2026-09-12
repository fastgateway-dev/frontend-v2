import type { TopologyStatus } from '@/types/topology';
import { statusToVisual } from './lib/status';

export function StatusBadge({ status }: { status: TopologyStatus }) {
  const v = statusToVisual(status);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${v.dotClass}`} />
      {v.label}
    </span>
  );
}
