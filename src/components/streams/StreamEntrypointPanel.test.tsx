import { render, screen } from '@testing-library/react';
import { StreamEntrypointPanel } from './StreamEntrypointPanel';

jest.mock('@/lib/api', () => ({ streamsApi: { getEntrypoint: jest.fn() } }));
import { streamsApi } from '@/lib/api';

const RESERVED = [
  { transport: 'TCP', port: 19000, reason: 'envoy_internal' },
  { transport: 'TCP', port: 19001, reason: 'envoy_internal' },
];
const OWNER = { kind: 'stream', streamId: 's1', streamName: 'test-stream' };
const MINE = { transport: 'TCP', port: 5432, owner: { ...OWNER, routeId: 'r1', routeName: 'pg', status: 'active' } };
const PENDING = {
  transport: 'TCP', port: 5433,
  owner: { ...OWNER, routeId: 'r2', routeName: 'cache', status: 'pending_create', pending: true },
};
const UNUSED = { transport: 'UDP', port: 53, owner: OWNER };
const SHARED = {
  mode: 'shared',
  templateId: 't1',
  templateName: 'shared-envoy',
  gatewayClass: 'shared-envoy-clusterip',
  address: '10.0.0.5',
  portRange: { min: 9000, max: 9100 },
  sharedWith: { streams: [{ id: 's2', name: 'cache' }], domains: [{ id: 'd1', name: 'api', hostname: 'api.example.com' }] },
  ports: [
    MINE,
    PENDING,
    UNUSED,
    { transport: 'TCP', port: 9001, owner: { kind: 'stream', streamId: 's2', streamName: 'cache', routeId: 'r2', routeName: 'redis', status: 'active' } },
    { transport: 'TCP', port: 443, owner: { kind: 'domain', domainId: 'd1', domainName: 'api' } },
  ],
  reserved: [...RESERVED, { transport: 'TCP', port: 443, reason: 'template_listener' }],
};
const DEDICATED = {
  ...SHARED,
  mode: 'dedicated',
  address: '',
  sharedWith: { streams: [], domains: [] },
  ports: [MINE],
  reserved: RESERVED,
};

beforeEach(() => (streamsApi.getEntrypoint as jest.Mock).mockReset());

const renderPanel = () => render(<StreamEntrypointPanel projectId="p1" streamId="s1" />);

test('shared: IP and a claim list with no neighbour or sharing lists', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue(SHARED);
  renderPanel();
  expect(await screen.findByText('Shared IP')).toBeInTheDocument();
  expect(streamsApi.getEntrypoint).toHaveBeenCalledWith('p1', 's1');
  const panel = screen.getByTestId('entrypoint-panel');
  expect(panel).toHaveTextContent("This stream is a named group of ports on the template's shared entry point.");
  expect(panel).toHaveTextContent('10.0.0.5');
  expect(panel).toHaveTextContent('shared-envoy-clusterip');
  expect(panel).not.toHaveTextContent('Also used by');
  expect(panel).not.toHaveTextContent('used by other streams/domains');
  expect(screen.queryByRole('button', { name: 'Show who shares it' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show other ports' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('neighbor-ports')).not.toBeInTheDocument();
  expect(screen.queryByTestId('shared-with-list')).not.toBeInTheDocument();
  // Only this stream's claims are listed.
  expect(screen.getByTestId('mine-ports').querySelectorAll('li')).toHaveLength(3);
  expect(screen.getByTestId('reserved-ports')).toHaveTextContent(
    '443/TCP (Template listener), 19000/TCP+UDP (Envoy internal), 19001/TCP+UDP (Envoy internal)'
  );
  expect(screen.getByTestId('port-range')).toHaveTextContent('Port range 9000–9100');
});

test("lists every claim: a route with its status, a pending route, and an unused claim", async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue(SHARED);
  renderPanel();
  await screen.findByText('Shared IP');
  const rows = screen.getAllByRole('listitem').filter((li) => li.closest('[data-testid="mine-ports"]'));
  expect(rows[0]).toHaveTextContent('53/UDP');
  expect(rows[0]).toHaveTextContent('unused');
  expect(rows[1]).toHaveTextContent('5432/TCP');
  expect(rows[1]).toHaveTextContent('Active');
  expect(screen.getByRole('link', { name: 'pg' })).toHaveAttribute('href', '/projects/p1/streams/s1/routes/r1');
  expect(rows[2]).toHaveTextContent('5433/TCP');
  expect(rows[2]).toHaveTextContent(/pending/i);
  expect(screen.getByRole('link', { name: 'cache' })).toHaveAttribute('href', '/projects/p1/streams/s1/routes/r2');
});

test('a claim held only by a deployed version (pending_deploy) is a normal route claim', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue({
    ...DEDICATED,
    ports: [{ transport: 'TCP', port: 5434, owner: { ...MINE.owner, routeId: 'r3', routeName: 'old', status: 'pending_deploy', pending: false } }],
  });
  renderPanel();
  await screen.findByText('Dedicated IP');
  expect(screen.getByTestId('mine-ports')).toHaveTextContent('5434/TCP');
  expect(screen.getByRole('link', { name: 'old' })).toHaveAttribute('href', '/projects/p1/streams/s1/routes/r3');
  expect(screen.getByTestId('mine-ports')).toHaveTextContent('Pending Deploy');
  expect(screen.queryByText('unused')).not.toBeInTheDocument();
});

test('no claims shows the legacy empty state', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue({ ...DEDICATED, ports: [] });
  renderPanel();
  await screen.findByText('Dedicated IP');
  expect(screen.getByTestId('entrypoint-panel')).toHaveTextContent(
    "No ports claimed. Claim a port to create this stream's Gateway."
  );
  expect(screen.queryByTestId('mine-ports')).not.toBeInTheDocument();
  expect(screen.getByTestId('reserved-ports')).toBeInTheDocument();
  expect(screen.getByTestId('port-range')).toBeInTheDocument();
});

test('reports the loaded entry point to the page', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue(DEDICATED);
  const onLoad = jest.fn();
  render(<StreamEntrypointPanel projectId="p1" streamId="s1" onLoad={onLoad} />);
  await screen.findByText('Dedicated IP');
  expect(onLoad).toHaveBeenCalledWith(DEDICATED);
});

test('dedicated: own-IP wording and unassigned address', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue(DEDICATED);
  renderPanel();
  expect(await screen.findByText('Dedicated IP')).toBeInTheDocument();
  const panel = screen.getByTestId('entrypoint-panel');
  expect(panel).toHaveTextContent('This stream has its own entry point and IP.');
  expect(panel).toHaveTextContent('not assigned yet');
});

// Review Focus: backend fails closed (500) on a template lookup failure.
test('a failed entry point load shows the error and never a guessed mode', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockRejectedValue({ response: { status: 500, data: { error: 'template lookup failed' } } });
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the entry point: template lookup failed');
  expect(screen.queryByText('Dedicated IP')).not.toBeInTheDocument();
  expect(screen.queryByText('Shared IP')).not.toBeInTheDocument();
});

// Review Focus: response omits the platform reserved ports.
test('reserved platform ports are shown even if the response omits them', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue({ ...DEDICATED, reserved: [] });
  renderPanel();
  await screen.findByText('Dedicated IP');
  expect(screen.getByTestId('reserved-ports')).toHaveTextContent(
    '19000/TCP+UDP (Envoy internal), 19001/TCP+UDP (Envoy internal)'
  );
});
