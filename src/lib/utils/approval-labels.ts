// Pure helpers for the approvals pages: the parent label (stream for L4 routes,
// domain for L7) and diff section titles from the diff's routeKind.
import type { RouteKind } from '@/types';

/** "Stream: tcp-stream" for an L4 route, the domain name for an L7 one, else null. */
export function approvalContextLabel(a: { streamName?: string; domainName?: string }): string | null {
  if (a.streamName) return `Stream: ${a.streamName}`;
  return a.domainName || null;
}

export interface DiffSectionTitles {
  route: string;
  backendTrafficPolicy: string;
}

/** Older backends send no routeKind: keep today's HTTPRoute titles. */
export function diffSectionTitles(routeKind?: RouteKind): DiffSectionTitles {
  const kind = routeKind ?? 'HTTPRoute';
  const l4 = kind === 'TCPRoute' || kind === 'UDPRoute';
  return {
    route: `${kind} Changes`,
    // L4 policies carry LB / circuit breaker / health check, never compression.
    backendTrafficPolicy: l4 ? 'BackendTrafficPolicy Changes' : 'BackendTrafficPolicy Changes (Compression)',
  };
}
