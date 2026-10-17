import { render, screen } from '@testing-library/react';
import ApprovalsPage from './page';

jest.mock('next/navigation', () => ({ useParams: () => ({ projectId: 'p1' }) }));
jest.mock('@/lib/api', () => ({
  approvalsApi: {
    list: jest.fn().mockResolvedValue({
      data: [
        { id: 'a1', routeId: 'r1', entityType: 'route', action: 'create', status: 'pending', submittedBy: 'u1', entityName: 'postgres', streamId: 's1', streamName: 'tcp-stream', createdAt: '2026-10-01T00:00:00Z' },
        { id: 'a2', routeId: 'r2', entityType: 'route', action: 'update', status: 'pending', submittedBy: 'u1', entityName: 'users', domainName: 'api.example.com', createdAt: '2026-10-02T00:00:00Z' },
      ],
    }),
  },
  clientAttachmentsApi: { listApprovals: jest.fn().mockResolvedValue({ data: [] }) },
}));

test('L4 approvals show their stream, L7 approvals their domain', async () => {
  render(<ApprovalsPage />);
  expect(await screen.findByText('Stream: tcp-stream')).toBeInTheDocument();
  expect(screen.getByText('api.example.com')).toBeInTheDocument();
  expect(screen.getByText('postgres')).toBeInTheDocument();
});
