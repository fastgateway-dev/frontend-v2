import {
  claimProblem,
  claimProblemMessage,
  entrypointLabel,
  freeClaims,
  freePortCount,
  myClaims,
  ownerLabel,
  portLabel,
  rangeSize,
  reservedLabel,
  reservedSummary,
  templateOptionLabel,
  withDefaultReserved,
} from './stream-entrypoint';
import type { EntrypointPort, ReservedPort, StreamRoute } from '@/types';

const mine = (port: number, transport = 'TCP'): EntrypointPort => ({
  transport,
  port,
  owner: { kind: 'stream', streamId: 's1', streamName: 'test-stream', routeId: `r${port}`, routeName: `route-${port}`, status: 'active' },
});
const other = (port: number, transport = 'TCP'): EntrypointPort => ({
  transport,
  port,
  owner: { kind: 'stream', streamId: 's2', streamName: 'cache', routeId: 'rx', routeName: 'redis', status: 'active' },
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
    expect(freePortCount({ min: 18995, max: 19004 }, [], DEFAULT_RESERVED)).toBe(8);
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
    ]);
  });
  test('an empty list still yields the platform ports on both transports', () => {
    expect(withDefaultReserved([]).map(portLabel)).toEqual([
      '19000/TCP', '19000/UDP', '19001/TCP', '19001/UDP',
    ]);
  });
  test('does not duplicate entries the backend already sent (keyed by transport + port)', () => {
    expect(withDefaultReserved(DEFAULT_RESERVED)).toHaveLength(4);
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
    ]);
  });
});

describe('ownerLabel', () => {
  test('stream with a route', () => {
    expect(ownerLabel(other(9001).owner)).toBe('Stream cache · route redis');
  });
  test('domain', () => {
    expect(ownerLabel(domain(443).owner)).toBe('Domain api');
  });
  test('falls back to ids when names are missing', () => {
    expect(ownerLabel({ kind: 'stream', streamId: 's9', routeId: 'r9' })).toBe('Stream s9 · route r9');
    expect(ownerLabel({ kind: 'domain', domainId: 'd9' })).toBe('Domain d9');
  });
  test('a stream claim with no route is just the stream', () => {
    expect(ownerLabel({ kind: 'stream', streamId: 's2', streamName: 'cache' })).toBe('Stream cache');
  });
});

const claim = (port: number, transport: 'TCP' | 'UDP' = 'TCP') => ({ transport, port });
const ctx = (over: Partial<Parameters<typeof claimProblem>[2]> = {}) => ({
  range: { min: 1000, max: 65535 } as { min: number; max: number } | null,
  reserved: DEFAULT_RESERVED,
  taken: [] as EntrypointPort[],
  selfStreamId: 's1',
  ...over,
});

describe('claimProblem', () => {
  test('0 and out-of-bounds ports are invalid', () => {
    expect(claimProblem(claim(0), [], ctx())).toBe('invalid');
    expect(claimProblem(claim(65536), [], ctx())).toBe('invalid');
    expect(claimProblem(claim(1.5), [], ctx())).toBe('invalid');
  });
  test('a reserved port is reserved', () => {
    expect(claimProblem(claim(19000), [], ctx())).toBe('reserved');
  });
  test('a port outside the template range is out_of_range; no range means no limit', () => {
    expect(claimProblem(claim(80), [], ctx())).toBe('out_of_range');
    expect(claimProblem(claim(80), [], ctx({ range: null }))).toBeNull();
  });
  test('the same port and transport already in the claim set is a duplicate', () => {
    expect(claimProblem(claim(5432), [claim(5432)], ctx())).toBe('duplicate');
  });
  test('the same port on the other transport is not a duplicate', () => {
    expect(claimProblem(claim(5432, 'UDP'), [claim(5432)], ctx())).toBeNull();
  });
  test('a port another stream holds on the same transport is taken', () => {
    expect(claimProblem(claim(9000), [], ctx({ taken: [other(9000)] }))).toBe('taken');
    expect(claimProblem(claim(9000), [], ctx({ taken: [domain(9000)] }))).toBe('taken');
  });
  test('a port taken on the other transport is free', () => {
    expect(claimProblem(claim(9000, 'UDP'), [], ctx({ taken: [other(9000)] }))).toBeNull();
  });
  test('60000/UDP inside the range is fine (no longer reserved)', () => {
    expect(claimProblem(claim(60000, 'UDP'), [], ctx())).toBeNull();
  });
  test("ignores the stream's own claims", () => {
    expect(claimProblem(claim(9000), [], ctx({ taken: [mine(9000)] }))).toBeNull();
  });
});

describe('claimProblemMessage', () => {
  test('copy per problem', () => {
    const c = ctx({ taken: [other(9000)] });
    expect(claimProblemMessage('invalid', claim(0), c)).toBe('Port must be between 1 and 65535');
    expect(claimProblemMessage('reserved', claim(19000), c)).toBe('19000/TCP is reserved');
    expect(claimProblemMessage('out_of_range', claim(80), c)).toBe('Must be within 1000–65535');
    expect(claimProblemMessage('duplicate', claim(53, 'UDP'), c)).toBe('53/UDP is already claimed');
    expect(claimProblemMessage('taken', claim(9000), c)).toBe('9000/TCP is used by Stream cache · route redis');
  });
  test('taken by a domain names the domain', () => {
    expect(claimProblemMessage('taken', claim(443), ctx({ taken: [domain(443)] }))).toBe('443/TCP is used by Domain api');
  });
});

describe('myClaims', () => {
  test("keeps only this stream's own claims, sorted", () => {
    const out = myClaims([other(9001), mine(9002), domain(443), mine(53, 'UDP'), mine(53)], 's1');
    expect(out.map(portLabel)).toEqual(['53/TCP', '53/UDP', '9002/TCP']);
  });
  test('an empty stream id matches nothing', () => {
    expect(myClaims([mine(9000)], '')).toEqual([]);
  });
});

describe('freeClaims', () => {
  const route = (id: string, listenerPort: number, protocol = 'tcp', status = 'active'): StreamRoute => ({
    id,
    name: id,
    protocol,
    status,
    config: { listenerPort },
  });
  const claims = [claim(5432), claim(5433), claim(53, 'UDP')];
  test('claims on the transport that no route uses', () => {
    expect(freeClaims(claims, [route('r1', 5432)], 'TCP')).toEqual([5433]);
  });
  test("the route being edited keeps its own port", () => {
    expect(freeClaims(claims, [route('r1', 5432)], 'TCP', 'r1')).toEqual([5432, 5433]);
  });
  test('UDP with no UDP route and no UDP claim', () => {
    expect(freeClaims([claim(5432), claim(5433)], [route('r1', 5432)], 'UDP')).toEqual([]);
  });
  test('a TCP route does not use the UDP claim of the same number', () => {
    expect(freeClaims([claim(53, 'UDP')], [route('r1', 53, 'tcp')], 'UDP')).toEqual([53]);
  });
  test('a rejected route does not hold its port', () => {
    expect(freeClaims(claims, [route('r1', 5432, 'tcp', 'rejected')], 'TCP')).toEqual([5432, 5433]);
  });
});
