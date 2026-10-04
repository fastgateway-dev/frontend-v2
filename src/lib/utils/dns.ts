import type { DNSRecordStatus } from '@/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export interface BadgeSpec { label: string; variant: BadgeVariant; }

export function dnsRecordStatusBadge(s: DNSRecordStatus): BadgeSpec {
  switch (s) {
    case 'ready': return { label: 'Ready', variant: 'success' };
    case 'syncing': return { label: 'Syncing', variant: 'info' };
    case 'error': return { label: 'Error', variant: 'error' };
    default: return { label: 'Pending', variant: 'warning' };
  }
}
