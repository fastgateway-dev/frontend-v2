import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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
jest.mock('@/lib/api/dns-credentials', () => ({ dnsCredentialsApi: { list: jest.fn().mockResolvedValue([]) } }));
import { dnsRecordsApi } from '@/lib/api/dns-records';
import { dnsZonesApi } from '@/lib/api/dns-zones';
import { dnsCredentialsApi } from '@/lib/api/dns-credentials';

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
  (dnsRecordsApi.update as jest.Mock).mockClear();
  (dnsZonesApi.list as jest.Mock).mockResolvedValue([
    { id: 'z1', name: 'example.com', providerCredentialId: 'c1', status: 'ready', createdAt: '', updatedAt: '' },
  ]);
  (dnsCredentialsApi.list as jest.Mock).mockResolvedValue([
    { id: 'c1', name: 'cf', providerType: 'cloudflare', createdAt: '', updatedAt: '' },
  ]);
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

test('edit opens the modal and saves the update', async () => {
  render(<DNSRecordsPage />);
  await waitFor(() => screen.getByText('a.example.com'));
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));

  // modal fields populate from the row + loaded zones
  await waitFor(() => expect(screen.getByLabelText('Record Type')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Record Type'), { target: { value: 'CNAME' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() =>
    expect(dnsRecordsApi.update).toHaveBeenCalledWith('p1', 'd1', {
      hostedZoneId: 'z1',
      recordType: 'CNAME',
      ttl: undefined,
      proxied: false,
    }),
  );
});

test('edit surfaces an error and blocks save when hosted zones fail to load', async () => {
  (dnsZonesApi.list as jest.Mock).mockRejectedValue(new Error('zones down'));
  render(<DNSRecordsPage />);
  await waitFor(() => screen.getByText('a.example.com'));
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));

  await waitFor(() => expect(screen.getByText(/couldn't load hosted zones/i)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  expect(dnsRecordsApi.update).not.toHaveBeenCalled();
});

test('edit disables save while hosted zones are loading', async () => {
  let resolveZones: (v: unknown) => void = () => {};
  (dnsZonesApi.list as jest.Mock).mockReturnValue(new Promise((r) => { resolveZones = r; }));
  render(<DNSRecordsPage />);
  await waitFor(() => screen.getByText('a.example.com'));
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));

  const save = await screen.findByRole('button', { name: /^save$/i });
  expect(save).toBeDisabled(); // still loading zones -> can't know Cloudflare -> can't save

  await act(async () => {
    resolveZones([{ id: 'z1', name: 'example.com', providerCredentialId: 'c1', status: 'ready', createdAt: '', updatedAt: '' }]);
  });
  await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled());
});

test('shows an error when delete fails, keeping the list visible', async () => {
  window.confirm = jest.fn(() => true);
  (dnsRecordsApi.remove as jest.Mock).mockRejectedValue(new Error('nope'));
  render(<DNSRecordsPage />);
  await waitFor(() => screen.getByText('a.example.com'));
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => expect(screen.getByText(/couldn't delete/i)).toBeInTheDocument());
  expect(screen.getByText('a.example.com')).toBeInTheDocument(); // table not replaced by the error
});
