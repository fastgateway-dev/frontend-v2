import { Handle, Position } from 'reactflow';
import type { TopologyStatus, SecurityFeatureFlags } from '@/types/topology';
import { StatusBadge } from '../StatusBadge';
import { SecurityBadges } from '../SecurityBadges';

export interface RouteNodeData {
  id: string;
  name: string;
  protocol: 'http' | 'grpc';
  matcherSummary: string;
  method: string | null;
  status: TopologyStatus;
  securityFlags: SecurityFeatureFlags;
  securityVariant: 'solid' | 'outlined';
}

export function RouteNode({ data }: { data: RouteNodeData }) {
  return (
    <div className="rounded border bg-card px-3 py-2 shadow-sm w-[220px]">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm truncate">{data.name}</div>
        <StatusBadge status={data.status} />
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {data.method ? <span className="font-mono">{data.method}</span> : null}{' '}
        <span className="font-mono">{data.matcherSummary}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px]">{data.protocol}</span>
        <SecurityBadges flags={data.securityFlags} variant={data.securityVariant} />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
