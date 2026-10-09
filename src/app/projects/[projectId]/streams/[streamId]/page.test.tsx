import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StreamDetailPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'p1', streamId: 's1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  streamsApi: {
    get: jest.fn().mockResolvedValue({
      id: 's1', projectId: 'p1', name: 'pg', namespace: 'ns', status: 'active',
      k8sGatewayName: 'gw', k8sGatewayClass: 'gc',
    }),
    listRoutes: jest.fn().mockResolvedValue({
      data: [
        { id: 'r1', name: 'db', protocol: 'tcp', status: 'active', config: { listenerPort: 5432 } },
        { id: 'r2', name: 'dns', protocol: 'udp', status: 'active', config: { listenerPort: 53 } },
      ],
    }),
    delete: jest.fn(),
  },
  permissionsApi: { getProjectPermissions: jest.fn().mockResolvedValue({ canManageDomains: true }) },
}));
import { streamsApi } from '@/lib/api';

test('shows in-use ports derived from routes', async () => {
  render(<StreamDetailPage />);
  const list = await screen.findByTestId('ports-in-use');
  expect(list).toHaveTextContent('53');
  expect(list).toHaveTextContent('5432');
});

test('surfaces the 409 remove-routes-first error on delete', async () => {
  (streamsApi.delete as jest.Mock).mockRejectedValue({
    response: { data: { error: 'stream still has routes; remove them first' } },
  });
  render(<StreamDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Delete/ }));
  const buttons = await screen.findAllByRole('button', { name: 'Delete' });
  fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() => expect(screen.getByText(/remove them first/i)).toBeInTheDocument());
});
