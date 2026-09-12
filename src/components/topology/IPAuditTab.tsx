// frontend/src/components/topology/IPAuditTab.tsx
import { useState, useMemo } from 'react';
import type { TopologyIPRow, ProjectTopologyDomain } from '@/types/topology';

interface Props {
  ips: TopologyIPRow[];
  domains: Pick<ProjectTopologyDomain, 'id' | 'name'>[];
  onRowClick: (ip: TopologyIPRow) => void;
}

export function IPAuditTab({ ips, domains, onRowClick }: Props) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'all' | 'route' | 'client'>('all');
  const [onlyMulti, setOnlyMulti] = useState(false);

  const totalUnique = useMemo(() => new Set(ips.map((i) => i.cidr)).size, [ips]);
  const totalCidrRanges = useMemo(() => ips.filter((i) => !i.cidr.endsWith('/32') && !i.cidr.endsWith('/128')).length, [ips]);
  const multiDomain = useMemo(() => ips.filter((i) => i.reach.domainIds.length > 1), [ips]);

  const filtered = ips.filter((i) => {
    if (search && !i.cidr.toLowerCase().startsWith(search.toLowerCase())) return false;
    if (source !== 'all' && i.source !== source) return false;
    if (onlyMulti && i.reach.domainIds.length <= 1) return false;
    return true;
  });

  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? id;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card label="Total unique IPs" value={totalUnique} />
        <Card label="Total CIDR ranges" value={totalCidrRanges} />
        <Card
          label="IPs reaching multiple domains"
          value={multiDomain.length}
          dataTestid="stat-multi-domain"
          onClick={() => setOnlyMulti((v) => !v)}
        />
      </div>
      <div className="flex items-center gap-2">
        <input className="border rounded px-2 py-1 text-xs" placeholder="search IP/CIDR prefix" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="text-xs flex items-center gap-1">
          source
          <select value={source} onChange={(e) => setSource(e.target.value as any)} className="border rounded px-1 py-0.5">
            <option value="all">All</option>
            <option value="route">Route</option>
            <option value="client">Client</option>
          </select>
        </label>
      </div>
      <table className="w-full text-xs border">
        <thead>
          <tr>
            <th className="text-left px-2 py-1">IP / CIDR</th>
            <th className="text-left px-2 py-1">Source</th>
            <th className="text-left px-2 py-1">Reach</th>
            <th className="text-left px-2 py-1">Domains</th>
            <th className="text-left px-2 py-1">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((i, idx) => (
            <tr
              key={`${i.cidr}-${i.source}-${i.sourceRef.id}-${idx}`}
              className="hover:bg-muted cursor-pointer"
              onClick={() => onRowClick(i)}
            >
              <td className="px-2 py-1 font-mono">{i.cidr}</td>
              <td className="px-2 py-1">{i.source === 'route' ? 'Route' : <><span>Client: </span><span>{i.sourceRef.name}</span></>}</td>
              <td className="px-2 py-1">{i.reach.routeIds.length} routes</td>
              <td className="px-2 py-1">{i.reach.domainIds.map(domainName).join(', ')}</td>
              <td className="px-2 py-1">{new Date(i.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ label, value, onClick, dataTestid }: { label: string; value: number; onClick?: () => void; dataTestid?: string }) {
  return (
    <button
      data-testid={dataTestid}
      onClick={onClick}
      className="text-left rounded border bg-card px-3 py-2 hover:shadow"
      type="button"
    >
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </button>
  );
}
