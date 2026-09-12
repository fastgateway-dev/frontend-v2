import { render, screen, fireEvent } from '@testing-library/react';
import { IPAuditTab } from './IPAuditTab';

const ips = [
  { cidr: '10.0.0.0/24', source: 'route' as const, sourceRef: { id: 'r1', name: 'route-1' },
    reach: { routeIds: ['r1'], domainIds: ['d1'] }, updatedAt: '2026-05-09T00:00:00Z' },
  { cidr: '10.0.0.0/24', source: 'client' as const, sourceRef: { id: 'c1', name: 'client-1' },
    reach: { routeIds: ['r1', 'r2'], domainIds: ['d1', 'd2'] }, updatedAt: '2026-05-09T00:00:00Z' },
];
const domains = [
  { id: 'd1', name: 'domA' } as any, { id: 'd2', name: 'domB' } as any,
];

test('renders one row per IP source', () => {
  render(<IPAuditTab ips={ips} domains={domains} onRowClick={() => {}} />);
  expect(screen.getAllByText('10.0.0.0/24')).toHaveLength(2);
});

test('"Reaching multiple domains" stat counts and filters', () => {
  render(<IPAuditTab ips={ips} domains={domains} onRowClick={() => {}} />);
  expect(screen.getByTestId('stat-multi-domain').textContent).toContain('1');
  fireEvent.click(screen.getByTestId('stat-multi-domain'));
  expect(screen.queryByText('route-1')).toBeNull();
  expect(screen.getByText('client-1')).toBeInTheDocument();
});

test('source filter narrows to client', () => {
  render(<IPAuditTab ips={ips} domains={domains} onRowClick={() => {}} />);
  fireEvent.change(screen.getByLabelText(/source/i), { target: { value: 'client' } });
  expect(screen.queryByText('route-1')).toBeNull();
  expect(screen.getByText('client-1')).toBeInTheDocument();
});
