import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DNSRecordsPage from './page';

jest.mock('next/navigation', () => ({ useParams: () => ({ projectId: 'p1' }) }));
jest.mock('@/lib/api/dns-records', () => ({
  dnsRecordsApi: {
    list: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('@/lib/api/dns-zones', () => ({ dnsZonesApi: { list: jest.fn().mockResolvedValue([]) } }));
import { dnsRecordsApi } from '@/lib/api/dns-records';

const rows = [
  {
    id: 'r1', domainId: 'd1', hostedZoneId: 'z1', recordType: 'A', proxied: false,
    status: 'ready', resolvedTarget: '192.0.2.1', domainHostname: 'a.example.com',
    zoneName: 'example.com', createdAt: '', updatedAt: '',
  },
];

beforeEach(() => {
  (dnsRecordsApi.list as jest.Mock).mockResolvedValue(rows);
  (dnsRecordsApi.remove as jest.Mock).mockClear();
  (dnsRecordsApi.refresh as jest.Mock).mockClear();
});

test('lists records', async () => {
  render(<DNSRecordsPage />);
  await waitFor(() => expect(screen.getByText('a.example.com')).toBeInTheDocument());
  expect(screen.getByText('example.com')).toBeInTheDocument();
  expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
});

test('shows empty state when there are no records', async () => {
  (dnsRecordsApi.list as jest.Mock).mockResolvedValue([]);
  render(<DNSRecordsPage />);
  await waitFor(() => expect(screen.getByText(/no dns records/i)).toBeInTheDocument());
});

test('shows error when list fails', async () => {
  (dnsRecordsApi.list as jest.Mock).mockRejectedValue(new Error('boom'));
  render(<DNSRecordsPage />);
  await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
});

test('delete removes the row', async () => {
  window.confirm = jest.fn(() => true);
  render(<DNSRecordsPage />);
  await waitFor(() => screen.getByText('a.example.com'));
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => expect(dnsRecordsApi.remove).toHaveBeenCalledWith('p1', 'd1'));
});

test('refresh re-fetches', async () => {
  render(<DNSRecordsPage />);
  await waitFor(() => screen.getByText('a.example.com'));
  fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
  await waitFor(() => expect(dnsRecordsApi.refresh).toHaveBeenCalledWith('p1', 'd1'));
});
