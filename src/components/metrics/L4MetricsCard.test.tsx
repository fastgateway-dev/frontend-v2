import { render, screen } from '@testing-library/react';
import { L4MetricsCard, formatBytes } from './L4MetricsCard';

jest.mock('@/lib/api', () => ({ streamsApi: { getMetrics: jest.fn() } }));
import { streamsApi } from '@/lib/api';

const getMetrics = streamsApi.getMetrics as jest.Mock;

test('formatBytes', () => {
  expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
});

test('renders aggregate and per-listener values, no latency/error cards', async () => {
  getMetrics.mockResolvedValue({
    streamId: 's1', activeConnections: 12, connectionRate: 3.5, bytesIn: 2048, bytesOut: 1048576,
    listeners: [{ port: 5432, protocol: 'tcp', activeConnections: 12, connectionRate: 3.5, bytesIn: 2048, bytesOut: 1048576 }],
  });
  render(<L4MetricsCard projectId="p1" streamId="s1" />);
  expect(await screen.findByText('Active connections')).toBeInTheDocument();
  expect(screen.getAllByText('3.50').length).toBeGreaterThan(0);
  expect(screen.getAllByText('2.0 KB').length).toBeGreaterThan(0);
  expect(screen.getByTestId('l4-metrics-listeners')).toHaveTextContent('5432');
  expect(screen.queryByText(/latency/i)).toBeNull();
  expect(screen.queryByText(/error rate/i)).toBeNull();
});

test('shows informational state on 400 not configured', async () => {
  getMetrics.mockRejectedValue({ response: { status: 400, data: { error: 'metrics not configured' } } });
  render(<L4MetricsCard projectId="p1" streamId="s1" />);
  expect(await screen.findByTestId('l4-metrics-not-configured')).toBeInTheDocument();
  expect(screen.queryByText(/Couldn.t load metrics/)).toBeNull();
});

test('handles empty/zero values', async () => {
  getMetrics.mockResolvedValue({ streamId: 's1', activeConnections: 0, connectionRate: 0, bytesIn: 0, bytesOut: 0, listeners: [] });
  render(<L4MetricsCard projectId="p1" streamId="s1" />);
  expect(await screen.findByText('No listener traffic yet.')).toBeInTheDocument();
});

test('shows an error for non-400 failures', async () => {
  getMetrics.mockRejectedValue({ response: { status: 500, data: { error: 'metrics_unavailable', message: 'boom' } } });
  render(<L4MetricsCard projectId="p1" streamId="s1" />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
  expect(screen.queryByText('metrics_unavailable')).toBeNull();
});
