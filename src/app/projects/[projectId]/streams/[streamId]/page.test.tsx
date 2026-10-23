import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import StreamDetailPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'p1', streamId: 's1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  streamsApi: {
    get: jest.fn().mockResolvedValue({
      id: 's1', projectId: 'p1', name: 'pg', namespace: 'ns', status: 'active',
      k8sGatewayName: 'gw', k8sGatewayClass: 'gc',
      ports: [{ transport: 'TCP', port: 5432 }],
    }),
    update: jest.fn(),
    listRoutes: jest.fn().mockResolvedValue({
      data: [
        { id: 'r1', name: 'db', protocol: 'tcp', status: 'active', config: { listenerPort: 5432 }, team: { id: 't1', name: 'Team A' } },
        { id: 'r2', name: 'dns', protocol: 'udp', status: 'approved', config: { listenerPort: 53 } },
      ],
    }),
    delete: jest.fn(),
    deployRoute: jest.fn().mockResolvedValue({}),
    getEntrypoint: jest.fn().mockResolvedValue({
      mode: 'dedicated', templateId: 't1', templateName: 'edge-l4', gatewayClass: 'gc', address: '10.0.0.9',
      portRange: { min: 1, max: 65535 }, sharedWith: { streams: [], domains: [] }, ports: [], reserved: [],
    }),
    getYamls: jest.fn().mockResolvedValue({ gatewayYaml: 'kind: Gateway', routes: [] }),
    getMetrics: jest.fn().mockRejectedValue({ response: { status: 400, data: { error: 'not configured' } } }),
  },
  permissionsApi: {
    getProjectPermissions: jest.fn().mockResolvedValue({ canManageDomains: true, canCreateRoutes: true }),
  },
}));
import { streamsApi } from '@/lib/api';

beforeEach(() => jest.clearAllMocks());

test('replaces the LB address and ports cards with the Entry point panel', async () => {
  render(<StreamDetailPage />);
  await waitFor(() => expect(screen.getByTestId('entrypoint-panel')).toHaveTextContent('Dedicated IP'));
  expect(screen.getByTestId('entrypoint-panel')).toHaveTextContent('10.0.0.9');
  expect(streamsApi.getEntrypoint).toHaveBeenCalledWith('p1', 's1');
  expect(screen.queryByText('Load Balancer Address')).not.toBeInTheDocument();
  expect(screen.queryByTestId('ports-in-use')).not.toBeInTheDocument();
});

test('Routes tab links each route to its detail page, shows the owner team and keeps quick Deploy', async () => {
  render(<StreamDetailPage />);
  const link = await screen.findByRole('link', { name: 'db' });
  expect(link).toHaveAttribute('href', '/projects/p1/streams/s1/routes/r1');
  expect(screen.getByText('Team A')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Deploy' }));
  await waitFor(() => expect(streamsApi.deployRoute).toHaveBeenCalledWith('p1', 's1', 'r2'));
  await waitFor(() => expect(streamsApi.getEntrypoint).toHaveBeenCalledTimes(2));
});

test('Metrics and Manifests are tabs that load on open', async () => {
  render(<StreamDetailPage />);
  await screen.findByRole('link', { name: 'db' });
  expect(streamsApi.getYamls).not.toHaveBeenCalled();
  expect(streamsApi.getMetrics).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Manifests' }));
  expect(await screen.findByText('kind: Gateway')).toBeInTheDocument();
  expect(streamsApi.getYamls).toHaveBeenCalledWith('p1', 's1');
  fireEvent.click(screen.getByRole('tab', { name: 'Metrics' }));
  await waitFor(() => expect(streamsApi.getMetrics).toHaveBeenCalled());
});

test('surfaces the 409 remove-routes-first error on delete', async () => {
  (streamsApi.delete as jest.Mock).mockRejectedValue({
    response: { data: { error: 'stream still has routes; remove them first' } },
  });
  render(<StreamDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Delete/ }));
  const buttons = await screen.findAllByRole('button', { name: 'Delete' });
  fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() => expect(screen.getByText(/remove them first/i)).toBeInTheDocument());
});

test('Edit ports is offered only to users who can manage domains', async () => {
  const { permissionsApi } = jest.requireMock('@/lib/api');
  render(<StreamDetailPage />);
  expect(await screen.findByRole('button', { name: 'Edit ports' })).toBeInTheDocument();
  cleanup();
  permissionsApi.getProjectPermissions.mockResolvedValueOnce({ canManageDomains: false, canCreateRoutes: true });
  render(<StreamDetailPage />);
  await screen.findByRole('link', { name: 'db' });
  expect(screen.queryByRole('button', { name: 'Edit ports' })).not.toBeInTheDocument();
});

test('saving ports refreshes the entry point panel and the Manifests tab', async () => {
  (streamsApi.update as jest.Mock).mockResolvedValue({
    id: 's1', projectId: 'p1', name: 'pg', namespace: 'ns', status: 'active',
    ports: [{ transport: 'TCP', port: 5432 }, { transport: 'TCP', port: 6000 }],
  });
  render(<StreamDetailPage />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Manifests' }));
  await screen.findByText('kind: Gateway');
  expect(streamsApi.getYamls).toHaveBeenCalledTimes(1);
  expect(streamsApi.getEntrypoint).toHaveBeenCalledTimes(1);

  fireEvent.click(await screen.findByRole('button', { name: 'Edit ports' }));
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '6000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(streamsApi.update).toHaveBeenCalledWith('p1', 's1', {
      ports: [{ transport: 'TCP', port: 5432 }, { transport: 'TCP', port: 6000 }],
    })
  );
  await waitFor(() => expect(streamsApi.getEntrypoint).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(streamsApi.getYamls).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
});

test('Edit ports still works when the entry point fails to load', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockRejectedValue({ response: { status: 500, data: { error: 'template lookup failed' } } });
  (streamsApi.update as jest.Mock).mockResolvedValue({
    id: 's1', projectId: 'p1', name: 'pg', namespace: 'ns', status: 'active',
    ports: [{ transport: 'TCP', port: 5432 }, { transport: 'UDP', port: 53 }],
  });
  render(<StreamDetailPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('template lookup failed');
  const button = screen.getByRole('button', { name: 'Edit ports' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  // Seeded from stream.ports even though there is no entry point to lock or validate against.
  expect(screen.getAllByTestId('port-claim-chip')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Remove 5432/TCP' })).toBeEnabled();
  fireEvent.click(screen.getByLabelText('UDP'));
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '53' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(streamsApi.update).toHaveBeenCalledWith('p1', 's1', {
      ports: [{ transport: 'UDP', port: 53 }, { transport: 'TCP', port: 5432 }],
    })
  );
});
