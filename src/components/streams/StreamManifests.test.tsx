import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StreamManifests } from './StreamManifests';

jest.mock('@/lib/api', () => ({ streamsApi: { getYamls: jest.fn() } }));
import { streamsApi } from '@/lib/api';

beforeEach(() => (streamsApi.getYamls as jest.Mock).mockReset());

test('shows the Gateway open and each route collapsed with its BackendTrafficPolicy', async () => {
  (streamsApi.getYamls as jest.Mock).mockResolvedValue({
    gatewayYaml: 'kind: Gateway\nname: str-test',
    routes: [
      { routeId: 'r1', name: 'postgres', protocol: 'tcp', routeYaml: 'kind: TCPRoute\nname: postgres', backendTrafficPolicyYaml: 'kind: BackendTrafficPolicy\nname: postgres' },
      { routeId: 'r2', name: 'dns', protocol: 'udp', routeYaml: 'kind: UDPRoute\nname: dns', backendTrafficPolicyYaml: '' },
    ],
  });
  render(<StreamManifests projectId="p1" streamId="s1" />);
  expect(await screen.findByText(/kind: Gateway/)).toBeInTheDocument();
  expect(streamsApi.getYamls).toHaveBeenCalledWith('p1', 's1');
  expect(screen.queryByText(/kind: TCPRoute/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'TCPRoute · postgres' }));
  expect(screen.getByText(/kind: TCPRoute/)).toBeInTheDocument();
  expect(screen.getByText(/kind: BackendTrafficPolicy/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'UDPRoute · dns' }));
  expect(screen.getByText(/kind: UDPRoute/)).toBeInTheDocument();
  expect(screen.getAllByText('BackendTrafficPolicy')).toHaveLength(1);
});

test('no routes explains the Gateway listens on the claimed ports', async () => {
  (streamsApi.getYamls as jest.Mock).mockResolvedValue({ gatewayYaml: 'kind: Gateway', routes: [] });
  render(<StreamManifests projectId="p1" streamId="s1" />);
  expect(await screen.findByText("No live routes yet. The Gateway listens on this stream's claimed ports.")).toBeInTheDocument();
});

test('a stream with no claims has no Gateway yet', async () => {
  (streamsApi.getYamls as jest.Mock).mockResolvedValue({ gatewayYaml: '', routes: [] });
  render(<StreamManifests projectId="p1" streamId="s1" />);
  expect(await screen.findByText('No ports claimed, so this stream has no Gateway yet.')).toBeInTheDocument();
  expect(screen.queryByText(/No live routes yet/)).not.toBeInTheDocument();
  // No empty Gateway accordion item either.
  expect(screen.queryByRole('button', { name: 'Gateway' })).not.toBeInTheDocument();
});

test('refetches when refreshKey changes', async () => {
  (streamsApi.getYamls as jest.Mock).mockResolvedValue({ gatewayYaml: 'kind: Gateway', routes: [] });
  const { rerender } = render(<StreamManifests projectId="p1" streamId="s1" refreshKey={0} />);
  await screen.findByText(/kind: Gateway/);
  rerender(<StreamManifests projectId="p1" streamId="s1" refreshKey={1} />);
  await waitFor(() => expect(streamsApi.getYamls).toHaveBeenCalledTimes(2));
});

test('shows the load error', async () => {
  (streamsApi.getYamls as jest.Mock).mockRejectedValue({ response: { data: { error: 'boom' } } });
  render(<StreamManifests projectId="p1" streamId="s1" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('boom');
});

test('a transient load error clears when a refetch succeeds', async () => {
  (streamsApi.getYamls as jest.Mock)
    .mockRejectedValueOnce({ response: { data: { error: 'boom' } } })
    .mockResolvedValueOnce({ gatewayYaml: 'kind: Gateway', routes: [] });
  const { rerender } = render(<StreamManifests projectId="p1" streamId="s1" refreshKey={0} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  rerender(<StreamManifests projectId="p1" streamId="s1" refreshKey={1} />);
  expect(await screen.findByText(/kind: Gateway/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
