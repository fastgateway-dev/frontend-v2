import type {
  TopologyStatus,
  SecurityFeatureFlags,
  ProjectTopologyResponse,
  DomainTopologyResponse,
} from './topology';

test('TopologyStatus literal union', () => {
  const s: TopologyStatus = 'deployed';
  expect(['deployed', 'pending', 'failed', 'draft']).toContain(s);
});

test('SecurityFeatureFlags has all keys', () => {
  const f: SecurityFeatureFlags = {
    ipAllowlist: false, mtls: false, apiKey: false, jwt: false,
    basicAuth: false, headerAuth: false, rateLimit: false,
    extAuth: false, oidc: false, waf: false,
  };
  expect(Object.keys(f).length).toBe(10);
});

test('Response shapes compile', () => {
  const p: ProjectTopologyResponse = { domains: [], clients: [], ips: [] };
  const d: DomainTopologyResponse = {
    domain: { id: 'x', name: 'n', hostname: 'h', securityMode: 'general', templateName: null },
    gateway: { status: 'draft', listenerPort: 443, listenerProtocol: 'HTTPS', tls: null, gatewayClass: 'envoy' },
    routes: [], backends: [], clients: [], attachments: [],
  };
  expect(p).toBeTruthy(); expect(d).toBeTruthy();
});
