import { render, screen, fireEvent } from '@testing-library/react';
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

test('no live routes explains the placeholder Gateway', async () => {
  (streamsApi.getYamls as jest.Mock).mockResolvedValue({ gatewayYaml: 'kind: Gateway', routes: [] });
  render(<StreamManifests projectId="p1" streamId="s1" />);
  expect(await screen.findByText(/only the placeholder listener/)).toBeInTheDocument();
});

test('shows the load error', async () => {
  (streamsApi.getYamls as jest.Mock).mockRejectedValue({ response: { data: { error: 'boom' } } });
  render(<StreamManifests projectId="p1" streamId="s1" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('boom');
});
