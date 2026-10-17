import { approvalContextLabel, diffSectionTitles } from './approval-labels';

test('approvalContextLabel: stream for L4, domain for L7, nothing otherwise', () => {
  expect(approvalContextLabel({ streamName: 'tcp-stream' })).toBe('Stream: tcp-stream');
  expect(approvalContextLabel({ domainName: 'api.example.com' })).toBe('api.example.com');
  expect(approvalContextLabel({ streamName: 'tcp-stream', domainName: 'x' })).toBe('Stream: tcp-stream');
  expect(approvalContextLabel({})).toBeNull();
});

test('diffSectionTitles follow routeKind; older backends default to HTTPRoute', () => {
  expect(diffSectionTitles('TCPRoute')).toEqual({ route: 'TCPRoute Changes', backendTrafficPolicy: 'BackendTrafficPolicy Changes' });
  expect(diffSectionTitles('UDPRoute').route).toBe('UDPRoute Changes');
  expect(diffSectionTitles('GRPCRoute')).toEqual({
    route: 'GRPCRoute Changes',
    backendTrafficPolicy: 'BackendTrafficPolicy Changes (Compression)',
  });
  expect(diffSectionTitles(undefined)).toEqual({
    route: 'HTTPRoute Changes',
    backendTrafficPolicy: 'BackendTrafficPolicy Changes (Compression)',
  });
});
