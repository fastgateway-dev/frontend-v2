// Pure helpers for the Gateway Template listener model: grouping for the
// template form, client-side validation mirroring the backend
// ValidateTemplateListeners, and domain TLS-secret gating. Kept free of React
// so they can be unit-tested directly.
import type { TemplateListener } from '@/types';

export const RESERVED_PORTS = [19000, 19001, 60000];

const isStream = (l: TemplateListener): boolean => l.protocol === 'TCP' || l.protocol === 'UDP';

/** Listeners a domain can bind (hostname-routed): HTTP, HTTPS, TLS. */
export function hostnameListeners(listeners: TemplateListener[]): TemplateListener[] {
  return listeners.filter((l) => !isStream(l));
}

/** The single TCP/UDP range listener, or null. */
export function streamListener(listeners: TemplateListener[]): TemplateListener | null {
  return listeners.find(isStream) ?? null;
}

/** Grouping for the template form UI. */
export function groupListeners(listeners: TemplateListener[]): {
  http: TemplateListener[];
  tls: TemplateListener[];
  stream: TemplateListener | null;
} {
  return {
    http: listeners.filter((l) => l.protocol === 'HTTP' || l.protocol === 'HTTPS'),
    tls: listeners.filter((l) => l.protocol === 'TLS'),
    stream: streamListener(listeners),
  };
}

const validPort = (n: number | undefined): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 65535;

/**
 * Human message or null. Mirrors the backend ValidateTemplateListeners checks
 * except that a fixed port inside the TCP/UDP range is NOT a conflict: the
 * range is an allowed-range constraint, not a per-port claim.
 */
export function listenerPortConflict(listeners: TemplateListener[]): string | null {
  const seen = new Set<number>();
  for (const l of listeners) {
    if (isStream(l) || l.port == null) continue;
    if (RESERVED_PORTS.includes(l.port)) {
      return `Port ${l.port} is reserved and cannot be used by listener "${l.name}"`;
    }
    if (seen.has(l.port)) {
      return `Port ${l.port} is used by more than one listener`;
    }
    seen.add(l.port);
  }

  const streams = listeners.filter(isStream);
  for (const l of streams) {
    if (!validPort(l.portRangeMin) || !validPort(l.portRangeMax) || l.portRangeMin > l.portRangeMax) {
      return `Listener "${l.name}" needs a valid port range (1-65535, min must not exceed max)`;
    }
  }
  if (streams.length > 1) {
    return 'Only one TCP/UDP port range listener is allowed';
  }
  return null;
}

/**
 * First human-readable problem with the listener set, or null when it is
 * submittable. Order: empty, hostname-listener ports, port/range conflicts
 * (listenerPortConflict), names.
 */
export function listenerIssue(listeners: TemplateListener[]): string | null {
  if (listeners.length === 0) return 'Add at least one listener';

  for (const l of hostnameListeners(listeners)) {
    if (!validPort(l.port)) {
      const label = l.name.trim() === '' ? `(${l.protocol})` : `"${l.name}"`;
      return `Listener ${label} needs a port between 1 and 65535`;
    }
  }

  const conflict = listenerPortConflict(listeners);
  if (conflict !== null) return conflict;

  const seen = new Set<string>();
  for (const l of listeners) {
    const name = l.name.trim();
    if (name === '') return 'Every listener needs a name';
    if (seen.has(name)) return `Listener name "${name}" is used more than once`;
    seen.add(name);
  }
  return null;
}

/** At least one listener and no validation issue (see listenerIssue). */
export function canSubmitTemplate(listeners: TemplateListener[]): boolean {
  return listeners.length > 0 && listenerIssue(listeners) === null;
}

/** True if any bound listener is HTTPS that terminates TLS (mirrors backend domainNeedsTLSSecret). */
export function domainNeedsTLSSecret(boundNames: string[], listeners: TemplateListener[]): boolean {
  return listeners.some(
    (l) => boundNames.includes(l.name) && l.protocol === 'HTTPS' && l.tlsMode !== 'Passthrough'
  );
}

/** Short display label, e.g. "HTTP:80", "HTTPS:443 (Terminate)", "TCP/UDP 9000-9100". */
export function listenerLabel(l: TemplateListener): string {
  if (isStream(l)) return `TCP/UDP ${l.portRangeMin}-${l.portRangeMax}`;
  const base = `${l.protocol}:${l.port}`;
  return l.tlsMode ? `${base} (${l.tlsMode})` : base;
}
