import { layoutNodes } from './dagreLayout';

test('assigns x/y to all nodes and respects rankdir LR layers', () => {
  const nodes = [
    { id: 'g', layer: 'gateway' as const },
    { id: 'r1', layer: 'route' as const },
    { id: 'b1', layer: 'backend' as const },
  ];
  const edges = [
    { source: 'g', target: 'r1' },
    { source: 'r1', target: 'b1' },
  ];
  const out = layoutNodes(nodes, edges);
  expect(out.find((n) => n.id === 'g')!.position.x).toBeLessThan(out.find((n) => n.id === 'r1')!.position.x);
  expect(out.find((n) => n.id === 'r1')!.position.x).toBeLessThan(out.find((n) => n.id === 'b1')!.position.x);
});

test('client-mode adds client layer left of gateway', () => {
  const out = layoutNodes(
    [
      { id: 'c', layer: 'client' as const },
      { id: 'g', layer: 'gateway' as const },
    ],
    [{ source: 'c', target: 'g' }],
  );
  expect(out.find((n) => n.id === 'c')!.position.x).toBeLessThan(out.find((n) => n.id === 'g')!.position.x);
});
