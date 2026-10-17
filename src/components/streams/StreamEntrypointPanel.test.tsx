import { render, screen, fireEvent } from '@testing-library/react';
import { StreamEntrypointPanel } from './StreamEntrypointPanel';

jest.mock('@/lib/api', () => ({ streamsApi: { getEntrypoint: jest.fn() } }));
import { streamsApi } from '@/lib/api';

const RESERVED = [
  { transport: 'TCP', port: 19000, reason: 'envoy_internal' },
  { transport: 'TCP', port: 19001, reason: 'envoy_internal' },
  { transport: 'TCP', port: 60000, reason: 'placeholder' },
];
const MINE = {
  transport: 'TCP', port: 9000,
  owner: { kind: 'stream_route', streamId: 's1', streamName: 'test-stream', routeId: 'r1', routeName: 'postgres', status: 'active' },
};
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
    { transport: 'TCP', port: 9001, owner: { kind: 'stream_route', streamId: 's2', streamName: 'cache', routeId: 'r2', routeName: 'redis', status: 'active' } },
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

test('shared: IP, who shares it, my ports in full and neighbours collapsed', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue(SHARED);
  renderPanel();
  expect(await screen.findByText('Shared IP')).toBeInTheDocument();
  expect(streamsApi.getEntrypoint).toHaveBeenCalledWith('p1', 's1');
  const panel = screen.getByTestId('entrypoint-panel');
  expect(panel).toHaveTextContent("This stream is a named group of ports on the template's shared entry point.");
  expect(panel).toHaveTextContent('10.0.0.5');
  expect(panel).toHaveTextContent('shared-envoy-clusterip');
  expect(panel).toHaveTextContent('Also used by 1 stream and 1 domain.');
  expect(screen.getByTestId('mine-ports')).toHaveTextContent('9000/TCP');
  expect(screen.getByTestId('mine-ports')).toHaveTextContent('Active');
  expect(screen.getByRole('link', { name: 'postgres' })).toHaveAttribute('href', '/projects/p1/streams/s1/routes/r1');
  expect(panel).toHaveTextContent('2 ports used by other streams/domains.');
  expect(screen.queryByTestId('neighbor-ports')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show other ports' }));
  expect(screen.getByTestId('neighbor-ports')).toHaveTextContent('443/TCP — Domain api');
  expect(screen.getByTestId('neighbor-ports')).toHaveTextContent('9001/TCP — Stream cache · route redis');
  fireEvent.click(screen.getByRole('button', { name: 'Show who shares it' }));
  expect(screen.getByRole('link', { name: 'cache' })).toHaveAttribute('href', '/projects/p1/streams/s2');
  expect(screen.getByRole('link', { name: 'api' })).toHaveAttribute('href', '/projects/p1/domains/d1');
  expect(screen.getByTestId('reserved-ports')).toHaveTextContent(
    '443/TCP (Template listener), 19000/TCP+UDP (Envoy internal), 19001/TCP+UDP (Envoy internal), 60000/TCP+UDP (Placeholder listener)'
  );
  expect(screen.getByTestId('port-range')).toHaveTextContent('Port range 9000–9100 · 99 of 101 free');
});

test('dedicated: own-IP wording, unassigned address, no sharing or neighbours', async () => {
  (streamsApi.getEntrypoint as jest.Mock).mockResolvedValue(DEDICATED);
  renderPanel();
  expect(await screen.findByText('Dedicated IP')).toBeInTheDocument();
  const panel = screen.getByTestId('entrypoint-panel');
  expect(panel).toHaveTextContent('This stream has its own entry point and IP.');
  expect(panel).toHaveTextContent('not assigned yet');
  expect(panel).not.toHaveTextContent('Also used by');
  expect(panel).not.toHaveTextContent('used by other streams/domains');
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
    '19000/TCP+UDP (Envoy internal), 19001/TCP+UDP (Envoy internal), 60000/TCP+UDP (Placeholder listener)'
  );
});
