import { render, screen, fireEvent } from '@testing-library/react';
import { ClientRouteMatrix } from './ClientRouteMatrix';

const data = {
  domain: { id: 'd', name: 'd', hostname: 'h', securityMode: 'client' as const, templateName: null },
  gateway: { status: 'deployed' as const, listenerPort: 443, listenerProtocol: 'HTTPS' as const, tls: null, gatewayClass: 'envoy' },
  routes: [
    { id: 'r1', name: 'r1', protocol: 'http' as const, matcherSummary: '/a', method: 'GET',
      status: 'deployed' as const,
      routeLevelSecurity: { ipAllowlist: false, mtls: false, apiKey: false, jwt: false, basicAuth: false, headerAuth: false, rateLimit: false, extAuth: false, oidc: false, waf: false },
      backendIds: [], backendRoles: [] },
  ],
  backends: [],
  clients: [{ id: 'c1', name: 'c1', teamId: 't', teamName: 'team', capabilities: { apiKey: true, jwt: false, mtls: false, ipAllowlistSize: 0 } }],
  attachments: [{ id: 'a1', clientId: 'c1', routeId: 'r1', status: 'deployed' as const, enforced: { ipAllowlist: false, mtls: false, apiKey: true, jwt: false, basicAuth: false, headerAuth: false, rateLimit: false, extAuth: false, oidc: false, waf: false }, hasRateLimit: false, hasExtAuth: false }],
};

test('renders client × route cells (client mode)', () => {
  render(<ClientRouteMatrix data={data} onCellClick={() => {}} />);
  expect(screen.getByText('c1')).toBeInTheDocument();
  expect(screen.getByText('r1')).toBeInTheDocument();
  expect(screen.getByTestId('cell-c1-r1')).toBeInTheDocument();
});

test('cell click triggers callback', () => {
  const fn = jest.fn();
  render(<ClientRouteMatrix data={data} onCellClick={fn} />);
  fireEvent.click(screen.getByTestId('cell-c1-r1'));
  expect(fn).toHaveBeenCalledWith({ clientId: 'c1', routeId: 'r1' });
});

test('general mode degrades to routes × features', () => {
  const general = { ...data, domain: { ...data.domain, securityMode: 'general' as const }, clients: [], attachments: [] };
  render(<ClientRouteMatrix data={general} onCellClick={() => {}} />);
  expect(screen.getByText('IP')).toBeInTheDocument();
  expect(screen.getByText('JWT')).toBeInTheDocument();
});
