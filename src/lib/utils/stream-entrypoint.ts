// Pure helpers for a Stream's entry point: mode wording, this stream's claims,
// the free-port count and owner labels.
// Kept free of React so they can be unit-tested directly.
import type {
  DomainTemplate,
  EntrypointMode,
  EntrypointPort,
  EntrypointPortOwner,
  PortRange,
  ReservedPort,
  ReservedPortReason,
  StreamRoute,
  TransportPort,
} from '@/types';

export interface EntrypointLabel {
  badge: 'Dedicated IP' | 'Shared IP';
  explanation: string;
}

export function entrypointLabel(mode: EntrypointMode): EntrypointLabel {
  return mode === 'shared'
    ? {
        badge: 'Shared IP',
        explanation:
          "This stream is a named group of ports on the template's shared entry point. Ports are unique across everything on it.",
      }
    : { badge: 'Dedicated IP', explanation: 'This stream has its own entry point and IP.' };
}

/** mergeGateways true -> shared, false -> dedicated (the backend's rule). */
export function templateMode(t: Pick<DomainTemplate, 'mergeGateways'>): EntrypointMode {
  return t.mergeGateways ? 'shared' : 'dedicated';
}

/** Stream-create template option, e.g. "shared-envoy — Shared IP". */
export function templateOptionLabel(t: Pick<DomainTemplate, 'name' | 'mergeGateways'>): string {
  return `${t.name} — ${entrypointLabel(templateMode(t)).badge}`;
}

/** "5432/TCP". */
export function portLabel(p: TransportPort): string {
  return `${p.port}/${p.transport.toUpperCase()}`;
}

/** By port, then transport (TCP before UDP). */
export function comparePorts(a: TransportPort, b: TransportPort): number {
  return a.port - b.port || a.transport.localeCompare(b.transport);
}

/** This stream's own claims (owner kind stream, same streamId), sorted. */
export function myClaims(ports: EntrypointPort[], streamId: string): EntrypointPort[] {
  if (!streamId) return [];
  return ports
    .filter((p) => p.owner.kind === 'stream' && p.owner.streamId === streamId)
    .sort(comparePorts);
}

export function rangeSize(range: PortRange): number {
  return Math.max(0, range.max - range.min + 1);
}

/**
 * Port numbers in [min, max] that no listed port and no reservation holds, on any
 * transport. Conservative on purpose: a number used or reserved on one transport
 * is counted as taken, so the UI never calls a port free that create would reject.
 * Null when there is no range.
 */
export function freePortCount(
  range: PortRange | null,
  ports: TransportPort[],
  reserved: TransportPort[]
): number | null {
  if (!range || range.max < range.min) return null;
  const taken = new Set<number>();
  for (const p of [...ports, ...reserved]) {
    if (p.port >= range.min && p.port <= range.max) taken.add(p.port);
  }
  return rangeSize(range) - taken.size;
}

// Mirrors RESERVED_PORTS in gateway-listeners.ts / the backend DefaultReservedPorts.
// Validation rejects these numbers on both transports, so both are listed.
const PLATFORM_RESERVED: ReservedPort[] = (
  [
    [19000, 'envoy_internal'],
    [19001, 'envoy_internal'],
  ] as const
).flatMap(([port, reason]) =>
  (['TCP', 'UDP'] as const).map((transport) => ({ transport, port, reason }))
);

const reservedKey = (r: TransportPort) => `${r.transport}/${r.port}`;

/** The response's reserved list plus any platform entry it left out (keyed by transport + port), sorted. */
export function withDefaultReserved(reserved: ReservedPort[]): ReservedPort[] {
  const have = new Set(reserved.map(reservedKey));
  return [...reserved, ...PLATFORM_RESERVED.filter((r) => !have.has(reservedKey(r)))].sort(comparePorts);
}

/** Display lines: one per (port, reason), transports merged — "19000/TCP+UDP (Envoy internal)". */
export function reservedSummary(reserved: ReservedPort[]): string[] {
  const groups = new Map<string, { port: number; reason: ReservedPortReason; transports: string[] }>();
  for (const r of [...reserved].sort(comparePorts)) {
    const key = `${r.port}|${r.reason}`;
    const g = groups.get(key) ?? { port: r.port, reason: r.reason, transports: [] };
    if (!g.transports.includes(r.transport)) g.transports.push(r.transport);
    groups.set(key, g);
  }
  return [...groups.values()].map(
    (g) => `${g.port}/${g.transports.join('+')} (${REASON_LABELS[g.reason] ?? g.reason})`
  );
}

