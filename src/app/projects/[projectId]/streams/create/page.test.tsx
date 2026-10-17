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
  { transport: 'TCP', port: 60000, reason: 'placeholder' },
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
    { transport: 'TCP', port: 9000, owner: { kind: 'stream_route', streamId: 's2', streamName: 'cache', routeId: 'r1', routeName: 'redis', status: 'active' } },
    { transport: 'UDP', port: 9000, owner: { kind: 'stream_route', streamId: 's2', streamName: 'cache', routeId: 'r2', routeName: 'dns', status: 'active' } },
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

async function fillAndSubmit() {
  await pick('t1');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'pg' } });
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

test('a shared template shows who shares it, an unassigned address and the free ports', async () => {
  await pick('t2');
  await waitFor(() => expect(panel()).toHaveTextContent('joins the shared entry point shared-envoy-clusterip'));
  expect(panel()).toHaveTextContent('IP assigned on first deploy');
  expect(panel()).toHaveTextContent('also used by 1 stream and 2 domains');
  expect(panel()).toHaveTextContent('100 of 101 ports free in 9000–9100');
  expect(screen.queryByTestId('shared-with-list')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show who shares it' }));
  expect(screen.getByTestId('shared-with-list')).toHaveTextContent('Stream cache');
  expect(screen.getByTestId('shared-with-list')).toHaveTextContent('Domain api (api.example.com)');
});

test('stream create has no port, team or preview fields', async () => {
  await pick('t2');
  await waitFor(() => expect(panel()).toHaveTextContent('Shared IP'));
  expect(screen.queryByLabelText(/port/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/team/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /preview/i })).not.toBeInTheDocument();
});

test('a failed entry point load does not block create', async () => {
  (domainTemplatesApi.getEntrypoint as jest.Mock).mockRejectedValue({ response: { data: { error: 'boom' } } });
  await pick('t1');
  await waitFor(() => expect(panel()).toHaveTextContent('Could not load the entry point for this template (boom)'));
  expect(screen.getByRole('button', { name: 'Create Stream' })).toBeEnabled();
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
