import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { L4RouteForm } from './L4RouteForm';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/api', () => ({
  streamsApi: {
    get: jest.fn(),
    listRoutes: jest.fn(),
    createRoute: jest.fn(),
    updateRoute: jest.fn(),
    getRoute: jest.fn(),
    previewCreateRoute: jest.fn(),
    previewUpdateRoute: jest.fn(),
  },
  domainTemplatesApi: { get: jest.fn() },
  projectTeamsApi: { listMyTeams: jest.fn() },
  projectNamespacesApi: { list: jest.fn() },
  kubernetesApi: { listServices: jest.fn() },
}));
import { streamsApi, domainTemplatesApi, projectTeamsApi, projectNamespacesApi, kubernetesApi } from '@/lib/api';

const ROUTE = {
  id: 'r1', name: 'db', description: 'pg', teamId: 't1', protocol: 'tcp', status: 'active',
  config: { matches: [], listenerPort: 5432, backends: [{ type: 'kubernetes', namespace: 'ns', service: 'pg', port: 5432, weight: 100 }] },
};

beforeEach(() => {
  jest.resetAllMocks();
  (streamsApi.get as jest.Mock).mockResolvedValue({ id: 's1', name: 'pg-stream', gatewayTemplateId: 'gt1' });
  (streamsApi.listRoutes as jest.Mock).mockResolvedValue({
    data: [{ id: 'r1', name: 'db', protocol: 'tcp', status: 'active', config: { listenerPort: 5432 } }],
  });
  (streamsApi.getRoute as jest.Mock).mockResolvedValue(ROUTE);
  (streamsApi.previewCreateRoute as jest.Mock).mockResolvedValue({ proposedYaml: 'kind: TCPRoute\nname: web' });
  (streamsApi.previewUpdateRoute as jest.Mock).mockResolvedValue({
    currentYaml: 'kind: TCPRoute\nport: 5432',
    proposedYaml: 'kind: TCPRoute\nport: 5433',
  });
  (domainTemplatesApi.get as jest.Mock).mockResolvedValue({
    id: 'gt1',
    listeners: [{ name: 'l4', protocol: 'TCP', portRangeMin: 5000, portRangeMax: 7000 }],
  });
  (projectTeamsApi.listMyTeams as jest.Mock).mockResolvedValue([{ team: { id: 't1', name: 'Team' } }]);
  (projectNamespacesApi.list as jest.Mock).mockResolvedValue([{ namespace: 'ns', referenceGrantCreated: true }]);
  (kubernetesApi.listServices as jest.Mock).mockResolvedValue([
    { name: 'pg', namespace: 'ns', ports: [{ name: 'p', port: 5432, protocol: 'TCP' }] },
  ]);
});

const tab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

const renderCreate = async () => {
  render(<L4RouteForm projectId="p1" streamId="s1" />);
  await screen.findByLabelText('Name');
  await waitFor(() => expect(kubernetesApi.listServices).toHaveBeenCalledWith('p1', 'ns'));
};

// Fills Basic Info, then picks the backend service; ends on the Backends tab.
const fillValid = async (port: string) => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'web' } });
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: port } });
  tab(/^Backends/);
  await screen.findByRole('option', { name: 'pg' });
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'pg' } });
};

const submitFromPreview = async (label = 'Create Route') => {
  tab(/^Preview/);
  await waitFor(() => expect(screen.queryByText('Generating preview…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: label }));
};

test('lays the form out in four tabs and starts on Basic Info', async () => {
  await renderCreate();
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Basic Info', 'Backends', 'Traffic Policy', 'Preview']);
  expect(screen.getByLabelText('Listener Port')).toBeInTheDocument();
  expect(screen.queryByLabelText('Service')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Enable load balancer')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create Route' })).not.toBeInTheDocument();
});

test('gates policy sections by protocol', async () => {
  await renderCreate();
  tab(/^Traffic Policy/);
  expect(screen.getByLabelText('Enable circuit breaker')).toBeInTheDocument();
  expect(screen.getByLabelText('Enable health check')).toBeInTheDocument();
  expect(screen.getByLabelText('Enable load balancer')).toBeInTheDocument();
  tab(/^Basic Info/);
  fireEvent.click(screen.getByRole('radio', { name: 'UDP' }));
  tab(/^Traffic Policy/);
  expect(screen.queryByLabelText('Enable circuit breaker')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Enable health check')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Enable load balancer')).toBeInTheDocument();
  expect(screen.getByTestId('udp-policy-note')).toBeInTheDocument();
});

