import { filterStreams, portsSummary } from './stream-list';
import type { Stream } from '@/types';

const s = (id: string, name: string, status: Stream['status']): Stream => ({
  id,
  projectId: 'p1',
  name,
  namespace: 'ns',
  gatewayTemplateId: 't1',
  k8sGatewayName: `str-${name}`,
  k8sGatewayClass: 'gc',
  status,
});
const all = [s('1', 'postgres', 'active'), s('2', 'cache', 'pending'), s('3', 'Cache-EU', 'error')];

describe('filterStreams', () => {
  test('empty status and query keep everything', () => {
    expect(filterStreams(all, '', '')).toHaveLength(3);
  });
  test('status filters exactly', () => {
    expect(filterStreams(all, 'pending', '').map((x) => x.name)).toEqual(['cache']);
  });
  test('query is a trimmed, case-insensitive name substring', () => {
    expect(filterStreams(all, '', '  CACHE ').map((x) => x.name)).toEqual(['cache', 'Cache-EU']);
  });
  test('status and query combine', () => {
    expect(filterStreams(all, 'error', 'cache').map((x) => x.name)).toEqual(['Cache-EU']);
  });
});

describe('portsSummary', () => {
  test('first three sorted by port, then the remainder count', () => {
    expect(
      portsSummary([
        { transport: 'TCP', port: 9000 },
        { transport: 'TCP', port: 6379 },
        { transport: 'UDP', port: 53 },
        { transport: 'TCP', port: 5432 },
      ])
    ).toEqual({ shown: ['53/UDP', '5432/TCP', '6379/TCP'], more: 1 });
  });
  test('no ports', () => {
    expect(portsSummary(undefined)).toEqual({ shown: [], more: 0 });
    expect(portsSummary([])).toEqual({ shown: [], more: 0 });
  });
});
