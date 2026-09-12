// frontend/src/components/topology/ProjectDomainsGrid.tsx
import type { ProjectTopologyDomain } from '@/types/topology';
import { StatusBadge } from './StatusBadge';

export function ProjectDomainsGrid({
  domains, onSelectDomain,
}: { domains: ProjectTopologyDomain[]; onSelectDomain: (id: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {domains.map((d) => (
        <button
          key={d.id}
          data-testid={`domain-card-${d.id}`}
          className="text-left rounded border bg-card px-3 py-3 hover:shadow"
          onClick={() => onSelectDomain(d.id)}
        >
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm truncate">{d.name}</div>
            <StatusBadge status={d.gatewayStatus} />
          </div>
          <div className="text-[10px] text-muted-foreground">{d.hostname}</div>
          <div className="mt-1.5 text-[11px]">
            <span className="rounded bg-slate-100 px-1.5 py-0.5">{d.securityMode}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {d.counts.routes} routes · {d.counts.clientsAttached} clients attached · {d.counts.routesWithIpAllowlist} with IP allowlist · {d.counts.routesWithMtls} with mTLS
          </div>
          {d.templateName ? <div className="text-[10px] mt-1 text-muted-foreground">template: {d.templateName}</div> : null}
        </button>
      ))}
    </div>
  );
}
