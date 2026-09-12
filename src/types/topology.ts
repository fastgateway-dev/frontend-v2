export type TopologyStatus = 'deployed' | 'pending' | 'failed' | 'draft';

export interface SecurityFeatureFlags {
  ipAllowlist: boolean;
  mtls: boolean;
  apiKey: boolean;
  jwt: boolean;
  basicAuth: boolean;
  headerAuth: boolean;
  rateLimit: boolean;
  extAuth: boolean;
  oidc: boolean;
  waf: boolean;
}

export interface ProjectTopologyDomainCount {
  routes: number;
  clientsAttached: number;
  routesWithIpAllowlist: number;
  routesWithMtls: number;
}

export interface ProjectTopologyDomain {
  id: string;
  name: string;
  hostname: string;
  securityMode: 'general' | 'client';
  templateName: string | null;
  gatewayStatus: TopologyStatus;
  counts: ProjectTopologyDomainCount;
}

export interface ClientCapabilities {
  apiKey: boolean;
  jwt: boolean;
  mtls: boolean;
  ipAllowlistSize: number;
}

export interface ProjectTopologyClientPerDomain {
  routeCount: number;
  aggregateStatus: TopologyStatus;
}

export interface ProjectTopologyClient {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  capabilities: ClientCapabilities;
  perDomain: Record<string, ProjectTopologyClientPerDomain>;
}

export interface TopologyIPSourceRef {
  id: string;
  name: string;
}

export interface TopologyIPReach {
  routeIds: string[];
  domainIds: string[];
}

export interface TopologyIPRow {
  cidr: string;
  source: 'route' | 'client';
  sourceRef: TopologyIPSourceRef;
  reach: TopologyIPReach;
  updatedAt: string;
}

export interface ProjectTopologyResponse {
  domains: ProjectTopologyDomain[];
  clients: ProjectTopologyClient[];
  ips: TopologyIPRow[];
}

export interface DomainTopologyDomain {
  id: string;
  name: string;
  hostname: string;
  securityMode: 'general' | 'client';
  templateName: string | null;
}

export interface DomainTopologyGatewayTLS {
  secretName: string;
  secretNamespace: string;
}

export interface DomainTopologyGateway {
  status: TopologyStatus;
  listenerPort: number;
  listenerProtocol: 'HTTP' | 'HTTPS';
  tls: DomainTopologyGatewayTLS | null;
  gatewayClass: string;
}

export interface DomainTopologyBackendRole {
  backendId: string;
  role: 'primary' | 'fallback' | 'mirror';
  weight: number | null;
}

export interface DomainTopologyRoute {
  id: string;
  name: string;
  protocol: 'http' | 'grpc';
  matcherSummary: string;
  method: string | null;
  status: TopologyStatus;
  routeLevelSecurity: SecurityFeatureFlags;
  backendIds: string[];
  backendRoles: DomainTopologyBackendRole[];
}

export interface DomainTopologyBackend {
  id: string;
  type: 'kubernetes' | 'external';
  service?: string;
  namespace?: string;
  address?: string;
  addressType?: 'fqdn' | 'ip';
  port: number;
  hitCount: number;
}

export interface DomainTopologyClient {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  capabilities: ClientCapabilities;
}

export interface DomainTopologyAttachment {
  id: string;
  clientId: string;
  routeId: string;
  status: TopologyStatus;
  enforced: SecurityFeatureFlags;
  hasRateLimit: boolean;
  hasExtAuth: boolean;
}

export interface DomainTopologyResponse {
  domain: DomainTopologyDomain;
  gateway: DomainTopologyGateway;
  routes: DomainTopologyRoute[];
  backends: DomainTopologyBackend[];
  clients: DomainTopologyClient[];
  attachments: DomainTopologyAttachment[];
}
