import {
  entrypointLabel,
  freePortCount,
  ownerLabel,
  portLabel,
  rangeSize,
  reservedLabel,
  reservedSummary,
  sharedWithSummary,
  splitPorts,
  templateOptionLabel,
  withDefaultReserved,
} from './stream-entrypoint';
import type { EntrypointPort, ReservedPort } from '@/types';

const mine = (port: number, transport = 'TCP'): EntrypointPort => ({
  transport,
  port,
  owner: { kind: 'stream_route', streamId: 's1', streamName: 'test-stream', routeId: `r${port}`, routeName: `route-${port}`, status: 'active' },
});
const other = (port: number, transport = 'TCP'): EntrypointPort => ({
  transport,
  port,
  owner: { kind: 'stream_route', streamId: 's2', streamName: 'cache', routeId: 'rx', routeName: 'redis', status: 'active' },
});
const domain = (port: number): EntrypointPort => ({
  transport: 'TCP',
  port,
  owner: { kind: 'domain', domainId: 'd1', domainName: 'api' },
});
// The backend lists the platform ports on both transports (validation rejects them on both).
const DEFAULT_RESERVED: ReservedPort[] = [
  { transport: 'TCP', port: 19000, reason: 'envoy_internal' },
  { transport: 'UDP', port: 19000, reason: 'envoy_internal' },
  { transport: 'TCP', port: 19001, reason: 'envoy_internal' },
  { transport: 'UDP', port: 19001, reason: 'envoy_internal' },
  { transport: 'TCP', port: 60000, reason: 'placeholder' },
  { transport: 'UDP', port: 60000, reason: 'placeholder' },
];

describe('entrypointLabel', () => {
  test('dedicated', () => {
    expect(entrypointLabel('dedicated')).toEqual({
      badge: 'Dedicated IP',
      explanation: 'This stream has its own entry point and IP.',
    });
  });
  test('shared', () => {
    expect(entrypointLabel('shared')).toEqual({
      badge: 'Shared IP',
      explanation:
        "This stream is a named group of ports on the template's shared entry point. Ports are unique across everything on it.",
    });
  });
});

test('templateOptionLabel shows the mode', () => {
  expect(templateOptionLabel({ name: 'shared-envoy', mergeGateways: true })).toBe('shared-envoy — Shared IP');
  expect(templateOptionLabel({ name: 'edge-l4', mergeGateways: false })).toBe('edge-l4 — Dedicated IP');
});

describe('splitPorts', () => {
  test('mine are this stream route ports; everything else is a neighbour; both sorted', () => {
    const { mine: m, neighbors: n } = splitPorts([other(9001), mine(9002), domain(443), mine(53, 'UDP'), mine(53)], 's1');
    expect(m.map(portLabel)).toEqual(['53/TCP', '53/UDP', '9002/TCP']);
    expect(n.map(portLabel)).toEqual(['443/TCP', '9001/TCP']);
  });
  test('without a stream id (create) every port is a neighbour', () => {
    const { mine: m, neighbors: n } = splitPorts([mine(9000), domain(443)]);
    expect(m).toEqual([]);
    expect(n).toHaveLength(2);
  });
});

describe('freePortCount / rangeSize', () => {
  test('null range gives null', () => {
    expect(freePortCount(null, [], DEFAULT_RESERVED)).toBeNull();
  });
  test('inverted range gives null', () => {
    expect(freePortCount({ min: 10, max: 5 }, [], [])).toBeNull();
  });
  test('counts port numbers in range that nothing holds', () => {
    expect(rangeSize({ min: 9000, max: 9100 })).toBe(101);
    expect(freePortCount({ min: 9000, max: 9100 }, [mine(9000), other(9001)], DEFAULT_RESERVED)).toBe(99);
  });
  test('ports and reservations outside the range are ignored', () => {
    expect(freePortCount({ min: 9000, max: 9009 }, [domain(443)], DEFAULT_RESERVED)).toBe(10);
  });
  test('a number used on one transport counts once and as taken (conservative)', () => {
    expect(freePortCount({ min: 50, max: 59 }, [mine(53), mine(53, 'UDP')], [])).toBe(9);
  });
  test('a reserved port inside the range is not free', () => {
    expect(freePortCount({ min: 59990, max: 60009 }, [], DEFAULT_RESERVED)).toBe(19);
  });
});

describe('withDefaultReserved (Review Focus: response omits platform ports)', () => {
  test('adds the platform ports the backend left out (both transports), keeps the rest, sorted', () => {
    const out = withDefaultReserved([{ transport: 'TCP', port: 443, reason: 'template_listener' }]);
    expect(out.map(reservedLabel)).toEqual([
      '443/TCP (Template listener)',
      '19000/TCP (Envoy internal)',
      '19000/UDP (Envoy internal)',
      '19001/TCP (Envoy internal)',
      '19001/UDP (Envoy internal)',
      '60000/TCP (Placeholder listener)',
      '60000/UDP (Placeholder listener)',
    ]);
  });
  test('an empty list still yields the platform ports on both transports', () => {
    expect(withDefaultReserved([]).map(portLabel)).toEqual([
      '19000/TCP', '19000/UDP', '19001/TCP', '19001/UDP', '60000/TCP', '60000/UDP',
    ]);
  });
  test('does not duplicate entries the backend already sent (keyed by transport + port)', () => {
    expect(withDefaultReserved(DEFAULT_RESERVED)).toHaveLength(6);
  });
});

describe('reservedSummary', () => {
  test('one line per port and reason, transports merged', () => {
    expect(
      reservedSummary([...DEFAULT_RESERVED, { transport: 'TCP', port: 443, reason: 'template_listener' }])
    ).toEqual([
      '443/TCP (Template listener)',
      '19000/TCP+UDP (Envoy internal)',
      '19001/TCP+UDP (Envoy internal)',
      '60000/TCP+UDP (Placeholder listener)',
    ]);
  });
});

describe('ownerLabel', () => {
  test('stream route', () => {
    expect(ownerLabel(other(9001).owner)).toBe('Stream cache · route redis');
  });
  test('domain', () => {
    expect(ownerLabel(domain(443).owner)).toBe('Domain api');
  });
  test('falls back to ids when names are missing', () => {
    expect(ownerLabel({ kind: 'stream_route', streamId: 's9', routeId: 'r9' })).toBe('Stream s9 · route r9');
    expect(ownerLabel({ kind: 'domain', domainId: 'd9' })).toBe('Domain d9');
  });
});

test('sharedWithSummary pluralises', () => {
  expect(sharedWithSummary({ streams: [{ id: 'a', name: 'a' }], domains: [] })).toBe('1 stream and 0 domains');
  expect(
    sharedWithSummary({
      streams: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
      domains: [{ id: 'd', name: 'd', hostname: 'd.example.com' }],
    })
  ).toBe('2 streams and 1 domain');
});
