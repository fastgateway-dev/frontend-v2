import { Handle, Position } from 'reactflow';
import type { DomainTopologyGateway } from '@/types/topology';
import { StatusBadge } from '../StatusBadge';

export interface GatewayNodeData extends DomainTopologyGateway {
  hostname: string;
}

export function GatewayNode({ data }: { data: GatewayNodeData }) {
  return (
    <div className="rounded border bg-card px-3 py-2 shadow-sm w-[220px]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm truncate">{data.hostname}</div>
        <StatusBadge status={data.status} />
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {data.listenerProtocol}:{data.listenerPort}
      </div>
      {data.tls ? (
        <div className="text-[10px] mt-1 text-muted-foreground truncate">
          TLS: {data.tls.secretName} ({data.tls.secretNamespace})
        </div>
      ) : null}
      <div className="text-[10px] mt-1 text-muted-foreground truncate">class: {data.gatewayClass}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
