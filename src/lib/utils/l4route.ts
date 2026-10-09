// Pure helpers for the slim L4 (TCP/UDP) stream route form: protocol-gated
// policy capabilities, the client-side listener-port collision check and the
// payload builders. Kept free of React so they can be unit-tested directly.
import type {
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

export interface PortCollision {
  routeId: string;
  routeName: string;
  port: number;
  protocol: L4Protocol;
}

/** Parses a listener-port string; returns null unless it is an integer in 1-65535. */
export function parseListenerPort(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 1 && n <= 65535 ? n : null;
}

/**
 * Client-side live collision check. A Gateway listener is identified by
 * (transport, port), so tcp:53 and udp:53 coexist but tcp:5432 twice does not.
 * Authoritative enforcement (merged templates, reserved ports) is the backend 409.
 */
export function findPortCollision(
  existing: StreamRoute[],
  port: number | null,
  protocol: L4Protocol,
  excludeRouteId?: string
): PortCollision | null {
  if (port == null) return null;
  const hit = existing.find(
    (r) =>
      r.id !== excludeRouteId &&
      (r.protocol || '').toLowerCase() === protocol &&
      r.config?.listenerPort === port
  );
  return hit ? { routeId: hit.id, routeName: hit.name, port, protocol } : null;
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