const REASON_LABELS: Record<ReservedPortReason, string> = {
  envoy_internal: 'Envoy internal',
  template_listener: 'Template listener',
};

/** "19000/TCP (Envoy internal)". */
export function reservedLabel(r: ReservedPort): string {
  return `${portLabel(r)} (${REASON_LABELS[r.reason] ?? r.reason})`;
}

/** "Stream cache · route redis", "Stream cache" (a bare claim) or "Domain api". */
export function ownerLabel(owner: EntrypointPortOwner): string {
  if (owner.kind === 'domain') return `Domain ${owner.domainName || owner.domainId || 'unknown'}`;
  const stream = `Stream ${owner.streamName || owner.streamId || 'unknown'}`;
  const route = owner.routeName || owner.routeId;
  return route ? `${stream} · route ${route}` : stream;
}

export type ClaimProblem = 'invalid' | 'reserved' | 'out_of_range' | 'duplicate' | 'taken';

export interface ClaimContext {
  range: PortRange | null;
  reserved: ReservedPort[];
  /** The entry point's port map; the stream's own claims in it are ignored. */
  taken: EntrypointPort[];
  selfStreamId?: string;
}

const sameClaim = (a: TransportPort, b: TransportPort) =>
  a.port === b.port && a.transport.toUpperCase() === b.transport.toUpperCase();

/** The entry point port-map row (not the stream's own) holding this claim, if any. */
function takenBy(claim: TransportPort, ctx: ClaimContext): EntrypointPort | undefined {
  return ctx.taken.find(
    (t) =>
      sameClaim(t, claim) &&
      !(ctx.selfStreamId && t.owner.kind === 'stream' && t.owner.streamId === ctx.selfStreamId)
  );
}

/**
 * Why a claim can't be added to `current`, or null when it can. Checks in the
 * order the user should fix them: bounds, reservations (per transport: a template's
 * hostname-routed ports are reserved for TCP only, Envoy's internal ports on both,
 * like the backend), the template's range, the set itself, then other owners.
 */
export function claimProblem(
  claim: TransportPort,
  current: TransportPort[],
  ctx: ClaimContext
): ClaimProblem | null {
  if (!Number.isInteger(claim.port) || claim.port < 1 || claim.port > 65535) return 'invalid';
  if (ctx.reserved.some((r) => sameClaim(r, claim))) return 'reserved';
  if (ctx.range && (claim.port < ctx.range.min || claim.port > ctx.range.max)) return 'out_of_range';
  if (current.some((c) => sameClaim(c, claim))) return 'duplicate';
  if (takenBy(claim, ctx)) return 'taken';
  return null;
}

export function claimProblemMessage(p: ClaimProblem, claim: TransportPort, ctx: ClaimContext): string {
  switch (p) {
    case 'invalid':
      return 'Port must be between 1 and 65535';
    case 'reserved':
      return `${portLabel(claim)} is reserved`;
    case 'out_of_range':
      return ctx.range ? `Must be within ${ctx.range.min}–${ctx.range.max}` : 'Port is outside the allowed range';
    case 'duplicate':
      return `${portLabel(claim)} is already claimed`;
    case 'taken': {
      const owner = takenBy(claim, ctx)?.owner;
      return owner ? `${portLabel(claim)} is used by ${ownerLabel(owner)}` : `${portLabel(claim)} is used by another owner`;
    }
  }
}

/**
 * Claimed ports on a transport that no live route uses, ascending. A route
 * being edited (ownRouteId) doesn't hold its own port; rejected routes hold none.
 */
export function freeClaims(
  claims: TransportPort[],
  routes: StreamRoute[],
  transport: 'TCP' | 'UDP',
  ownRouteId?: string
): number[] {
  const used = new Set<number>();
  for (const r of routes) {
    const port = r.config?.listenerPort;
    if (port == null || r.id === ownRouteId || r.status === 'rejected') continue;
    if (r.protocol.toUpperCase() === transport) used.add(port);
  }
  return claims
    .filter((c) => c.transport.toUpperCase() === transport && !used.has(c.port))
    .map((c) => c.port)
    .sort((a, b) => a - b);
}
