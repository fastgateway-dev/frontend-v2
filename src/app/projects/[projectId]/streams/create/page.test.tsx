import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import CreateStreamPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  projectsApi: { get: jest.fn().mockResolvedValue({ id: 'p1', name: 'proj' }) },
  domainTemplatesApi: {
    list: jest.fn().mockResolvedValue({
      data: [
        { id: 't1', name: 'tpl', exposureType: 'LoadBalancer', status: 'active', mergeGateways: false },
        { id: 't2', name: 'shared-envoy', exposureType: 'ClusterIP', status: 'active', mergeGateways: true },
      ],
    }),
    getEntrypoint: jest.fn(),
  },
  domainsApi: {
    listAvailableNamespaces: jest.fn().mockResolvedValue({ namespaces: ['fastgateway-system'] }),
  },
  streamsApi: { create: jest.fn() },
}));
import { streamsApi, domainTemplatesApi } from '@/lib/api';

const RESERVED = [
  { transport: 'TCP', port: 19000, reason: 'envoy_internal' },
  { transport: 'TCP', port: 19001, reason: 'envoy_internal' },
];
const DEDICATED = {
  mode: 'dedicated',
  templateId: 't1',
  templateName: 'tpl',
  gatewayClass: 'gc-tpl',
  address: '',
  portRange: { min: 9000, max: 9100 },
  sharedWith: { streams: [], domains: [] },
  ports: [],
  reserved: RESERVED,
};
const SHARED = {
  mode: 'shared',
  templateId: 't2',
  templateName: 'shared-envoy',
  gatewayClass: 'shared-envoy-clusterip',
  address: '',
  portRange: { min: 9000, max: 9100 },
  sharedWith: {
    streams: [{ id: 's2', name: 'cache' }],
    domains: [
      { id: 'd1', name: 'api', hostname: 'api.example.com' },
      { id: 'd2', name: 'web', hostname: 'web.example.com' },
    ],
  },
  ports: [
    { transport: 'TCP', port: 9000, owner: { kind: 'stream', streamId: 's2', streamName: 'cache', routeId: 'r1', routeName: 'redis', status: 'active' } },
    { transport: 'UDP', port: 9000, owner: { kind: 'stream', streamId: 's2', streamName: 'cache', routeId: 'r2', routeName: 'dns', status: 'active' } },
    { transport: 'TCP', port: 443, owner: { kind: 'domain', domainId: 'd1', domainName: 'api' } },
  ],
  reserved: [...RESERVED, { transport: 'TCP', port: 443, reason: 'template_listener' }],
};

beforeEach(() => {
  (domainTemplatesApi.getEntrypoint as jest.Mock).mockReset();
  (domainTemplatesApi.getEntrypoint as jest.Mock).mockImplementation((_p: string, id: string) =>
    Promise.resolve(id === 't2' ? SHARED : DEDICATED)
  );
});

const panel = () => screen.getByTestId('entrypoint-summary');

async function pick(templateId?: string) {
  render(<CreateStreamPage />);
  await waitFor(() => expect(screen.getByLabelText('Gateway Template')).toBeInTheDocument());
  if (templateId) fireEvent.change(screen.getByLabelText('Gateway Template'), { target: { value: templateId } });
}

/** Types a port into the picker and clicks Add. */
function claim(port: string, transport?: 'TCP' | 'UDP') {
  if (transport) fireEvent.click(screen.getByLabelText(transport));
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: port } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

async function fillAndSubmit() {
  await pick('t1');
  await waitFor(() => expect(panel()).toHaveTextContent('Dedicated IP'));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'pg' } });
  claim('9050');
  fireEvent.click(screen.getByRole('button', { name: 'Create Stream' }));
}

test('fetches templates with capability=stream and has no hostname field', async () => {
  await pick();
  expect(domainTemplatesApi.list).toHaveBeenCalledWith('p1', 1, 100, 'stream');
  expect(screen.queryByLabelText('Hostname')).not.toBeInTheDocument();
});

test.each([
  ['409 name taken', 'stream name already exists'],
  ['400 non-stream template', 'gateway template is not enabled for streams'],
])('surfaces the create error: %s', async (_label, message) => {
  (streamsApi.create as jest.Mock).mockRejectedValue({ response: { data: { error: message } } });
  await fillAndSubmit();
  await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
});

test('template options show the entry point mode', async () => {
  await pick();
  expect(screen.getByRole('option', { name: 'tpl — Dedicated IP' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'shared-envoy — Shared IP' })).toBeInTheDocument();
});

test('a dedicated template explains its own IP and the port range', async () => {
  await pick('t1');
  await waitFor(() =>
    expect(panel()).toHaveTextContent('This stream gets its own entry point and IP. Routes can use ports 9000–9100.')
  );
  expect(domainTemplatesApi.getEntrypoint).toHaveBeenCalledWith('p1', 't1');
  expect(panel()).toHaveTextContent('Dedicated IP');
});

test('a shared template shows its mode, IP and the free ports but not who shares it', async () => {
  await pick('t2');
  await waitFor(() => expect(panel()).toHaveTextContent('joins the shared entry point shared-envoy-clusterip'));
  expect(panel()).toHaveTextContent('IP assigned on first deploy');
  expect(panel()).toHaveTextContent('100 of 101 ports free in 9000–9100');
  expect(panel()).toHaveTextContent('Shared IP');
  expect(panel()).not.toHaveTextContent('also used by');
  expect(screen.queryByRole('button', { name: /who shares it/i })).not.toBeInTheDocument();
  expect(screen.queryByTestId('shared-with-list')).not.toBeInTheDocument();
});

