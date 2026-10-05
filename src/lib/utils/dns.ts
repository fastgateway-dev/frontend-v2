import type { DNSRecordStatus, DNSHostedZone } from '@/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export interface BadgeSpec { label: string; variant: BadgeVariant; }

export function dnsRecordStatusBadge(s: DNSRecordStatus): BadgeSpec {
  switch (s) {
    case 'ready': return { label: 'Ready', variant: 'success' };
    case 'error': return { label: 'Error', variant: 'error' };
    default: return { label: 'Pending', variant: 'warning' };
  }
}

/**
 * Returns the hosted zones that cover `hostname` — an exact match on the
 * zone's apex, or the hostname being a subdomain of it — sorted by zone
 * name length descending so the most specific (longest-suffix) match is
 * first.
 */
export function matchingZonesFor(hostname: string, zones: DNSHostedZone[]): DNSHostedZone[] {
  if (!hostname) return [];
  return zones
    .filter((zone) => zone.name === hostname || hostname.endsWith(`.${zone.name}`))
    .sort((a, b) => b.name.length - a.name.length);
}
