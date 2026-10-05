import { dnsRecordStatusBadge } from './dns';

test('dnsRecordStatusBadge maps ready to success', () => {
  expect(dnsRecordStatusBadge('ready')).toEqual({ label: 'Ready', variant: 'success' });
});
test('dnsRecordStatusBadge maps error to error', () => {
  expect(dnsRecordStatusBadge('error')).toEqual({ label: 'Error', variant: 'error' });
});
test('dnsRecordStatusBadge maps pending to warning', () => {
  expect(dnsRecordStatusBadge('pending')).toEqual({ label: 'Pending', variant: 'warning' });
});
