import { Handle, Position } from 'reactflow';
import type { DomainTopologyBackend } from '@/types/topology';

export function BackendNode({ data }: { data: DomainTopologyBackend }) {
  return (
    <div className="rounded border bg-card px-3 py-2 shadow-sm w-[220px]">
      <Handle type="target" position={Position.Left} />
      <div className="font-medium text-sm truncate font-mono">{data.id}</div>
      <div className="mt-1 flex items-center gap-1 text-[10px]">
        <span className="rounded bg-slate-200 px-1.5 py-0.5">{data.type === 'kubernetes' ? 'k8s' : 'external'}</span>
        {data.type === 'external' && data.addressType ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5">{data.addressType}</span>
        ) : null}
      </div>
      <div className="text-[10px] mt-1 text-muted-foreground">hit by {data.hitCount} routes</div>
    </div>
  );
}
