import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { ClientNode } from './ClientNode';

test('renders name, team, capabilities, and aggregate status dot', () => {
  render(<ReactFlowProvider><ClientNode data={{
    id: 'c1', name: 'orders-svc', teamName: 'team-a',
    capabilities: { apiKey: true, jwt: false, mtls: true, ipAllowlistSize: 3 },
    aggregateStatus: 'pending',
  }} /></ReactFlowProvider>);
  expect(screen.getByText('orders-svc')).toBeInTheDocument();
  expect(screen.getByText(/team-a/)).toBeInTheDocument();
  expect(screen.getByTestId('badge-apiKey')).toBeInTheDocument();
  expect(screen.getByTestId('badge-mtls')).toBeInTheDocument();
  expect(screen.getByText(/3 IPs/)).toBeInTheDocument();
});
