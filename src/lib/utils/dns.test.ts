import { dnsRecordStatusBadge, matchingZonesFor } from './dns';
import type { DNSHostedZone } from '@/types';

test('dnsRecordStatusBadge maps ready to success', () => {
  expect(dnsRecordStatusBadge('ready')).toEqual({ label: 'Ready', variant: 'success' });
});
test('dnsRecordStatusBadge maps error to error', () => {
  expect(dnsRecordStatusBadge('error')).toEqual({ label: 'Error', variant: 'error' });
});
test('dnsRecordStatusBadge maps pending to warning', () => {
  expect(dnsRecordStatusBadge('pending')).toEqual({ label: 'Pending', variant: 'warning' });
});

function makeZone(id: string, name: string): DNSHostedZone {
  return {
    id,
    name,
    providerCredentialId: 'cred-1',
    status: 'ready',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('matchingZonesFor', () => {
  test('matches an exact apex hostname', () => {
    const zone = makeZone('z1', 'example.com');
    expect(matchingZonesFor('example.com', [zone])).toEqual([zone]);
  });

  test('matches a subdomain of the zone', () => {
    const zone = makeZone('z1', 'example.com');
    expect(matchingZonesFor('api.example.com', [zone])).toEqual([zone]);
  });

  test('excludes a hostname that merely shares the zone name as a non-dot suffix', () => {
    const zone = makeZone('z1', 'example.com');
    expect(matchingZonesFor('notexample.com', [zone])).toEqual([]);
  });

  test('sorts the longest-suffix (most specific) zone first', () => {
    const apex = makeZone('z1', 'example.com');
    const sub = makeZone('z2', 'api.example.com');
    const result = matchingZonesFor('api.example.com', [apex, sub]);
    expect(result.map((z) => z.id)).toEqual(['z2', 'z1']);
  });

  test('matches a deeper subdomain several levels under the zone', () => {
    const zone = makeZone('z1', 'example.com');
    expect(matchingZonesFor('a.b.example.com', [zone])).toEqual([zone]);
  });

  test('returns an empty array for an empty hostname', () => {
    const zone = makeZone('z1', 'example.com');
    expect(matchingZonesFor('', [zone])).toEqual([]);
  });

  test('returns an empty array when no zone matches', () => {
    const zone = makeZone('z1', 'other.com');
    expect(matchingZonesFor('example.com', [zone])).toEqual([]);
  });
});
