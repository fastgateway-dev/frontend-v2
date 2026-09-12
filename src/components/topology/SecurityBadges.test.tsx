import { render, screen } from '@testing-library/react';
import { SecurityBadges } from './SecurityBadges';

test('renders only enabled features', () => {
  render(<SecurityBadges flags={{
    ipAllowlist: true, mtls: false, apiKey: true, jwt: false,
    basicAuth: false, headerAuth: false, rateLimit: false,
    extAuth: false, oidc: false, waf: false,
  }} />);
  expect(screen.getByText(/IP/)).toBeInTheDocument();
  expect(screen.getByText(/API key/)).toBeInTheDocument();
  expect(screen.queryByText(/JWT/)).toBeNull();
});

test('outlined variant renders for non-enforced state', () => {
  render(<SecurityBadges flags={{
    ipAllowlist: true, mtls: false, apiKey: false, jwt: false,
    basicAuth: false, headerAuth: false, rateLimit: false,
    extAuth: false, oidc: false, waf: false,
  }} variant="outlined" />);
  expect(screen.getByTestId('badge-ipAllowlist')).toHaveClass('border');
});
