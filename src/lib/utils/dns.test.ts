import { dnsRecordStatusBadge } from './dns';

test('dnsRecordStatusBadge maps ready to success', () => {
  expect(dnsRecordStatusBadge('ready')).toEqual({ label: 'Ready', variant: 'success' });
});
test('dnsRecordStatusBadge maps syncing to info', () => {
  expect(dnsRecordStatusBadge('syncing')).toEqual({ label: 'Syncing', variant: 'info' });
});
test('dnsRecordStatusBadge maps error to error', () => {
  expect(dnsRecordStatusBadge('error')).toEqual({ label: 'Error', variant: 'error' });
});
test('dnsRecordStatusBadge maps pending to warning', () => {
  expect(dnsRecordStatusBadge('pending')).toEqual({ label: 'Pending', variant: 'warning' });
});
