import {
  buildCreateInput,
  buildPolicy,
  diffMode,
  emptyPolicyForm,
  errorsForTab,
  findPortCollision,
  l4RouteKind,
  l4StatusBadge,
  mergeTabErrors,
  parseListenerPort,
  policyCapabilities,
  policySummary,
  portInRange,
  rangeError,
  routeActions,
  tabErrors,
  tabForErrorKey,
  validateL4Form,
  type L4ValidationInput,
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

describe('form tabs', () => {
  test('tabForErrorKey maps every validation key to its tab', () => {
    expect(['name', 'team', 'port'].map(tabForErrorKey)).toEqual(['basic', 'basic', 'basic']);
    expect(['backends', 'backend-0', 'backend-12'].map(tabForErrorKey)).toEqual(['backends', 'backends', 'backends']);
    expect(tabForErrorKey('cbMaxConnections')).toBe('policy');
  });
  test('tabErrors lists the tabs that hold a non-empty error, in tab order', () => {
    expect(tabErrors({})).toEqual([]);
    expect(tabErrors({ 'backend-1': 'x', port: 'y' })).toEqual(['basic', 'backends']);
    expect(tabErrors({ port: undefined, name: '' })).toEqual([]);
  });
  test('errorsForTab / mergeTabErrors replace only one tab', () => {
    const errs = { name: 'a', 'backend-0': 'b' };
    expect(errorsForTab(errs, 'basic')).toEqual({ name: 'a' });
    expect(mergeTabErrors(errs, 'basic', {})).toEqual({ 'backend-0': 'b' });
    expect(mergeTabErrors(errs, 'backends', { backends: 'c' })).toEqual({ name: 'a', backends: 'c' });
  });
});

describe('validateL4Form (rules unchanged from the form)', () => {
  const ok = (): L4ValidationInput => ({
    isEdit: false,
    name: 'web',
    teamId: 't1',
    protocol: 'tcp',
    port: 6379,
    range: { min: 5000, max: 7000 },
    collision: null,
    backends: [{ namespace: 'ns', service: 'pg', port: '5432', weight: '100' }],
  });
  test('a valid form has no errors', () => {
    expect(validateL4Form(ok())).toEqual({});
  });
  test('create requires name and team; edit does not', () => {
    expect(validateL4Form({ ...ok(), name: ' ', teamId: '' })).toEqual({
      name: 'Name is required',
      team: 'Owner team is required',
    });
    expect(validateL4Form({ ...ok(), isEdit: true, name: '', teamId: '' })).toEqual({});
  });
  test('port: unparseable, then out of range, then collision', () => {
    expect(validateL4Form({ ...ok(), port: null }).port).toBe('Listener port must be an integer between 1 and 65535');
    expect(validateL4Form({ ...ok(), port: 9000 }).port).toBe('Listener port must be between 5000 and 7000');
    expect(validateL4Form({ ...ok(), port: 9000, range: null }).port).toBeUndefined();
    expect(
      validateL4Form({ ...ok(), collision: { routeId: 'r1', routeName: 'db', port: 6379, protocol: 'tcp' } }).port
    ).toBe('Port 6379/TCP is already used by route "db"');
  });
  test('backends: none, incomplete, bad port, bad weight', () => {
    expect(validateL4Form({ ...ok(), backends: [] }).backends).toBe('At least one backend is required');
    const row = ok().backends[0];
    expect(validateL4Form({ ...ok(), backends: [{ ...row, service: '' }] })['backend-0']).toBe(
      'Namespace and service are required'
    );
    expect(validateL4Form({ ...ok(), backends: [{ ...row, port: '70000' }] })['backend-0']).toBe(
      'Backend port must be between 1 and 65535'
    );
    expect(validateL4Form({ ...ok(), backends: [{ ...row, weight: '101' }] })['backend-0']).toBe(
      'Weight must be between 0 and 100'
    );
    expect(validateL4Form({ ...ok(), backends: [{ ...row, weight: '' }] })).toEqual({});
  });
});

test('l4RouteKind', () => {
  expect(l4RouteKind('tcp')).toBe('TCPRoute');
  expect(l4RouteKind('UDP')).toBe('UDPRoute');
});

test('diffMode', () => {
  expect(diffMode(undefined, 'a')).toBe('create');
  expect(diffMode('a', 'b')).toBe('update');
  expect(diffMode('a', '')).toBe('delete');
  expect(diffMode('', undefined)).toBeNull();
});

test('l4StatusBadge', () => {
  expect(l4StatusBadge('active')).toEqual({ variant: 'success', label: 'Active' });
  expect(l4StatusBadge('approved')).toEqual({ variant: 'info', label: 'Approved - Ready to Deploy' });
  expect(l4StatusBadge('pending_deploy')).toEqual({ variant: 'info', label: 'Pending Deploy' });
  expect(l4StatusBadge('pending_update')).toEqual({ variant: 'warning', label: 'Pending Approval' });
  expect(l4StatusBadge('pending')).toEqual({ variant: 'warning', label: 'Pending' });
  expect(l4StatusBadge('rejected')).toEqual({ variant: 'error', label: 'Rejected' });
  expect(l4StatusBadge('error')).toEqual({ variant: 'error', label: 'Error' });
  expect(l4StatusBadge('weird')).toEqual({ variant: 'default', label: 'weird' });
});

test('routeActions mirrors the HTTP route detail gates', () => {
  expect(routeActions('active', true)).toEqual({ canEdit: true, canDelete: true, canDeploy: false, awaitingApproval: false });
  expect(routeActions('active', false)).toEqual({ canEdit: false, canDelete: false, canDeploy: false, awaitingApproval: false });
  expect(routeActions('pending_update', true)).toEqual({ canEdit: false, canDelete: false, canDeploy: false, awaitingApproval: true });
  expect(routeActions('approved', true)).toEqual({ canEdit: false, canDelete: false, canDeploy: true, awaitingApproval: false });
  expect(routeActions('pending_deploy', false).canDeploy).toBe(true);
  expect(routeActions('rejected', true)).toEqual({ canEdit: true, canDelete: true, canDeploy: false, awaitingApproval: false });
});

test('policySummary', () => {
  expect(policySummary(undefined)).toEqual([]);
  expect(
    policySummary({
      loadBalancer: { type: 'LeastRequest' },
      circuitBreaker: { maxConnections: 100, maxRequestsPerConnection: 10 },
      healthCheck: { active: { type: 'TCP', interval: '10s', timeout: '1s', unhealthyThreshold: 3, healthyThreshold: 2 } },
    })
  ).toEqual([
    'Load balancing: LeastRequest',
    'Circuit breaker: max 100 connections, max 10 requests per connection',
    'Health check: TCP active, every 10s, timeout 1s, unhealthy after 3, healthy after 2',
  ]);
  expect(policySummary({ circuitBreaker: {} })).toEqual(['Circuit breaker: defaults']);
});
