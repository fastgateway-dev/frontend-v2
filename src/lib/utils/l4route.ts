// Pure helpers for the slim L4 (TCP/UDP) stream route form: protocol-gated
// policy capabilities, the client-side listener-port collision check and the
// payload builders. Kept free of React so they can be unit-tested directly.
import type {
  BackendTrafficPolicyConfig,
  BackendTrafficPolicyInput,
  CreateRouteInput,
  HealthCheckConfig,
  LoadBalancerType,
  Route,
  RouteBackend,
  StreamRoute,
  UpdateRouteInput,
} from '@/types';

export type L4Protocol = 'tcp' | 'udp';

export const L4_LB_TYPES: LoadBalancerType[] = ['RoundRobin', 'Random', 'LeastRequest'];

/** Which BackendTrafficPolicy sections apply to an L4 protocol (mirrors the backend gate). */
export interface L4PolicyCapabilities {
  loadBalancer: boolean;
  circuitBreaker: boolean;
  healthCheck: boolean;
}

export function policyCapabilities(protocol: L4Protocol): L4PolicyCapabilities {
  // TCP: circuit breaker + LB + health check. UDP: LB only.
  return protocol === 'tcp'
    ? { loadBalancer: true, circuitBreaker: true, healthCheck: true }
    : { loadBalancer: true, circuitBreaker: false, healthCheck: false };
}

export interface L4BackendForm {
  namespace: string;
  service: string;
  port: string;
  weight: string;
}

export interface L4PolicyForm {
  lbEnabled: boolean;
  lbType: LoadBalancerType;
  cbEnabled: boolean;
  cbMaxConnections: string;
  cbMaxRequestsPerConnection: string;
  hcEnabled: boolean;
  hcTimeout: string;
  hcInterval: string;
  hcUnhealthyThreshold: string;
  hcHealthyThreshold: string;
}

export const emptyPolicyForm = (): L4PolicyForm => ({
  lbEnabled: false,
  lbType: 'RoundRobin',
  cbEnabled: false,
  cbMaxConnections: '',
  cbMaxRequestsPerConnection: '',
  hcEnabled: false,
  hcTimeout: '',
  hcInterval: '',
  hcUnhealthyThreshold: '',
  hcHealthyThreshold: '',
});

/** Parses a listener-port string; returns null unless it is an integer in 1-65535. */
export function parseListenerPort(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 1 && n <= 65535 ? n : null;
}

