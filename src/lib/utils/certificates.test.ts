import { hasCertPerm, validateCreateCertificate, certStatusBadge } from './certificates';
import type { ProjectPermissions } from '@/types';

const perms = (over: Partial<ProjectPermissions>): ProjectPermissions => ({
  canManageDomainTemplates: false, canManageDomains: false, canManageTeams: false,
  canCreateRoutes: false, canApproveRoutes: false, canViewAudit: false,
  permissions: [], isOwner: false, isProjectAdmin: false, ...over,
});

test('hasCertPerm: owner and admin always true', () => {
  expect(hasCertPerm(perms({ isOwner: true }), 'certificate.create')).toBe(true);
  expect(hasCertPerm(perms({ isProjectAdmin: true }), 'certificate.delete')).toBe(true);
});
test('hasCertPerm: explicit permission grants', () => {
  expect(hasCertPerm(perms({ permissions: ['certificate.view'] }), 'certificate.view')).toBe(true);
  expect(hasCertPerm(perms({ permissions: ['certificate.view'] }), 'certificate.create')).toBe(false);
});
test('hasCertPerm: null perms is false', () => {
  expect(hasCertPerm(null, 'certificate.view')).toBe(false);
});
test('validateCreateCertificate: server needs a dnsName', () => {
  expect(validateCreateCertificate({ name: 'x', issuerId: 'i', usage: 'server', dnsNames: [] }).dnsNames).toBeTruthy();
  expect(validateCreateCertificate({ name: 'x', issuerId: 'i', usage: 'server', dnsNames: ['a.example'] }).dnsNames).toBeUndefined();
});
test('validateCreateCertificate: client needs a subject', () => {
  expect(validateCreateCertificate({ name: 'x', issuerId: 'i', usage: 'client', subject: '' }).subject).toBeTruthy();
});
test('validateCreateCertificate: name and issuer required', () => {
  const e = validateCreateCertificate({ name: '', issuerId: '', usage: 'server', dnsNames: ['a'] });
  expect(e.name).toBeTruthy();
  expect(e.issuerId).toBeTruthy();
});
test('certStatusBadge maps every status to a variant', () => {
  (['pending','issuing','ready','error'] as const).forEach(s => expect(certStatusBadge(s).label).toBeTruthy());
});
