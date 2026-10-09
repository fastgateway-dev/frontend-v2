import { render, screen } from '@testing-library/react';
import { DNSRecordFields } from './dns-record-fields';

const base = {
  zoneOptions: [{ value: 'z1', label: 'example.com (Cloudflare)' }],
  hostedZoneId: 'z1',
  onHostedZoneChange: () => {},
  recordType: 'auto' as const,
  onRecordTypeChange: () => {},
  ttl: '',
  onTtlChange: () => {},
  proxied: false,
  onProxiedChange: () => {},
  showProxied: false,
};

test('renders zone, type and ttl; hides proxied unless showProxied', () => {
  const { rerender } = render(<DNSRecordFields {...base} />);
  expect(screen.getByLabelText('Hosted Zone')).toBeInTheDocument();
  expect(screen.getByLabelText('Record Type')).toBeInTheDocument();
  expect(screen.getByLabelText('TTL')).toBeInTheDocument();
  expect(screen.queryByLabelText('Proxied')).not.toBeInTheDocument();

  rerender(<DNSRecordFields {...base} showProxied />);
  expect(screen.getByLabelText('Proxied')).toBeInTheDocument();
});
