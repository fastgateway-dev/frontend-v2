import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CreateStreamPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  projectsApi: { get: jest.fn().mockResolvedValue({ id: 'p1', name: 'proj' }) },
  domainTemplatesApi: {
    list: jest.fn().mockResolvedValue({
      data: [{ id: 't1', name: 'tpl', exposureType: 'LoadBalancer', status: 'active' }],
    }),
  },
  domainsApi: {
    listAvailableNamespaces: jest.fn().mockResolvedValue({ namespaces: ['fastgateway-system'] }),
  },
  streamsApi: { create: jest.fn() },
}));
import { streamsApi, domainTemplatesApi } from '@/lib/api';

async function fillAndSubmit() {
  render(<CreateStreamPage />);
  await waitFor(() => expect(screen.getByLabelText('Gateway Template')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Gateway Template'), { target: { value: 't1' } });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'pg' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Stream' }));
}

test('fetches templates with capability=stream and has no hostname field', async () => {
  render(<CreateStreamPage />);
  await waitFor(() => expect(screen.getByLabelText('Gateway Template')).toBeInTheDocument());
  expect(domainTemplatesApi.list).toHaveBeenCalledWith('p1', 1, 100, 'stream');
  expect(screen.queryByLabelText('Hostname')).not.toBeInTheDocument();
});

test.each([
  ['409 name taken', 'stream name already exists'],
  ['400 non-stream template', 'gateway template is not enabled for streams'],
])('surfaces the create error: %s', async (_label, message) => {
  (streamsApi.create as jest.Mock).mockRejectedValue({ response: { data: { error: message } } });
  await fillAndSubmit();
  await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
});
