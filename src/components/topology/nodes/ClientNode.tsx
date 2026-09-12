import { Handle, Position } from 'reactflow';
import type { TopologyStatus, ClientCapabilities } from '@/types/topology';
import { StatusBadge } from '../StatusBadge';
import { SecurityBadges } from '../SecurityBadges';

export interface ClientNodeData {
  id: string;
  name: string;
  teamName: string;
  capabilities: ClientCapabilities;
  aggregateStatus: TopologyStatus;
}

export function ClientNode({ data }: { data: ClientNodeData }) {
  const flags = {
    ipAllowlist: data.capabilities.ipAllowlistSize > 0,
    mtls: data.capabilities.mtls,
    apiKey: data.capabilities.apiKey,
    jwt: data.capabilities.jwt,
    basicAuth: false, headerAuth: false, rateLimit: false,
    extAuth: false, oidc: false, waf: false,
  };
  return (
    <div className="rounded border bg-card px-3 py-2 shadow-sm w-[220px]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm truncate">{data.name}</div>
        <StatusBadge status={data.aggregateStatus} />
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">team: {data.teamName}</div>
      <div className="mt-1.5">
        <SecurityBadges flags={flags} />
      </div>
      <div className="text-[10px] mt-1 text-muted-foreground">{data.capabilities.ipAllowlistSize} IPs allowed</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
