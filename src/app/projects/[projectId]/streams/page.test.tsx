import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import StreamsPage from './page';

jest.mock('next/navigation', () => ({ useParams: () => ({ projectId: 'p1' }) }));
jest.mock('@/lib/api', () => ({
  projectsApi: { get: jest.fn().mockResolvedValue({ id: 'p1', name: 'proj' }) },
  permissionsApi: { getProjectPermissions: jest.fn().mockResolvedValue({ canManageDomains: true }) },
  streamsApi: {
    list: jest.fn().mockResolvedValue({
      data: [
        {
          id: 's1', projectId: 'p1', name: 'postgres', namespace: 'ns', gatewayTemplateId: 't1',
          k8sGatewayName: 'str-postgres', k8sGatewayClass: 'gc', status: 'active',
          mode: 'shared', gatewayTemplateName: 'shared-envoy', routeCount: 4,
          ports: [
            { transport: 'TCP', port: 9000 },
            { transport: 'TCP', port: 6379 },
            { transport: 'UDP', port: 53 },
            { transport: 'TCP', port: 5432 },
          ],
        },
        {
          id: 's2', projectId: 'p1', name: 'cache', namespace: 'ns', gatewayTemplateId: 't2',
          k8sGatewayName: 'str-cache', k8sGatewayClass: 'gc2', status: 'pending',
          mode: 'dedicated', gatewayTemplateName: 'edge-l4', routeCount: 0, ports: [],
        },
        {
          id: 's3', projectId: 'p1', name: 'legacy', namespace: 'ns', gatewayTemplateId: 't3',
          k8sGatewayName: 'str-legacy', k8sGatewayClass: 'gc3', status: 'error',
        },
      ],
    }),
  },
}));
import { streamsApi } from '@/lib/api';

beforeEach(() => jest.clearAllMocks());

const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr') as HTMLElement;

test('shows entry point, route count and the first three ports (no IP column: the address is live Gateway status, shown on detail)', async () => {
  render(<StreamsPage />);
  await screen.findByRole('link', { name: 'postgres' });
  expect(screen.getByRole('columnheader', { name: 'Entry point' })).toBeInTheDocument();
  const pg = rowOf('postgres');
  expect(within(pg).getByText('Shared IP')).toBeInTheDocument();
  expect(within(pg).getByText('shared-envoy')).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'IP' })).not.toBeInTheDocument();
  expect(within(pg).getByText('4')).toBeInTheDocument();
  expect(screen.getByTestId('ports-s1')).toHaveTextContent('53/UDP, 5432/TCP, 6379/TCP +1');
  expect(within(rowOf('cache')).getByText('Dedicated IP')).toBeInTheDocument();
  expect(within(rowOf('cache')).getByText('0')).toBeInTheDocument();
  // A stream without the list fields (older backend) still renders, with dashes.
  // Entry point, Routes and Ports render dashes (there is no IP column).
  expect(within(rowOf('legacy')).getAllByText('—').length).toBeGreaterThanOrEqual(3);
});

test('filters by status on the client', async () => {
  render(<StreamsPage />);
  await screen.findByRole('link', { name: 'postgres' });
  fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'error' } });
  expect(screen.getByRole('link', { name: 'legacy' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'postgres' })).not.toBeInTheDocument();
  expect(streamsApi.list).toHaveBeenCalledTimes(1);
});

test('debounces the name search', async () => {
  render(<StreamsPage />);
  await screen.findByRole('link', { name: 'postgres' });
  fireEvent.change(screen.getByLabelText('Search streams by name'), { target: { value: 'CAC' } });
  // Not applied until the debounce elapses.
  expect(screen.getByRole('link', { name: 'postgres' })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('link', { name: 'postgres' })).not.toBeInTheDocument());
  expect(screen.getByRole('link', { name: 'cache' })).toBeInTheDocument();
  expect(streamsApi.list).toHaveBeenCalledTimes(1);
});

test('a filter that matches nothing offers Clear Filters', async () => {
  render(<StreamsPage />);
  await screen.findByRole('link', { name: 'postgres' });
  fireEvent.change(screen.getByLabelText('Search streams by name'), { target: { value: 'nope' } });
  expect(await screen.findByText('No streams found')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(screen.getByRole('link', { name: 'postgres' })).toBeInTheDocument();
});