const toInt = (s: string): number | undefined => {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export function buildBackends(backends: L4BackendForm[]): RouteBackend[] {
  return backends.map((b) => ({
    type: 'kubernetes' as const,
    service: b.service,
    namespace: b.namespace,
    port: Number(b.port),
    weight: toInt(b.weight) ?? 100,
  }));
}

/** Builds the protocol-gated BackendTrafficPolicy, or undefined when nothing is enabled. */
export function buildPolicy(protocol: L4Protocol, f: L4PolicyForm): BackendTrafficPolicyInput | undefined {
  const caps = policyCapabilities(protocol);
  const btp: BackendTrafficPolicyInput = {};

  if (caps.loadBalancer && f.lbEnabled) {
    btp.loadBalancer = { type: f.lbType };
  }
  if (caps.circuitBreaker && f.cbEnabled) {
    const cb = {
      maxConnections: toInt(f.cbMaxConnections),
      maxRequestsPerConnection: toInt(f.cbMaxRequestsPerConnection),
    };
    if (cb.maxConnections !== undefined || cb.maxRequestsPerConnection !== undefined) {
      btp.circuitBreaker = {
        ...(cb.maxConnections !== undefined && { maxConnections: cb.maxConnections }),
        ...(cb.maxRequestsPerConnection !== undefined && { maxRequestsPerConnection: cb.maxRequestsPerConnection }),
      };
    }
  }
  if (caps.healthCheck && f.hcEnabled) {
    const active: NonNullable<HealthCheckConfig['active']> = { type: 'TCP' };
    if (f.hcTimeout.trim()) active.timeout = f.hcTimeout.trim();
    if (f.hcInterval.trim()) active.interval = f.hcInterval.trim();
    const unhealthy = toInt(f.hcUnhealthyThreshold);
    const healthy = toInt(f.hcHealthyThreshold);
    if (unhealthy !== undefined) active.unhealthyThreshold = unhealthy;
    if (healthy !== undefined) active.healthyThreshold = healthy;
    btp.healthCheck = { active };
  }
  return Object.keys(btp).length > 0 ? btp : undefined;
}

export interface L4FormValues {
  name: string;
  description: string;
  teamId: string;
  protocol: L4Protocol;
  listenerPort: number;
  backends: L4BackendForm[];
  policy: L4PolicyForm;
}

/** Create payload: no matches/filters/security/TLS; listenerPort lives in config. */
export function buildCreateInput(streamId: string, v: L4FormValues): CreateRouteInput {
  const btp = buildPolicy(v.protocol, v.policy);
  return {
    streamId,
    name: v.name,
    description: v.description || undefined,
    protocol: v.protocol,
    teamId: v.teamId,
    config: {
      matches: [],
      backends: buildBackends(v.backends),
      listenerPort: v.listenerPort,
    },
    ...(btp && { backendTrafficPolicy: btp }),
  };
}

/** Update payload (name/protocol/team are immutable after create). */
export function buildUpdateInput(v: L4FormValues): UpdateRouteInput {
  const btp = buildPolicy(v.protocol, v.policy);
  return {
    description: v.description || undefined,
    config: {
      matches: [],
      backends: buildBackends(v.backends),
      listenerPort: v.listenerPort,
    },
    ...(btp && { backendTrafficPolicy: btp }),
  };
}

/** Hydrates the form-state pieces from a saved route (edit page). */
export function routeToFormState(route: Route): {
  backends: L4BackendForm[];
  policy: L4PolicyForm;
  listenerPort: string;
} {
  const p = emptyPolicyForm();
  const cfg = route.backendTrafficPolicy?.config;
  if (cfg?.loadBalancer) {
    p.lbEnabled = true;
    p.lbType = cfg.loadBalancer.type;
  }
  if (cfg?.circuitBreaker) {
    p.cbEnabled = true;
    if (cfg.circuitBreaker.maxConnections != null) p.cbMaxConnections = String(cfg.circuitBreaker.maxConnections);
    if (cfg.circuitBreaker.maxRequestsPerConnection != null)
      p.cbMaxRequestsPerConnection = String(cfg.circuitBreaker.maxRequestsPerConnection);
  }
  const active = cfg?.healthCheck?.active;
  if (active) {
    p.hcEnabled = true;
    p.hcTimeout = active.timeout ?? '';
    p.hcInterval = active.interval ?? '';
    if (active.unhealthyThreshold != null) p.hcUnhealthyThreshold = String(active.unhealthyThreshold);
    if (active.healthyThreshold != null) p.hcHealthyThreshold = String(active.healthyThreshold);
  }
  return {
    backends: (route.config?.backends ?? []).map((b) => ({
      namespace: b.namespace ?? '',
      service: b.service ?? '',
      port: String(b.port ?? ''),
      weight: String(b.weight ?? 100),
    })),
    policy: p,
    listenerPort: route.config?.listenerPort != null ? String(route.config.listenerPort) : '',
  };
}

// ---- Tabbed form: Basic Info · Backends · Traffic Policy · Preview ----

export type L4FormTab = 'basic' | 'backends' | 'policy' | 'preview';
export const L4_FORM_TABS: L4FormTab[] = ['basic', 'backends', 'policy', 'preview'];

/** Which tab shows the field a validation key belongs to. */
export function tabForErrorKey(key: string): L4FormTab {
  if (key === 'name' || key === 'team' || key === 'port') return 'basic';
  if (key === 'backends' || key.startsWith('backend-')) return 'backends';
  return 'policy';
}

/** The tabs that hold at least one non-empty error, in tab order (drives the tab badges). */
export function tabErrors(errors: Record<string, string | null | undefined>): L4FormTab[] {
  const hit = new Set<L4FormTab>();
  for (const [key, msg] of Object.entries(errors)) {
    if (msg) hit.add(tabForErrorKey(key));
  }
  return L4_FORM_TABS.filter((t) => hit.has(t));
}

export function errorsForTab(errors: Record<string, string>, tab: L4FormTab): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => tabForErrorKey(key) === tab));
}

/** prev with `tab`'s errors replaced by `next` (other tabs' errors are kept). */
export function mergeTabErrors(
  prev: Record<string, string>,
  tab: L4FormTab,
  next: Record<string, string>
): Record<string, string> {
  const kept = Object.fromEntries(Object.entries(prev).filter(([key]) => tabForErrorKey(key) !== tab));
  return { ...kept, ...next };
}

export interface L4ValidationInput {
  isEdit: boolean;
  name: string;
  teamId: string;
  protocol: L4Protocol;
  /** The selected claimed port, or null when none is selected. */
  port: number | null;
  backends: L4BackendForm[];
}