test('shows a live collision warning for an in-use port and allows tcp/udp on the same port', async () => {
  await renderCreate();
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: '5432' } });
  expect(screen.getByTestId('port-collision')).toHaveTextContent('"db"');
  fireEvent.click(screen.getByRole('radio', { name: 'UDP' }));
  expect(screen.queryByTestId('port-collision')).not.toBeInTheDocument();
});

test('Next checks only the current tab, then advances; Back returns', async () => {
  await renderCreate();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('Name is required')).toBeInTheDocument();
  expect(screen.getByLabelText('Listener Port')).toBeInTheDocument();
  expect(screen.getByTestId('tab-error-basic')).toBeInTheDocument();
  expect(screen.queryByTestId('tab-error-backends')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'web' } });
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: '6379' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByLabelText('Service')).toBeInTheDocument();
  expect(screen.queryByTestId('tab-error-basic')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Name')).toHaveValue('web');
});

// Review Focus: the Next -> submit button swap must not submit the form.
// In a browser, React commits before the click's default action, so if the
// two buttons shared a DOM node the same click would submit. jsdom runs the
// default action first and cannot show that, so the guard is asserted
// directly: the submit button must be a different node from Next (distinct
// React keys), never Next re-typed in place.
test('stepping into Preview with Next does not submit the form', async () => {
  (streamsApi.createRoute as jest.Mock).mockResolvedValue({ id: 'r9' });
  await renderCreate();
  await fillValid('6379');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByLabelText('Enable load balancer')).toBeInTheDocument();
  const next = screen.getByRole('button', { name: 'Next' });
  fireEvent.click(next);
  expect(await screen.findByText('kind: TCPRoute')).toBeInTheDocument();
  const submit = screen.getByRole('button', { name: 'Create Route' });
  expect(submit).not.toBe(next);
  expect(next).not.toBeInTheDocument();
  expect(streamsApi.createRoute).not.toHaveBeenCalled();
});

test('blocks submit on a client-side collision and returns to Basic Info', async () => {
  await renderCreate();
  await fillValid('5432');
  await submitFromPreview();
  expect(await screen.findAllByText(/already used by route "db"/)).not.toHaveLength(0);
  expect(screen.getByTestId('tab-error-basic')).toBeInTheDocument();
  expect(streamsApi.createRoute).not.toHaveBeenCalled();
});

test('a submit with an incomplete backend jumps to Backends and flags it', async () => {
  await renderCreate();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'web' } });
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: '6379' } });
  await submitFromPreview();
  expect(await screen.findByText('Namespace and service are required')).toBeInTheDocument();
  expect(screen.getByTestId('tab-error-backends')).toBeInTheDocument();
  expect(screen.queryByTestId('tab-error-basic')).not.toBeInTheDocument();
  expect(streamsApi.createRoute).not.toHaveBeenCalled();
});

test('submits listenerPort inside config and returns to the stream', async () => {
  (streamsApi.createRoute as jest.Mock).mockResolvedValue({ id: 'r9', name: 'web' });
  await renderCreate();
  await fillValid('6379');
  await submitFromPreview();
  await waitFor(() => expect(streamsApi.createRoute).toHaveBeenCalled());
  const [, , body] = (streamsApi.createRoute as jest.Mock).mock.calls[0];
  expect(body.config.listenerPort).toBe(6379);
  expect(body.protocol).toBe('tcp');
  expect(body.config.matches).toEqual([]);
  await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/p1/streams/s1'));
});

test('shows the server 409 on the port field back on Basic Info', async () => {
  (streamsApi.createRoute as jest.Mock).mockRejectedValue({
    response: { status: 409, data: { error: 'listener port is already in use: TCP/6379' } },
  });
  await renderCreate();
  await fillValid('6379');
  await submitFromPreview();
  expect(await screen.findByText(/TCP\/6379/)).toBeInTheDocument();
  expect(screen.getByLabelText('Listener Port')).toBeInTheDocument();
  expect(screen.getByTestId('tab-error-basic')).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

test('shows the allowed range and blocks submit for a port outside it', async () => {
  await renderCreate();
  expect(screen.getByText(/Allowed range: 5000–7000/)).toBeInTheDocument();
  await fillValid('9000');
  await submitFromPreview();
  expect(await screen.findByText('Listener port must be between 5000 and 7000')).toBeInTheDocument();
  expect(streamsApi.createRoute).not.toHaveBeenCalled();
});

test('falls back to the plain port check when the template fetch fails', async () => {
  (domainTemplatesApi.get as jest.Mock).mockRejectedValueOnce(new Error('boom'));
  (streamsApi.createRoute as jest.Mock).mockResolvedValue({ warnings: [] });
  await renderCreate();
  expect(screen.queryByText(/Allowed range/)).not.toBeInTheDocument();
  await fillValid('9000');
  await submitFromPreview();
  await waitFor(() => expect(streamsApi.createRoute).toHaveBeenCalled());
});

test('Preview renders the proposed route and BackendTrafficPolicy from the server', async () => {
  (streamsApi.previewCreateRoute as jest.Mock).mockResolvedValue({
    proposedYaml: 'kind: TCPRoute\nname: web',
    proposedBackendTrafficPolicyYaml: 'kind: BackendTrafficPolicy\nname: web',
  });
  await renderCreate();
  await fillValid('6379');
  tab(/^Preview/);
  expect(await screen.findByText('kind: TCPRoute')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'TCPRoute' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'BackendTrafficPolicy' })).toBeInTheDocument();
  expect(screen.getByText('kind: BackendTrafficPolicy')).toBeInTheDocument();
  const [p, s, body] = (streamsApi.previewCreateRoute as jest.Mock).mock.calls[0];
  expect([p, s]).toEqual(['p1', 's1']);
  expect(body).toMatchObject({ streamId: 's1', name: 'web', protocol: 'tcp', teamId: 't1', config: { listenerPort: 6379, matches: [] } });
});

