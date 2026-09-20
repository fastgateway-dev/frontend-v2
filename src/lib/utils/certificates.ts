import type { ProjectPermissions, ManagedCertStatus, IssuerStatus, CertDistStatus, CreateCertificateInput } from '@/types';

export function hasCertPerm(perms: ProjectPermissions | null | undefined, perm: string): boolean {
  return !!perms && (perms.isOwner || perms.isProjectAdmin || perms.permissions.includes(perm));
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export interface BadgeSpec { label: string; variant: BadgeVariant; }

export function certStatusBadge(s: ManagedCertStatus): BadgeSpec {
  switch (s) {
    case 'ready': return { label: 'Ready', variant: 'success' };
    case 'issuing': return { label: 'Issuing', variant: 'info' };
    case 'error': return { label: 'Error', variant: 'error' };
    default: return { label: 'Pending', variant: 'warning' };
  }
}
export function issuerStatusBadge(s: IssuerStatus): BadgeSpec {
  switch (s) {
    case 'ready': return { label: 'Ready', variant: 'success' };
    case 'error': return { label: 'Error', variant: 'error' };
    default: return { label: 'Pending', variant: 'warning' };
  }
}
export function distStatusBadge(s: CertDistStatus): BadgeSpec {
  switch (s) {
    case 'synced': return { label: 'Synced', variant: 'success' };
    case 'error': return { label: 'Error', variant: 'error' };
    default: return { label: 'Pending', variant: 'warning' };
  }
}

export function validateCreateCertificate(input: CreateCertificateInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = 'Name is required';
  if (!input.issuerId) errors.issuerId = 'Select an issuer';
  if (input.usage === 'server') {
    if (!input.dnsNames || input.dnsNames.length === 0) errors.dnsNames = 'Add at least one DNS name';
  } else {
    if (!input.subject || !input.subject.trim()) errors.subject = 'Subject is required for a client certificate';
  }
  return errors;
}
