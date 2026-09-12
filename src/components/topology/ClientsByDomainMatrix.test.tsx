// ClientsByDomainMatrix.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientsByDomainMatrix } from './ClientsByDomainMatrix';

const domains = [{ id: 'd1', name: 'd1', hostname: 'h1', securityMode: 'client' as const, templateName: null, gatewayStatus: 'deployed' as const, counts: { routes: 1, clientsAttached: 1, routesWithIpAllowlist: 0, routesWithMtls: 0 } }];
const clients = [{ id: 'c1', name: 'c1', teamId: 't', teamName: 'team', capabilities: { apiKey: false, jwt: false, mtls: false, ipAllowlistSize: 0 }, perDomain: { d1: { routeCount: 5, aggregateStatus: 'pending' as const } } }];

test('renders chip with N routes per cell', () => {
  const onCell = jest.fn();
  render(<ClientsByDomainMatrix domains={domains} clients={clients} onCellClick={onCell} />);
  expect(screen.getByText(/5 routes/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('cell-c1-d1'));
  expect(onCell).toHaveBeenCalledWith({ clientId: 'c1', domainId: 'd1' });
});

test('search filters clients by name', () => {
  render(<ClientsByDomainMatrix domains={domains} clients={clients} onCellClick={() => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzz' } });
  expect(screen.queryByText('c1')).toBeNull();
});
