import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { RouteNode } from './RouteNode';

const baseFlags = {
  ipAllowlist: false, mtls: false, apiKey: false, jwt: false,
  basicAuth: false, headerAuth: false, rateLimit: false,
  extAuth: false, oidc: false, waf: false,
};

test('renders name, method+path, protocol pill, security badges (solid for general)', () => {
  render(<ReactFlowProvider><RouteNode data={{
    id: 'r1', name: 'list-orders', protocol: 'http',
    matcherSummary: '/orders', method: 'GET',
    status: 'deployed',
    securityFlags: { ...baseFlags, jwt: true }, securityVariant: 'solid',
  }} /></ReactFlowProvider>);
  expect(screen.getByText('list-orders')).toBeInTheDocument();
  expect(screen.getByText(/GET/)).toBeInTheDocument();
  expect(screen.getByText(/\/orders/)).toBeInTheDocument();
  expect(screen.getByText('http')).toBeInTheDocument();
  expect(screen.getByTestId('badge-jwt')).not.toHaveClass('border');
});

test('outlined variant when not all attachments enforce', () => {
  render(<ReactFlowProvider><RouteNode data={{
    id: 'r1', name: 'r', protocol: 'http',
    matcherSummary: '/x', method: 'POST',
    status: 'pending',
    securityFlags: { ...baseFlags, ipAllowlist: true }, securityVariant: 'outlined',
  }} /></ReactFlowProvider>);
  expect(screen.getByTestId('badge-ipAllowlist')).toHaveClass('border');
});
