import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DomainCreatePage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  projectsApi: { get: jest.fn().mockResolvedValue({ id: 'p1', name: 'proj' }) },
  domainTemplatesApi: {
    list: jest.fn().mockResolvedValue({
      data: [
        {
          id: 't1', name: 'tpl', exposureType: 'ClusterIP',
          listeners: [{ name: 'http', protocol: 'HTTP', port: 80 }],
          status: 'active', annotations: {}, mergeGateways: false,
        },
      ],
    }),
  },
  domainsApi: {
    create: jest.fn(),
    listAvailableNamespaces: jest.fn().mockResolvedValue({ namespaces: ['fastgateway-system'] }),
  },
}));
jest.mock('@/lib/api/ai', () => ({ aiApi: { getStatus: jest.fn().mockResolvedValue({ enabled: false }) } }));
jest.mock('@/lib/api/dns-zones', () => ({ dnsZonesApi: { list: jest.fn().mockResolvedValue([]) } }));
jest.mock('@/lib/api/dns-credentials', () => ({ dnsCredentialsApi: { list: jest.fn().mockResolvedValue([]) } }));
import { domainsApi } from '@/lib/api';

test('surfaces the DNS collision 409 error on create', async () => {
  (domainsApi.create as jest.Mock).mockRejectedValue({
    response: { data: { error: 'DNS for this hostname is already managed by another project in this hosted zone' } },
  });

  render(<DomainCreatePage />);
  await waitFor(() => expect(screen.getByLabelText('Domain Template')).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText('Domain Template'), { target: { value: 't1' } });
  fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'My Domain' } });
  fireEvent.change(screen.getByLabelText('Hostname'), { target: { value: 'app.example.com' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Create Domain' })[0]);

  await waitFor(() =>
    expect(screen.getByText(/already managed by another project/i)).toBeInTheDocument(),
  );
});

test('sends the checked listeners as boundListeners', async () => {
  (domainsApi.create as jest.Mock).mockClear().mockResolvedValue({});

  render(<DomainCreatePage />);
  await waitFor(() => expect(screen.getByLabelText('Domain Template')).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText('Domain Template'), { target: { value: 't1' } });
  expect(screen.getByLabelText(/http — HTTP:80/)).toBeChecked();
  fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'My Domain' } });
  fireEvent.change(screen.getByLabelText('Hostname'), { target: { value: 'app.example.com' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Create Domain' })[0]);

  await waitFor(() =>
    expect(domainsApi.create).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ boundListeners: ['http'] }),
    ),
  );
});

test('blocks create when no listener is checked', async () => {
  (domainsApi.create as jest.Mock).mockClear();

  render(<DomainCreatePage />);
  await waitFor(() => expect(screen.getByLabelText('Domain Template')).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText('Domain Template'), { target: { value: 't1' } });
  fireEvent.click(screen.getByLabelText(/http — HTTP:80/));
  expect(screen.getAllByText('Select at least one listener').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: 'Create Domain' })[0]).toBeDisabled();
});
