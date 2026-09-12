'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { DomainTopologyResponse } from '@/types/topology';
import { topologyApi } from '@/lib/api/topology';
import { TopologyCanvas } from '@/components/topology/TopologyCanvas';
import { ClientRouteMatrix } from '@/components/topology/ClientRouteMatrix';
import { SidePanel } from '@/components/topology/SidePanel';

type Selection =
  | { type: 'gateway' }
  | { type: 'route'; id: string }
  | { type: 'backend'; id: string }
  | { type: 'client'; id: string }
  | { type: 'attachment'; id: string }
  | { type: 'cell'; clientId?: string; routeId: string; feature?: string };

export default function DomainTopologyPage() {
  const params = useParams<{ projectId: string; domainId: string }>();
  const [data, setData] = useState<DomainTopologyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'flow' | 'matrix'>('flow');
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    let active = true;
    topologyApi.getDomainTopology(params.projectId, params.domainId)
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [params.projectId, params.domainId]);

  if (error) return <div className="p-6 text-sm text-red-600">{error} <button onClick={() => location.reload()} className="underline ml-2">Retry</button></div>;
  if (!data) return <div className="p-6 text-sm">Loading…</div>;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="text-sm font-semibold">{data.domain.name} · Topology</div>
        <div className="flex items-center gap-2">
          <button className={`text-xs px-2 py-1 rounded ${view === 'flow' ? 'bg-primary text-primary-foreground' : 'border'}`} onClick={() => setView('flow')}>Flow</button>
          <button className={`text-xs px-2 py-1 rounded ${view === 'matrix' ? 'bg-primary text-primary-foreground' : 'border'}`} onClick={() => setView('matrix')}>Matrix</button>
          <Link className="text-xs underline" href={`/projects/${params.projectId}/domains/${params.domainId}`}>Open domain</Link>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        {view === 'flow' ? (
          <TopologyCanvas data={data} onSelect={setSelection} onFallbackToMatrix={() => setView('matrix')} />
        ) : (
          <ClientRouteMatrix data={data} onCellClick={(sel) => setSelection({ type: 'cell', ...sel })} />
        )}
      </main>
      <SidePanel
        open={!!selection}
        onClose={() => setSelection(null)}
        title={selection ? selectionTitle(selection) : ''}
      >
        {selection ? <SelectionContent selection={selection} data={data} projectId={params.projectId} /> : null}
      </SidePanel>
    </div>
  );
}

function selectionTitle(s: Selection) {
  if (s.type === 'gateway') return 'Gateway';
  if (s.type === 'route') return 'Route';
  if (s.type === 'backend') return 'Backend';
  if (s.type === 'client') return 'Client';
  if (s.type === 'attachment') return 'Attachment';
  return 'Details';
}

function SelectionContent({ selection, data, projectId }: { selection: Selection; data: DomainTopologyResponse; projectId: string }) {
  if (selection.type === 'route') {
    const r = data.routes.find((x) => x.id === selection.id);
    if (!r) return null;
    return (
      <div className="space-y-2">
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted-foreground">{r.method} {r.matcherSummary}</div>
        <Link className="text-xs underline" href={`/projects/${projectId}/domains/${data.domain.id}/routes/${r.id}`}>Open route</Link>
      </div>
    );
  }
  if (selection.type === 'backend') {
    const b = data.backends.find((x) => x.id === selection.id);
    if (!b) return null;
    return (
      <div className="space-y-1 text-xs">
        <div className="font-mono">{b.id}</div>
        <div>type: {b.type}</div>
        <div>hit by {b.hitCount} routes</div>
      </div>
    );
  }
  if (selection.type === 'client') {
    const c = data.clients.find((x) => x.id === selection.id);
    if (!c) return null;
    return (
      <div className="space-y-1 text-xs">
        <div className="font-medium">{c.name}</div>
        <div>team: {c.teamName}</div>
        <Link className="text-xs underline" href={`/projects/${projectId}/clients/${c.id}`}>Open client</Link>
      </div>
    );
  }
  if (selection.type === 'gateway') {
    return (
      <div className="text-xs space-y-1">
        <div>{data.domain.hostname}</div>
        <div>{data.gateway.listenerProtocol}:{data.gateway.listenerPort}</div>
        {data.gateway.tls ? <div>TLS: {data.gateway.tls.secretName}</div> : null}
        <Link className="text-xs underline" href={`/projects/${projectId}/domains/${data.domain.id}`}>Open domain</Link>
      </div>
    );
  }
  return <pre className="text-[10px]">{JSON.stringify(selection, null, 2)}</pre>;
}