test('a UDP route previews as UDPRoute', async () => {
  (streamsApi.previewCreateRoute as jest.Mock).mockResolvedValue({ proposedYaml: 'kind: UDPRoute' });
  await renderCreate();
  fireEvent.click(screen.getByRole('radio', { name: 'UDP' }));
  await fillValid('6379');
  tab(/^Preview/);
  expect(await screen.findByRole('heading', { name: 'UDPRoute' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'BackendTrafficPolicy' })).not.toBeInTheDocument();
});

test('Preview shows a server 400/409 inline', async () => {
  (streamsApi.previewCreateRoute as jest.Mock).mockRejectedValue({
    response: { status: 409, data: { error: 'listener port is already in use: TCP/6379' } },
  });
  await renderCreate();
  await fillValid('6379');
  tab(/^Preview/);
  expect(await screen.findByTestId('preview-error')).toHaveTextContent('listener port is already in use: TCP/6379');
  expect(streamsApi.createRoute).not.toHaveBeenCalled();
});

test('Preview asks for a listener port instead of calling the server', async () => {
  await renderCreate();
  tab(/^Preview/);
  expect(await screen.findByTestId('preview-error')).toHaveTextContent('Enter a listener port');
  expect(streamsApi.previewCreateRoute).not.toHaveBeenCalled();
});

// Review Focus: a slow earlier preview must not overwrite a newer one.
test('ignores a stale preview response after the form changed', async () => {
  let resolveFirst: (v: unknown) => void = () => {};
  (streamsApi.previewCreateRoute as jest.Mock)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ proposedYaml: 'kind: TCPRoute\nport: 6380' });
  await renderCreate();
  await fillValid('6379');
  tab(/^Preview/);
  tab(/^Basic Info/);
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: '6380' } });
  tab(/^Preview/);
  expect(await screen.findByText('port: 6380')).toBeInTheDocument();
  await act(async () => {
    resolveFirst({ proposedYaml: 'kind: TCPRoute\nport: 6379' });
  });
  expect(screen.queryByText('port: 6379')).not.toBeInTheDocument();
  expect(screen.getByText('port: 6380')).toBeInTheDocument();
});

test('edit previews the update diff and returns to the route detail page', async () => {
  (streamsApi.updateRoute as jest.Mock).mockResolvedValue({ id: 'r1' });
  render(<L4RouteForm projectId="p1" streamId="s1" routeId="r1" />);
  expect(await screen.findByLabelText('Name')).toHaveValue('db');
  expect(screen.getByRole('link', { name: /Back to Route/ })).toHaveAttribute('href', '/projects/p1/streams/s1/routes/r1');
  fireEvent.change(screen.getByLabelText('Listener Port'), { target: { value: '5433' } });
  tab(/^Preview/);
  expect(await screen.findByText('port: 5433')).toBeInTheDocument();
  expect(screen.getByText('port: 5432')).toBeInTheDocument();
  expect(streamsApi.previewUpdateRoute).toHaveBeenCalledWith(
    'p1', 's1', 'r1', expect.objectContaining({ config: expect.objectContaining({ listenerPort: 5433 }) })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1'));
});

// Kept last: the success-with-warnings path schedules a delayed redirect.
test('renders backend-returned warnings after a successful submit', async () => {
  (streamsApi.createRoute as jest.Mock).mockResolvedValue({ id: 'r9', name: 'web', warnings: ['mixed protocol LB notice'] });
  await renderCreate();
  await fillValid('6379');
  await submitFromPreview();
  expect(await screen.findByTestId('submit-warnings')).toHaveTextContent('mixed protocol LB notice');
});