test('stream create has no team or preview fields', async () => {
  await pick('t2');
  await waitFor(() => expect(panel()).toHaveTextContent('Shared IP'));
  expect(screen.queryByLabelText(/team/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /preview/i })).not.toBeInTheDocument();
});

test('the Ports field appears once a template is picked', async () => {
  await pick();
  expect(screen.queryByLabelText('Port')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Gateway Template'), { target: { value: 't1' } });
  await waitFor(() => expect(screen.getByLabelText('Port')).toBeEnabled());
  expect(screen.getByText('Ports')).toBeInTheDocument();
  expect(document.body).toHaveTextContent('Port range 9000–9100 · 101 of 101 free');
});

test('Create is disabled until a port is claimed and sends the claims', async () => {
  (streamsApi.create as jest.Mock).mockResolvedValue({ id: 's1' });
  await pick('t1');
  await waitFor(() => expect(screen.getByLabelText('Port')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'pg' } });
  expect(screen.getByRole('button', { name: 'Create Stream' })).toBeDisabled();
  claim('9050');
  expect(screen.getByRole('button', { name: 'Create Stream' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Create Stream' }));
  await waitFor(() =>
    expect(streamsApi.create).toHaveBeenCalledWith('p1', {
      name: 'pg',
      namespace: 'fastgateway-system',
      gatewayTemplateId: 't1',
      ports: [{ transport: 'TCP', port: 9050 }],
    })
  );
});

test('removing the last claim disables Create again', async () => {
  await pick('t1');
  await waitFor(() => expect(screen.getByLabelText('Port')).toBeEnabled());
  claim('9050');
  expect(screen.getByRole('button', { name: 'Create Stream' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove 9050/TCP' }));
  expect(screen.getByRole('button', { name: 'Create Stream' })).toBeDisabled();
});

test('changing the template clears the claims', async () => {
  await pick('t1');
  await waitFor(() => expect(screen.getByLabelText('Port')).toBeEnabled());
  claim('9050');
  expect(screen.getAllByTestId('port-claim-chip')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Gateway Template'), { target: { value: 't2' } });
  expect(screen.queryAllByTestId('port-claim-chip')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Create Stream' })).toBeDisabled();
});

test('the picker rejects a port another owner holds on a shared template', async () => {
  await pick('t2');
  await waitFor(() => expect(screen.getByLabelText('Port')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '9000' } });
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('UDP'));
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '9001' } });
  expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
});

test('a 409 port error from the server shows under the picker', async () => {
  const message = 'port 9050/TCP is already claimed by stream cache';
  (streamsApi.create as jest.Mock).mockRejectedValue({ response: { status: 409, data: { error: message } } });
  await fillAndSubmit();
  await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
  expect(screen.queryByText('Failed to create stream')).not.toBeInTheDocument();
  // Editing the claims dismisses the stale server error.
  claim('9051');
  expect(screen.queryByText(message)).not.toBeInTheDocument();
});

test('a failed entry point load does not block create', async () => {
  (domainTemplatesApi.getEntrypoint as jest.Mock).mockRejectedValue({ response: { data: { error: 'boom' } } });
  await pick('t1');
  await waitFor(() => expect(panel()).toHaveTextContent('Could not load the entry point for this template (boom)'));
});

test('create still works when the entry point fails', async () => {
  (domainTemplatesApi.getEntrypoint as jest.Mock).mockRejectedValue({ response: { data: { error: 'boom' } } });
  (streamsApi.create as jest.Mock).mockResolvedValue({ id: 's1' });
  await pick('t1');
  await waitFor(() => expect(panel()).toHaveTextContent('You can still create the stream.'));
  await waitFor(() => expect(screen.getByLabelText('Port')).toBeEnabled());
  expect(screen.queryByText(/free/)).not.toBeInTheDocument();
  // No range: any valid port is accepted client-side; the platform-reserved ports are still refused.
  fireEvent.change(screen.getByLabelText('Port'), { target: { value: '19000' } });
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'pg' } });
  claim('5432');
  fireEvent.click(screen.getByRole('button', { name: 'Create Stream' }));
  await waitFor(() =>
    expect(streamsApi.create).toHaveBeenCalledWith('p1', expect.objectContaining({ ports: [{ transport: 'TCP', port: 5432 }] }))
  );
});

test('create still works while the entry point request never resolves', async () => {
  (domainTemplatesApi.getEntrypoint as jest.Mock).mockImplementation(() => new Promise(() => {}));
  (streamsApi.create as jest.Mock).mockResolvedValue({ id: 's1' });
  await pick('t1');
  expect(panel()).toHaveTextContent('Loading entry point');
  expect(screen.getByLabelText('Port')).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'pg' } });
  claim('5432');
  expect(screen.getByRole('button', { name: 'Create Stream' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Create Stream' }));
  await waitFor(() =>
    expect(streamsApi.create).toHaveBeenCalledWith('p1', expect.objectContaining({ ports: [{ transport: 'TCP', port: 5432 }] }))
  );
});

// Review Focus: switching templates quickly.
test('ignores a late entry point response for a template the user already left', async () => {
  let resolveFirst: (v: unknown) => void = () => {};
  (domainTemplatesApi.getEntrypoint as jest.Mock)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockImplementationOnce(() => Promise.resolve(SHARED));
  await pick('t1');
  fireEvent.change(screen.getByLabelText('Gateway Template'), { target: { value: 't2' } });
  await waitFor(() => expect(panel()).toHaveTextContent('Shared IP'));
  await act(async () => {
    resolveFirst(DEDICATED);
  });
  expect(panel()).toHaveTextContent('Shared IP');
  expect(panel()).not.toHaveTextContent('Dedicated IP');
});
