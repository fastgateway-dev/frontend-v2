import {
  buildCreateInput,
  buildPolicy,
  emptyPolicyForm,
  findPortCollision,
  parseListenerPort,
  policyCapabilities,
  portInRange,
  rangeError,
} from './l4route';
import type { StreamRoute } from '@/types';

const routes: StreamRoute[] = [
  { id: 'r1', name: 'db', protocol: 'tcp', status: 'active', config: { listenerPort: 5432 } },
  { id: 'r2', name: 'dns', protocol: 'udp', status: 'active', config: { listenerPort: 53 } },
];

describe('policyCapabilities', () => {
  test('tcp gets circuit breaker + LB + health check', () => {
    expect(policyCapabilities('tcp')).toEqual({ loadBalancer: true, circuitBreaker: true, healthCheck: true });
  });
  test('udp gets LB only', () => {
    expect(policyCapabilities('udp')).toEqual({ loadBalancer: true, circuitBreaker: false, healthCheck: false });
  });
});

describe('buildPolicy', () => {
  const full = {
    ...emptyPolicyForm(),
    lbEnabled: true,
    lbType: 'LeastRequest' as const,
    cbEnabled: true,
    cbMaxConnections: '100',
    cbMaxRequestsPerConnection: '10',
    hcEnabled: true,
    hcInterval: '10s',
    hcTimeout: '1s',
  };

  test('tcp includes only maxConnections/maxRequestsPerConnection and a TCP active health check', () => {
    expect(buildPolicy('tcp', full)).toEqual({
      loadBalancer: { type: 'LeastRequest' },
      circuitBreaker: { maxConnections: 100, maxRequestsPerConnection: 10 },
      healthCheck: { active: { type: 'TCP', interval: '10s', timeout: '1s' } },
    });
  });

  test('udp drops circuit breaker and health check even if state was set before switching protocol', () => {
    expect(buildPolicy('udp', full)).toEqual({ loadBalancer: { type: 'LeastRequest' } });
  });

  test('returns undefined when nothing enabled', () => {
    expect(buildPolicy('tcp', emptyPolicyForm())).toBeUndefined();
  });
});

describe('findPortCollision', () => {
  test('same protocol + port collides', () => {
    expect(findPortCollision(routes, 5432, 'tcp')).toMatchObject({ routeName: 'db' });
  });
  test('tcp:53 does not collide with udp:53', () => {
    expect(findPortCollision(routes, 53, 'tcp')).toBeNull();
    expect(findPortCollision(routes, 53, 'udp')).toMatchObject({ routeName: 'dns' });
  });
  test('editing a route does not collide with itself', () => {
    expect(findPortCollision(routes, 5432, 'tcp', 'r1')).toBeNull();
  });
  test('null port never collides', () => {
    expect(findPortCollision(routes, null, 'tcp')).toBeNull();
  });
});

test('parseListenerPort accepts only 1-65535 integers', () => {
  expect(parseListenerPort('5432')).toBe(5432);
  expect(parseListenerPort('0')).toBeNull();
  expect(parseListenerPort('65536')).toBeNull();
  expect(parseListenerPort('80a')).toBeNull();
  expect(parseListenerPort('')).toBeNull();
});

test('buildCreateInput puts listenerPort in config with no L7 fields', () => {
  const input = buildCreateInput('s1', {
    name: 'db',
    description: '',
    teamId: 't1',
    protocol: 'tcp',
    listenerPort: 5432,
    backends: [{ namespace: 'ns', service: 'pg', port: '5432', weight: '100' }],
    policy: emptyPolicyForm(),
  });
  expect(input).toEqual({
    streamId: 's1',
    name: 'db',
    description: undefined,
    protocol: 'tcp',
    teamId: 't1',
    config: {
      matches: [],
      backends: [{ type: 'kubernetes', service: 'pg', namespace: 'ns', port: 5432, weight: 100 }],
      listenerPort: 5432,
    },
  });
});

describe('portInRange / rangeError', () => {
  test('portInRange', () => {
    expect(portInRange(9042, 9000, 9100)).toBe(true);
    expect(portInRange(9000, 9000, 9100)).toBe(true);
    expect(portInRange(9100, 9000, 9100)).toBe(true);
    expect(portInRange(8125, 9000, 9100)).toBe(false);
  });
  test('rangeError is null when in range', () => {
    expect(rangeError(9042, 9000, 9100)).toBeNull();
  });
  test('rangeError mentions both bounds when out of range', () => {
    const msg = rangeError(8125, 9000, 9100);
    expect(msg).toMatch(/9000/);
    expect(msg).toMatch(/9100/);
  });
});
