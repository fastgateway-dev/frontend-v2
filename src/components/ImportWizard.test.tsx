import { render, screen } from '@testing-library/react';
import { ImportWizard } from './ImportWizard';

jest.mock('@/lib/api', () => ({
  projectTeamsApi: { listMyTeams: jest.fn().mockResolvedValue([]) },
}));

test('does not render the Natural Language card', async () => {
  render(<ImportWizard projectId="p1" domainId="d1" />);
  expect(screen.queryByText('Create with Natural Language')).toBeNull();
});

test('renders the four import-only cards', async () => {
  render(<ImportWizard projectId="p1" domainId="d1" />);
  expect(await screen.findByText('Import Kubernetes Ingress')).toBeInTheDocument();
  expect(screen.getByText('Import Istio Configuration')).toBeInTheDocument();
  expect(screen.getByText('Import Kong Configuration')).toBeInTheDocument();
  expect(screen.getByText('Import from OpenAPI')).toBeInTheDocument();
});

test('renders the new heading', async () => {
  render(<ImportWizard projectId="p1" domainId="d1" />);
  expect(await screen.findByText('Import Routes')).toBeInTheDocument();
});
