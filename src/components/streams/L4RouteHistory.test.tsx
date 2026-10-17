import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { L4RouteHistory } from './L4RouteHistory';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/api', () => ({
  streamsApi: { listRouteVersions: jest.fn(), getRouteVersion: jest.fn(), rollbackRouteVersion: jest.fn() },
}));
import { streamsApi } from '@/lib/api';

const version = (n: number) => ({
  id: `v${n}`,
  routeId: 'r1',
  version: n,
  configSnapshot: { routeConfig: { matches: [], backends: [], listenerPort: 5431 + n } },
  routeDescription: '',
  protocol: 'tcp',
  securityMode: 'general',
  changeDescription: `change ${n}`,
  deployedBy: 'u1',
  deployer: { id: 'u1', username: 'alice', email: 'a@example.com' },
  createdAt: '2026-10-01T00:00:00Z',
});

beforeEach(() => {
  jest.resetAllMocks();
  (streamsApi.listRouteVersions as jest.Mock).mockResolvedValue({ data: [version(3), version(2), version(1)], total: 3, page: 1, limit: 20 });
  (streamsApi.getRouteVersion as jest.Mock).mockImplementation((_p: string, _s: string, _r: string, n: number) =>
    Promise.resolve(version(n))
  );
  (streamsApi.rollbackRouteVersion as jest.Mock).mockResolvedValue({});
});

const renderHistory = (routeStatus = 'active') =>
  render(<L4RouteHistory projectId="p1" streamId="s1" routeId="r1" routeStatus={routeStatus} />);

test('lists versions newest first, marks current and offers rollback only on older ones', async () => {
  renderHistory();
  expect(await screen.findByTestId('version-v3')).toHaveTextContent('current');
  expect(streamsApi.listRouteVersions).toHaveBeenCalledWith('p1', 's1', 'r1', 1);
  expect(screen.getAllByRole('button', { name: 'Rollback' })).toHaveLength(2);
  expect(screen.getByTestId('version-v2')).toHaveTextContent('Deployed by alice');
});

test('compares two selected versions in VersionCompareModal', async () => {
  renderHistory();
  await screen.findByTestId('version-v3');
  fireEvent.click(screen.getByLabelText('Select v3'));
  fireEvent.click(screen.getByLabelText('Select v1'));
  fireEvent.click(screen.getByRole('button', { name: 'Compare v1 → v3' }));
  await waitFor(() => expect(streamsApi.getRouteVersion).toHaveBeenCalledTimes(2));
  expect(streamsApi.getRouteVersion).toHaveBeenCalledWith('p1', 's1', 'r1', 1);
  expect(streamsApi.getRouteVersion).toHaveBeenCalledWith('p1', 's1', 'r1', 3);
  expect(await screen.findByText(/Comparing v1/)).toBeInTheDocument();
});

test('rollback confirms, then redirects to Approvals', async () => {
  renderHistory();
  await screen.findByTestId('version-v3');
  fireEvent.click(within(screen.getByTestId('version-v1')).getByRole('button', { name: 'Rollback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Rollback' }));
  await waitFor(() => expect(streamsApi.rollbackRouteVersion).toHaveBeenCalledWith('p1', 's1', 'r1', 1));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/p1/approvals'));
});

test('a failed rollback stays on the page with the error', async () => {
  (streamsApi.rollbackRouteVersion as jest.Mock).mockRejectedValue({ response: { data: { error: 'route has a pending approval' } } });
  renderHistory();
  await screen.findByTestId('version-v3');
  fireEvent.click(within(screen.getByTestId('version-v1')).getByRole('button', { name: 'Rollback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Rollback' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('route has a pending approval');
  expect(push).not.toHaveBeenCalled();
});

test('no rollback for a route that is not active', async () => {
  renderHistory('pending_update');
  await screen.findByTestId('version-v3');
  expect(screen.queryByRole('button', { name: 'Rollback' })).not.toBeInTheDocument();
});

test('empty history explains when versions appear', async () => {
  (streamsApi.listRouteVersions as jest.Mock).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
  renderHistory();
  expect(await screen.findByText(/No version history yet/)).toBeInTheDocument();
});
