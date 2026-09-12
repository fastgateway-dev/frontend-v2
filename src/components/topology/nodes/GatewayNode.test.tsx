import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { GatewayNode } from './GatewayNode';

test('renders hostname, listener, tls, gatewayClass, status dot', () => {
  render(<ReactFlowProvider><GatewayNode data={{
    hostname: 'api.example.com',
    listenerPort: 443, listenerProtocol: 'HTTPS',
    tls: { secretName: 'wildcard', secretNamespace: 'fastgateway-system' },
    gatewayClass: 'envoy', status: 'deployed',
  }} /></ReactFlowProvider>);
  expect(screen.getByText('api.example.com')).toBeInTheDocument();
  expect(screen.getByText(/HTTPS:443/)).toBeInTheDocument();
  expect(screen.getByText(/wildcard/)).toBeInTheDocument();
  expect(screen.getByText(/envoy/)).toBeInTheDocument();
  expect(screen.getByText('Deployed')).toBeInTheDocument();
});
