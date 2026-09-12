// frontend/src/components/topology/ClientsByDomainMatrix.tsx
import { useState } from 'react';
import type { ProjectTopologyDomain, ProjectTopologyClient } from '@/types/topology';
import { StatusBadge } from './StatusBadge';

interface Props {
  domains: ProjectTopologyDomain[];
  clients: ProjectTopologyClient[];
  onCellClick: (sel: { clientId: string; domainId: string }) => void;
}

export function ClientsByDomainMatrix({ domains, clients, onCellClick }: Props) {
  const [q, setQ] = useState('');
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input
        className="border rounded px-2 py-1 text-xs mb-2"
        placeholder="search clients"
        value={q} onChange={(e) => setQ(e.target.value)}
      />
      <table className="w-full text-xs border">
        <thead>
          <tr>
            <th className="text-left px-2 py-1">Client</th>
            {domains.map((d) => <th key={d.id} className="px-2 py-1">{d.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td className="px-2 py-1 truncate">
                <div>{c.name}</div>
                <div className="text-[10px] text-muted-foreground">{c.teamName}</div>
              </td>
              {domains.map((d) => {
                const pd = c.perDomain[d.id];
                return (
                  <td
                    key={d.id}
                    data-testid={`cell-${c.id}-${d.id}`}
                    className="px-2 py-1 text-center cursor-pointer hover:bg-muted"
                    onClick={() => onCellClick({ clientId: c.id, domainId: d.id })}
                  >
                    {pd ? (
                      <span className="inline-flex items-center gap-1.5">
                        {pd.routeCount} routes
                        <StatusBadge status={pd.aggregateStatus} />
                      </span>
                    ) : '–'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
