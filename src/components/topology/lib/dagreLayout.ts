import dagre from 'dagre';

export type TopologyLayer = 'client' | 'gateway' | 'route' | 'backend';

export interface LayoutInputNode { id: string; layer: TopologyLayer }
export interface LayoutInputEdge { source: string; target: string }
export interface LayoutOutputNode {
  id: string;
  layer: TopologyLayer;
  position: { x: number; y: number };
}

const NODE_W = 220;
const NODE_H = 80;

export function layoutNodes(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
): LayoutOutputNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const layout = g.node(n.id);
    return {
      id: n.id,
      layer: n.layer,
      position: { x: layout.x - NODE_W / 2, y: layout.y - NODE_H / 2 },
    };
  });
}
