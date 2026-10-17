import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import L4RouteDetailPage from './page';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'p1', streamId: 's1', routeId: 'r1' }),
  useRouter: () => ({ push }),
}));
jest.mock('@/lib/api', () => ({
  streamsApi: {
    get: jest.fn(),
    getRoute: jest.fn(),
    deployRoute: jest.fn(),
    deleteRoute: jest.fn(),
    previewDeleteRoute: jest.fn(),
    getRouteYamls: jest.fn(),
    listRouteVersions: jest.fn(),
    getRouteVersion: jest.fn(),
    rollbackRouteVersion: jest.fn(),
  },
  permissionsApi: { getProjectPermissions: jest.fn() },
}));
import { streamsApi, permissionsApi } from '@/lib/api';

const ROUTE = {
  id: 'r1', streamId: 's1', teamId: 't1', team: { id: 't1', name: 'Team A' },
  name: 'db', description: 'Postgres primary', protocol: 'tcp', securityMode: 'general', status: 'active',
  config: { matches: [], listenerPort: 5432, backends: [{ type: 'kubernetes', namespace: 'data', service: 'pg', port: 5432, weight: 100 }] },
  backendTrafficPolicy: { id: 'b1', projectId: 'p1', config: { loadBalancer: { type: 'LeastRequest' } }, createdAt: '', updatedAt: '' },
  createdBy: 'u1', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z',
};
const version = (n: number) => ({
  id: `v${n}`, routeId: 'r1', version: n, configSnapshot: { routeConfig: { listenerPort: 5432 } },
  routeDescription: '', protocol: 'tcp', securityMode: 'general', changeDescription: '',
  deployedBy: 'u1', createdAt: '2026-10-01T00:00:00Z',
});

beforeEach(() => {
  jest.resetAllMocks();
  (streamsApi.get as jest.Mock).mockResolvedValue({ id: 's1', name: 'pg-stream' });
  (streamsApi.getRoute as jest.Mock).mockResolvedValue(ROUTE);
  (permissionsApi.getProjectPermissions as jest.Mock).mockResolvedValue({ canCreateRoutes: true });
  (streamsApi.getRouteYamls as jest.Mock).mockResolvedValue({
    httpRouteYaml: 'kind: TCPRoute\nname: db',
    backendTrafficPolicyYaml: 'kind: BackendTrafficPolicy\nname: db',
  });
  (streamsApi.previewDeleteRoute as jest.Mock).mockResolvedValue({ currentYaml: 'kind: TCPRoute\nname: db' });
  (streamsApi.deleteRoute as jest.Mock).mockResolvedValue({});
  (streamsApi.deployRoute as jest.Mock).mockResolvedValue({});
  (streamsApi.listRouteVersions as jest.Mock).mockResolvedValue({ data: [version(2), version(1)], total: 2, page: 1, limit: 20 });
  (streamsApi.rollbackRouteVersion as jest.Mock).mockResolvedValue({});
});

test('shows the header, actions and the Overview tab', async () => {
  render(<L4RouteDetailPage />);
  expect(await screen.findByRole('heading', { name: 'db' })).toBeInTheDocument();
  expect(screen.getByText('TCP')).toBeInTheDocument();
  expect(screen.getByText(':5432')).toBeInTheDocument();
  expect(screen.getByText('Active')).toBeInTheDocument();
  expect(screen.getByText(/Owner: Team A/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to pg-stream' })).toHaveAttribute('href', '/projects/p1/streams/s1');
  expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/projects/p1/streams/s1/routes/r1/edit');
  expect(screen.getByText('Postgres primary')).toBeInTheDocument();
  expect(screen.getByTestId('backends-table')).toHaveTextContent('pg');
  expect(screen.getByTestId('policy-summary')).toHaveTextContent('Load balancing: LeastRequest');
  expect(screen.queryByTestId('approval-banner')).not.toBeInTheDocument();
});

test('a pending route shows the approval banner and hides Edit/Delete', async () => {
  (streamsApi.getRoute as jest.Mock).mockResolvedValue({ ...ROUTE, status: 'pending_update' });
  render(<L4RouteDetailPage />);
  expect(await screen.findByText('Waiting for approval')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review in Approvals' })).toHaveAttribute('href', '/projects/p1/approvals');
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});

test('Deploy is offered for an approved route', async () => {
  (streamsApi.getRoute as jest.Mock).mockResolvedValue({ ...ROUTE, status: 'approved' });
  render(<L4RouteDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Deploy' }));
  await waitFor(() => expect(streamsApi.deployRoute).toHaveBeenCalledWith('p1', 's1', 'r1'));
});

test('Manifests tab shows the TCPRoute and its BackendTrafficPolicy', async () => {
  render(<L4RouteDetailPage />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Manifests' }));
  expect(await screen.findByText(/kind: TCPRoute/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'TCPRoute' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'BackendTrafficPolicy' })).toBeInTheDocument();
  expect(streamsApi.getRouteYamls).toHaveBeenCalledWith('p1', 's1', 'r1');
});

test('Delete shows the preview-delete diff, then submits the delete request', async () => {
  render(<L4RouteDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('kind: TCPRoute')).toBeInTheDocument();
  expect(streamsApi.previewDeleteRoute).toHaveBeenCalledWith('p1', 's1', 'r1');
  fireEvent.click(screen.getByRole('button', { name: 'Submit Delete Request' }));
  await waitFor(() => expect(streamsApi.deleteRoute).toHaveBeenCalledWith('p1', 's1', 'r1'));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/p1/streams/s1'));
});

test('a failed delete preview still lets the user submit', async () => {
  (streamsApi.previewDeleteRoute as jest.Mock).mockRejectedValue({ response: { data: { error: 'boom' } } });
  render(<L4RouteDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByTestId('delete-preview-error')).toHaveTextContent('boom');
  fireEvent.click(screen.getByRole('button', { name: 'Submit Delete Request' }));
  await waitFor(() => expect(streamsApi.deleteRoute).toHaveBeenCalled());
});

test('History rollback goes to Approvals', async () => {
  render(<L4RouteDetailPage />);
  fireEvent.click(await screen.findByRole('tab', { name: 'History' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Rollback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Rollback' }));
  await waitFor(() => expect(streamsApi.rollbackRouteVersion).toHaveBeenCalledWith('p1', 's1', 'r1', 1));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/p1/approvals'));
});

test('a route from another stream (404) shows not found', async () => {
  (streamsApi.getRoute as jest.Mock).mockRejectedValue({ response: { status: 404, data: { error: 'route not found' } } });
  render(<L4RouteDetailPage />);
  expect(await screen.findByText('route not found')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Stream' })).toHaveAttribute('href', '/projects/p1/streams/s1');
});
