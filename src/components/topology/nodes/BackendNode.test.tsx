import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { BackendNode } from './BackendNode';

test('renders k8s identity and hit count', () => {
  render(<ReactFlowProvider><BackendNode data={{
    id: 'svc.ns:8080', type: 'kubernetes', service: 'svc', namespace: 'ns', port: 8080, hitCount: 3,
  }} /></ReactFlowProvider>);
  expect(screen.getByText('svc.ns:8080')).toBeInTheDocument();
  expect(screen.getByText(/3 routes/)).toBeInTheDocument();
  expect(screen.getByText('k8s')).toBeInTheDocument();
});

test('renders external fqdn chip', () => {
  render(<ReactFlowProvider><BackendNode data={{
    id: 'a.example.com:443', type: 'external', address: 'a.example.com', addressType: 'fqdn', port: 443, hitCount: 1,
  }} /></ReactFlowProvider>);
  expect(screen.getByText(/fqdn/)).toBeInTheDocument();
});
