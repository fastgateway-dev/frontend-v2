import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { L4RouteForm } from './L4RouteForm';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/api', () => ({
  streamsApi: {
    get: jest.fn().mockResolvedValue({ id: 's1', name: 'pg-stream', gatewayTemplateId: 'gt1' }),
    listRoutes: jest.fn().mockResolvedValue({
      data: [{ id: 'r1', name: 'db', protocol: 'tcp', status: 'active', config: { listenerPort: 5432 } }],
    }),
    createRoute: jest.fn(),
    updateRoute: jest.fn(),
    getRoute: jest.fn(),
  },
  domainTemplatesApi: {
    get: jest.fn().mockResolvedValue({
      id: 'gt1',
      listeners: [{ name: 'l4', protocol: 'TCP', portRangeMin: 5000, portRangeMax: 7000 }],
    }),
  },
  projectTeamsApi: { listMyTeams: jest.fn().mockResolvedValue([{ team: { id: 't1', name: 'Team' } }]) },
  projectNamespacesApi: {
    list: jest.fn().mockResolvedValue([{ namespace: 'ns', referenceGrantCreated: true }]),
  },
  kubernetesApi: {
    listServices: jest.fn().mockResolvedValue([{ name: 'pg', namespace: 'ns', ports: [{ name: 'p', port: 5432, protocol: 'TCP' }] }]),
  },
}));
import { streamsApi, domainTemplatesApi } from '@/lib/api';

const renderForm = async () => {
  render(<L4RouteForm projectId="p1" streamId="s1" />);
  await screen.findByLabelText('Name');
  // wait for services to populate the default backend row
  await waitFor(() => expect(screen.getByRole('option', { name: 'pg' })).toBeInTheDocument());
};

const fillValid = (port: string) => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'web' } });
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: port } });
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'pg' } });
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('gates policy sections by protocol', async () => {
  await renderForm();
  expect(screen.getByLabelText('Enable circuit breaker')).toBeInTheDocument();
  expect(screen.getByLabelText('Enable health check')).toBeInTheDocument();
  expect(screen.getByLabelText('Enable load balancer')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: 'UDP' }));
  expect(screen.queryByLabelText('Enable circuit breaker')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Enable health check')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Enable load balancer')).toBeInTheDocument();
});

test('shows a live collision warning for an in-use port and allows tcp/udp on the same port', async () => {
  await renderForm();
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: '5432' } });
  expect(screen.getByTestId('port-collision')).toHaveTextContent('"db"');

  fireEvent.click(screen.getByRole('radio', { name: 'UDP' }));
  expect(screen.queryByTestId('port-collision')).not.toBeInTheDocument();
});

test('blocks submit on a client-side collision', async () => {
  await renderForm();
  fillValid('5432');
  fireEvent.click(screen.getByRole('button', { name: 'Create Route' }));
  expect(await screen.findAllByText(/already used by route "db"/)).not.toHaveLength(0);
  expect(streamsApi.createRoute).not.toHaveBeenCalled();
});

test('submits listenerPort inside config and redirects when there are no warnings', async () => {
  (streamsApi.createRoute as jest.Mock).mockResolvedValue({ id: 'r9', name: 'web' });
  await renderForm();
  fillValid('6379');
  fireEvent.click(screen.getByRole('button', { name: 'Create Route' }));
  await waitFor(() => expect(streamsApi.createRoute).toHaveBeenCalled());
  const [, , body] = (streamsApi.createRoute as jest.Mock).mock.calls[0];
  expect(body.config.listenerPort).toBe(6379);
  expect(body.protocol).toBe('tcp');
  expect(body.config.matches).toEqual([]);
  await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/p1/streams/s1'));
});

test('shows the server 409 inline on the port field', async () => {
  (streamsApi.createRoute as jest.Mock).mockRejectedValue({
    response: { status: 409, data: { error: 'listener port is already in use: TCP/6379' } },
  });
  await renderForm();
  fillValid('6379');
  fireEvent.click(screen.getByRole('button', { name: 'Create Route' }));
  expect(await screen.findByText(/TCP\/6379/)).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

test('renders backend-returned warnings after a successful submit', async () => {
  (streamsApi.createRoute as jest.Mock).mockResolvedValue({ id: 'r9', name: 'web', warnings: ['mixed protocol LB notice'] });
  await renderForm();
  fillValid('6379');
  fireEvent.click(screen.getByRole('button', { name: 'Create Route' }));
  expect(await screen.findByTestId('submit-warnings')).toHaveTextContent('mixed protocol LB notice');
});

test('shows the allowed range and blocks submit for a port outside it', async () => {
  await renderForm();
  expect(screen.getByText(/Allowed range: 5000–7000/)).toBeInTheDocument();

  fillValid('9000');
  fireEvent.click(screen.getByRole('button', { name: 'Create Route' }));
  expect(await screen.findByText('Listener port must be between 5000 and 7000')).toBeInTheDocument();
  expect(streamsApi.createRoute).not.toHaveBeenCalled();
});

test('falls back to the plain port check when the template fetch fails', async () => {
  (domainTemplatesApi.get as jest.Mock).mockRejectedValueOnce(new Error('boom'));
  (streamsApi.createRoute as jest.Mock).mockResolvedValue({ warnings: [] });
  await renderForm();
  expect(screen.queryByText(/Allowed range/)).not.toBeInTheDocument();

  fillValid('9000');
  fireEvent.click(screen.getByRole('button', { name: 'Create Route' }));
  await waitFor(() => expect(streamsApi.createRoute).toHaveBeenCalled());
});
