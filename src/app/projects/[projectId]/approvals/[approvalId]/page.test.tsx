import { render, screen } from '@testing-library/react';
import ApprovalReviewPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'p1', approvalId: 'a1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/components/features/comment-feed', () => ({ CommentFeed: () => null }));
jest.mock('@/lib/api', () => ({
  approvalsApi: { get: jest.fn(), getDiff: jest.fn() },
  aiApi: { reviewApproval: jest.fn() },
}));
import { approvalsApi } from '@/lib/api';

const L4_APPROVAL = {
  id: 'a1', routeId: 'r1', entityType: 'route', action: 'update', status: 'approved', submittedBy: 'u1',
  submitter: { username: 'alice' }, entityName: 'postgres', streamId: 's1', streamName: 'tcp-stream',
  configSnapshot: { matches: [], backends: [], listenerPort: 5433 }, createdAt: '2026-10-01T00:00:00Z',
};

test('an L4 approval shows its stream and TCPRoute / BackendTrafficPolicy titles', async () => {
  (approvalsApi.get as jest.Mock).mockResolvedValue(L4_APPROVAL);
  (approvalsApi.getDiff as jest.Mock).mockResolvedValue({
    action: 'update',
    routeKind: 'TCPRoute',
    currentYaml: 'kind: TCPRoute\nport: 5432',
    proposedYaml: 'kind: TCPRoute\nport: 5433',
    proposedBackendTrafficPolicyYaml: 'kind: BackendTrafficPolicy',
  });
  render(<ApprovalReviewPage />);
  expect(await screen.findByText('TCPRoute Changes')).toBeInTheDocument();
  expect(screen.getByText('BackendTrafficPolicy Changes')).toBeInTheDocument();
  expect(screen.queryByText('HTTPRoute Changes')).not.toBeInTheDocument();
  expect(screen.getByTestId('approval-context')).toHaveTextContent('Stream: tcp-stream');
  expect(screen.getByText('postgres')).toBeInTheDocument();
});

test('an HTTP approval from an older backend keeps the HTTPRoute titles and shows its domain', async () => {
  (approvalsApi.get as jest.Mock).mockResolvedValue({
    ...L4_APPROVAL,
    entityName: 'users',
    streamId: undefined,
    streamName: undefined,
    domainName: 'api.example.com',
    configSnapshot: { matches: [{ path: { type: 'Prefix', value: '/users' } }], backends: [] },
  });
  (approvalsApi.getDiff as jest.Mock).mockResolvedValue({
    action: 'update',
    currentYaml: 'kind: HTTPRoute',
    proposedYaml: 'kind: HTTPRoute\n# changed',
    proposedBackendTrafficPolicyYaml: 'kind: BackendTrafficPolicy',
  });
  render(<ApprovalReviewPage />);
  expect(await screen.findByText('HTTPRoute Changes')).toBeInTheDocument();
  expect(screen.getByText('BackendTrafficPolicy Changes (Compression)')).toBeInTheDocument();
  expect(screen.getByTestId('approval-context')).toHaveTextContent('api.example.com');
  expect(screen.getByText('/users')).toBeInTheDocument();
});
