import { render, screen } from '@testing-library/react';
import { TopologyCanvas } from './TopologyCanvas';

jest.mock('reactflow', () => ({
  __esModule: true,
  default: ({ nodes, edges }: any) => (
    <div data-testid="reactflow">
      <div data-testid="rf-nodes">{nodes.length}</div>
      <div data-testid="rf-edges">{edges.length}</div>
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: any) => children,
}));

const sampleData = {
  domain: { id: 'd', name: 'd', hostname: 'h', securityMode: 'general' as const, templateName: null },
  gateway: { status: 'deployed' as const, listenerPort: 443, listenerProtocol: 'HTTPS' as const, tls: null, gatewayClass: 'envoy' },
  routes: [{ id: 'r1', name: 'r', protocol: 'http' as const, matcherSummary: '/x', method: 'GET',
    status: 'deployed' as const, routeLevelSecurity: { ipAllowlist: false, mtls: false, apiKey: false, jwt: false, basicAuth: false, headerAuth: false, rateLimit: false, extAuth: false, oidc: false, waf: false },
    backendIds: ['svc.ns:80'], backendRoles: [{ backendId: 'svc.ns:80', role: 'primary' as const, weight: null }] }],
  backends: [{ id: 'svc.ns:80', type: 'kubernetes' as const, service: 'svc', namespace: 'ns', port: 80, hitCount: 1 }],
  clients: [], attachments: [],
};

test('renders nodes for gateway, route and backend (general mode → no client layer)', () => {
  render(<TopologyCanvas data={sampleData} onSelect={() => {}} />);
  expect(screen.getByTestId('rf-nodes').textContent).toBe('3');
  expect(screen.getByTestId('rf-edges').textContent).toBe('2');
});

test('error boundary renders fallback when reactflow throws', () => {
  jest.resetModules();
  jest.doMock('reactflow', () => ({
    __esModule: true,
    default: () => { throw new Error('boom'); },
    Background: () => null, Controls: () => null, MiniMap: () => null,
    ReactFlowProvider: ({ children }: any) => children,
  }));
  const { TopologyCanvas: Reloaded } = require('./TopologyCanvas');
  render(<Reloaded data={sampleData} onSelect={() => {}} onFallbackToMatrix={() => {}} />);
  expect(screen.getByText(/Visualization couldn't render/i)).toBeInTheDocument();
});
