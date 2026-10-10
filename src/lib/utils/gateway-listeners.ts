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

/** At least one listener, no conflicts, and every name non-empty and unique. */
export function canSubmitTemplate(listeners: TemplateListener[]): boolean {
  if (listeners.length === 0) return false;
  if (listenerPortConflict(listeners) !== null) return false;
  const names = listeners.map((l) => l.name.trim());
  if (names.some((n) => n === '')) return false;
  return new Set(names).size === names.length;
}

/** True if any bound listener is HTTPS that terminates TLS (mirrors backend domainNeedsTLSSecret). */
export function domainNeedsTLSSecret(boundNames: string[], listeners: TemplateListener[]): boolean {
  return listeners.some(
    (l) => boundNames.includes(l.name) && l.protocol === 'HTTPS' && l.tlsMode !== 'Passthrough'
  );
}
