import React from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import type { DomainTopologyResponse } from '@/types/topology';
import { layoutNodes, type LayoutInputNode, type LayoutInputEdge } from './lib/dagreLayout';
import { ClientNode } from './nodes/ClientNode';
import { GatewayNode } from './nodes/GatewayNode';
import { RouteNode } from './nodes/RouteNode';
import { BackendNode } from './nodes/BackendNode';
import { aggregateStatus } from './lib/status';

type Selection =
  | { type: 'client'; id: string }
  | { type: 'gateway' }
  | { type: 'route'; id: string }
  | { type: 'backend'; id: string }
  | { type: 'attachment'; id: string };

interface Props {
  data: DomainTopologyResponse;
  onSelect: (sel: Selection) => void;
  onFallbackToMatrix?: () => void;
}

class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode; onFallback?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-sm">
          <div>Visualization couldn&apos;t render. Open the matrix view instead.</div>
          {this.props.onFallback ? (
            <button className="mt-2 underline" onClick={this.props.onFallback}>Open matrix view</button>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

export function TopologyCanvas({ data, onSelect, onFallbackToMatrix }: Props) {
  const layoutInputNodes: LayoutInputNode[] = [];
  const layoutInputEdges: LayoutInputEdge[] = [];

  layoutInputNodes.push({ id: 'gateway', layer: 'gateway' });
  data.routes.forEach((r) => {
    layoutInputNodes.push({ id: `route:${r.id}`, layer: 'route' });
    layoutInputEdges.push({ source: 'gateway', target: `route:${r.id}` });
    r.backendRoles.forEach((br) => {
      const bid = `backend:${br.backendId}`;
      if (!layoutInputNodes.find((n) => n.id === bid)) {
        layoutInputNodes.push({ id: bid, layer: 'backend' });
      }
      layoutInputEdges.push({ source: `route:${r.id}`, target: bid });
    });
  });
  if (data.domain.securityMode === 'client') {
    data.clients.forEach((c) => {
      layoutInputNodes.push({ id: `client:${c.id}`, layer: 'client' });
    });
    data.attachments.forEach((a) => {
      layoutInputEdges.push({ source: `client:${a.clientId}`, target: `route:${a.routeId}` });
    });
  }

  const positioned = layoutNodes(layoutInputNodes, layoutInputEdges);

  const routeEnforcement: Record<string, { flags: any; variant: 'solid' | 'outlined' }> = {};
  if (data.domain.securityMode === 'client') {
    data.routes.forEach((r) => {
      const atts = data.attachments.filter((a) => a.routeId === r.id);
      const flagKeys = ['ipAllowlist', 'mtls', 'apiKey', 'jwt', 'basicAuth', 'headerAuth', 'rateLimit', 'extAuth', 'oidc', 'waf'] as const;
      const agg: any = {};
      flagKeys.forEach((k) => {
        const enforcers = atts.filter((a) => (a.enforced as any)[k]).length;
        agg[k] = enforcers > 0;
      });
      const allEnforce = atts.length > 0 && atts.every((a) =>
        flagKeys.every((k) => !(agg[k]) || (a.enforced as any)[k])
      );
      routeEnforcement[r.id] = { flags: agg, variant: allEnforce ? 'solid' : 'outlined' };
    });
  }

  const clientStatus: Record<string, any> = {};
  data.clients.forEach((c) => {
    const atts = data.attachments.filter((a) => a.clientId === c.id);
    clientStatus[c.id] = aggregateStatus(atts.map((a) => a.status));
  });

  const nodes = positioned.map((p) => {
    if (p.layer === 'gateway') {
      return { id: p.id, position: p.position, type: 'gatewayNode',
        data: { ...data.gateway, hostname: data.domain.hostname } };
    }
    if (p.layer === 'route') {
      const id = p.id.replace('route:', '');
      const r = data.routes.find((x) => x.id === id)!;
      const enf = routeEnforcement[id];
      return { id: p.id, position: p.position, type: 'routeNode',
        data: {
          id: r.id, name: r.name, protocol: r.protocol,
          matcherSummary: r.matcherSummary, method: r.method,
          status: r.status,
          securityFlags: enf ? enf.flags : r.routeLevelSecurity,
          securityVariant: enf ? enf.variant : 'solid',
        }};
    }
    if (p.layer === 'backend') {
      const id = p.id.replace('backend:', '');
      const b = data.backends.find((x) => x.id === id)!;
      return { id: p.id, position: p.position, type: 'backendNode', data: b };
    }
    const cid = p.id.replace('client:', '');
    const c = data.clients.find((x) => x.id === cid)!;
    return { id: p.id, position: p.position, type: 'clientNode',
      data: { id: c.id, name: c.name, teamName: c.teamName,
        capabilities: c.capabilities, aggregateStatus: clientStatus[c.id] ?? 'draft' }};
  });

  const edges = layoutInputEdges.map((e, i) => ({ id: `e${i}`, source: e.source, target: e.target }));

  const nodeTypes = {
    clientNode: ClientNode as any,
    gatewayNode: GatewayNode as any,
    routeNode: RouteNode as any,
    backendNode: BackendNode as any,
  };

  return (
    <CanvasErrorBoundary onFallback={onFallbackToMatrix}>
      <ReactFlowProvider>
        <div style={{ width: '100%', height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            onNodeClick={(_, n) => {
              if (n.id === 'gateway') return onSelect({ type: 'gateway' });
              const [kind, id] = n.id.split(':');
              if (kind === 'route') return onSelect({ type: 'route', id });
              if (kind === 'backend') return onSelect({ type: 'backend', id });
              if (kind === 'client') return onSelect({ type: 'client', id });
            }}
          >
            <Background />
            <Controls />
            {nodes.length > 30 ? <MiniMap /> : null}
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </CanvasErrorBoundary>
  );
}
