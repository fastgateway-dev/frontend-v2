import { render, screen, fireEvent } from '@testing-library/react';
import { GatewayTemplateListenerForm } from './GatewayTemplateListenerForm';
import type { TemplateListener } from '@/types';

const defaults: TemplateListener[] = [
  { name: 'http', protocol: 'HTTP', port: 80 },
  { name: 'https', protocol: 'HTTPS', port: 443, tlsMode: 'Terminate' },
];

test('renders the three family sections with TLS passthrough marked Planned', () => {
  render(<GatewayTemplateListenerForm value={defaults} onChange={() => {}} />);
  expect(screen.getByText('HTTP / gRPC listeners')).toBeInTheDocument();
  expect(screen.getByText('TLS passthrough listeners')).toBeInTheDocument();
  expect(screen.getByText('Planned')).toBeInTheDocument();
  expect(screen.getByText('TCP / UDP port range')).toBeInTheDocument();
  expect(screen.getByLabelText('Listener 2 protocol')).toHaveValue('HTTPS');
  expect(screen.getByText('Terminate')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows an inline alert when two listeners share a port', () => {
  render(
    <GatewayTemplateListenerForm
      value={[
        { name: 'a', protocol: 'HTTP', port: 80 },
        { name: 'b', protocol: 'HTTP', port: 80 },
      ]}
      onChange={() => {}}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Port 80 is used by more than one listener');
});

test('adding an HTTP/HTTPS listener emits a new unique listener', () => {
  const onChange = jest.fn();
  render(<GatewayTemplateListenerForm value={defaults} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /add http\/https listener/i }));
  const next = onChange.mock.calls[0][0] as TemplateListener[];
  expect(next).toHaveLength(3);
  expect(next[2]).toMatchObject({ name: 'http-1', protocol: 'HTTP' });
  expect(next[2].port).not.toBe(80);
  expect(next[2].port).not.toBe(443);
});

test('switching to HTTPS fixes TLS mode to Terminate and back to HTTP drops it', () => {
  const onChange = jest.fn();
  render(<GatewayTemplateListenerForm value={defaults} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Listener 1 protocol'), { target: { value: 'HTTPS' } });
  expect(onChange.mock.calls[0][0][0]).toMatchObject({ protocol: 'HTTPS', tlsMode: 'Terminate' });

  fireEvent.change(screen.getByLabelText('Listener 2 protocol'), { target: { value: 'HTTP' } });
  expect(onChange.mock.calls[1][0][1]).toEqual({ name: 'https', protocol: 'HTTP', port: 443 });
});

test('removing a row emits the list without it', () => {
  const onChange = jest.fn();
  render(<GatewayTemplateListenerForm value={defaults} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove listener 1' }));
  expect(onChange).toHaveBeenCalledWith([defaults[1]]);
});

test('adds and removes the single TCP/UDP range', () => {
  const onChange = jest.fn();
  const { rerender } = render(<GatewayTemplateListenerForm value={defaults} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /add tcp\/udp port range/i }));
  const withRange = onChange.mock.calls[0][0] as TemplateListener[];
  expect(withRange[2]).toMatchObject({ name: 'tcpudp', protocol: 'TCP', portRangeMin: 9000, portRangeMax: 9100 });

  rerender(<GatewayTemplateListenerForm value={withRange} onChange={onChange} />);
  expect(screen.queryByRole('button', { name: /add tcp\/udp port range/i })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('TCP/UDP range maximum port'), { target: { value: '9500' } });
  expect((onChange.mock.calls[1][0] as TemplateListener[])[2].portRangeMax).toBe(9500);

  fireEvent.click(screen.getByRole('button', { name: 'Remove TCP/UDP range' }));
  expect(onChange.mock.calls[2][0]).toEqual(defaults);
});

test('an inverted range shows the validation message', () => {
  render(
    <GatewayTemplateListenerForm
      value={[...defaults, { name: 'tcpudp', protocol: 'TCP', portRangeMin: 9100, portRangeMax: 9000 }]}
      onChange={() => {}}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('needs a valid port range');
});

test('disabled locks every control', () => {
  render(<GatewayTemplateListenerForm value={defaults} onChange={() => {}} disabled />);
  expect(screen.getByLabelText('Listener 1 name')).toBeDisabled();
  expect(screen.getByRole('button', { name: /add http\/https listener/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /add tcp\/udp port range/i })).toBeDisabled();
});

test('shows a reason for a cleared name, a missing port and a duplicate name', () => {
  const { rerender } = render(
    <GatewayTemplateListenerForm value={[{ name: '', protocol: 'HTTP', port: 80 }]} onChange={() => {}} />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Every listener needs a name');

  rerender(<GatewayTemplateListenerForm value={[{ name: 'web', protocol: 'HTTP' }]} onChange={() => {}} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/"web".*port/);

  rerender(
    <GatewayTemplateListenerForm
      value={[
        { name: 'a', protocol: 'HTTP', port: 80 },
        { name: 'a', protocol: 'HTTP', port: 81 },
      ]}
      onChange={() => {}}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('"a" is used more than once');
});

test('empty list shows the add-one message', () => {
  render(<GatewayTemplateListenerForm value={[]} onChange={() => {}} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Add at least one listener');
});