/** The L4 route form's client-side rules; the server's 400/409 stays authoritative for the port. Keys: name, team, port, backends, backend-<i>. */
export function validateL4Form(v: L4ValidationInput): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!v.isEdit) {
    if (!v.name.trim()) errs.name = 'Name is required';
    if (!v.teamId) errs.team = 'Owner team is required';
  }
  if (v.port == null) errs.port = 'Select a listener port';
  if (v.backends.length === 0) errs.backends = 'At least one backend is required';
  v.backends.forEach((b, i) => {
    if (!b.namespace || !b.service) errs[`backend-${i}`] = 'Namespace and service are required';
    else if (!/^\d+$/.test(b.port) || Number(b.port) < 1 || Number(b.port) > 65535)
      errs[`backend-${i}`] = 'Backend port must be between 1 and 65535';
    else if (b.weight !== '' && (!/^\d+$/.test(b.weight) || Number(b.weight) > 100))
      errs[`backend-${i}`] = 'Weight must be between 0 and 100';
  });
  return errs;
}

// ---- Manifests, status and actions ----

/** Kind of the route manifest an L4 route renders to. */
export function l4RouteKind(protocol: string): 'TCPRoute' | 'UDPRoute' {
  return protocol.toLowerCase() === 'udp' ? 'UDPRoute' : 'TCPRoute';
}

export type DiffMode = 'create' | 'update' | 'delete';

/** YamlDiffViewer mode for one manifest; null when there is nothing on either side. */
export function diffMode(current?: string, proposed?: string): DiffMode | null {
  if (!current && !proposed) return null;
  if (!current) return 'create';
  if (!proposed) return 'delete';
  return 'update';
}

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

/** Badge for a stream status or an L4 route status. */
export function l4StatusBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'active':
      return { variant: 'success', label: 'Active' };
    case 'approved':
      return { variant: 'info', label: 'Approved - Ready to Deploy' };
    case 'pending_deploy':
      return { variant: 'info', label: 'Pending Deploy' };
    case 'pending_create':
    case 'pending_update':
    case 'pending_delete':
      return { variant: 'warning', label: 'Pending Approval' };
    case 'pending':
      return { variant: 'warning', label: 'Pending' };
    case 'error':
      return { variant: 'error', label: 'Error' };
    case 'rejected':
      return { variant: 'error', label: 'Rejected' };
    default:
      return { variant: 'default', label: status };
  }
}

const IN_FLIGHT = ['pending_create', 'pending_update', 'pending_delete', 'approved', 'pending_deploy'];

/** Route detail actions, with the same gates as the HTTP route detail page. */
export function routeActions(
  status: string,
  canCreateRoutes: boolean
): { canEdit: boolean; canDelete: boolean; canDeploy: boolean; awaitingApproval: boolean } {
  const inFlight = IN_FLIGHT.includes(status);
  return {
    canEdit: canCreateRoutes && !inFlight,
    canDelete: canCreateRoutes && !inFlight,
    canDeploy: status === 'approved' || status === 'pending_deploy',
    awaitingApproval: status === 'pending_create' || status === 'pending_update' || status === 'pending_delete',
  };
}

/** One human-readable line per configured L4 policy section (Overview tab). */
export function policySummary(cfg: BackendTrafficPolicyConfig | undefined): string[] {
  if (!cfg) return [];
  const out: string[] = [];
  if (cfg.loadBalancer) out.push(`Load balancing: ${cfg.loadBalancer.type}`);
  if (cfg.circuitBreaker) {
    const parts: string[] = [];
    if (cfg.circuitBreaker.maxConnections != null) parts.push(`max ${cfg.circuitBreaker.maxConnections} connections`);
    if (cfg.circuitBreaker.maxRequestsPerConnection != null)
      parts.push(`max ${cfg.circuitBreaker.maxRequestsPerConnection} requests per connection`);
    out.push(`Circuit breaker: ${parts.length > 0 ? parts.join(', ') : 'defaults'}`);
  }
  const active = cfg.healthCheck?.active;
  if (active) {
    const parts = [`${active.type} active`];
    if (active.interval) parts.push(`every ${active.interval}`);
    if (active.timeout) parts.push(`timeout ${active.timeout}`);
    if (active.unhealthyThreshold != null) parts.push(`unhealthy after ${active.unhealthyThreshold}`);
    if (active.healthyThreshold != null) parts.push(`healthy after ${active.healthyThreshold}`);
    out.push(`Health check: ${parts.join(', ')}`);
  }
  return out;
}
