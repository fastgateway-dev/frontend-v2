# Managed Certificates Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend-v2 UI + API-client layer for the managed-certificates feature backend-v2 already serves (owner trust-infra + project cert issuance/observation/distribution).

**Architecture:** Three slices following frontend-v2 conventions — owner-global pages under `src/app/(authenticated)/` (gated by `user.role === 'owner'`), project-scoped pages under `src/app/projects/[projectId]/certificates/` (RBAC-gated), and shared plumbing (axios API clients returning `response.data`, a `// Certificate types` section in `src/types/index.ts`, a `hasCertPerm` helper, approvals-page integration, sidebar entries). No new libraries; `useState`/`useEffect`/`Promise.all` fetching; manual form validation; `@/components/ui` primitives.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, axios, Zustand, react-hook-form (large forms only), Tailwind, lucide-react, Jest.

**Spec:** `docs/superpowers/specs/2026-09-20-managed-certificates-frontend-design.md`

## Global Constraints

- **Working directory:** `/Users/zufardhiyaulhaq/Documents/personal/github/frontend-v2` (branch `main`). All paths below are relative to it.
- **No commits.** Each task ends at a verified, un-committed working state; the user commits. Do NOT run `git commit`. Replace the usual commit step with a stop-for-review.
- **No new dependencies.** Use what `package.json` already has.
- **Shared HTTP client:** `import apiClient from './client'` (baseURL `/api/v1`, auth + refresh built in). Client methods return `response.data`; errors bubble to callers.
- **Exact live backend API contract (pinned from backend-v2 source — authoritative; supersedes any looser shape in the spec):**
  - Owner DNS creds `/dns/credentials`: `GET`→`{data: DNSProviderCredential[]}`; `POST {name,providerType,credentials:{apiToken}}`→`201 DNSProviderCredential`; `GET/PATCH /:dnsCredentialId`→`DNSProviderCredential`; `DELETE /:dnsCredentialId`→`204`, `409` if referenced. `DNSProviderCredential = {id,name,providerType,createdAt,updatedAt}` (never any secret). `providerType` value: `"cloudflare"`.
  - Owner issuers `/certificates/issuers` (present only when backend is in-cluster; else routes 404): `GET`→`{data: CertificateIssuer[]}`; `POST`(discriminated)→`201 CertificateIssuer`; `GET /:issuerId`→`CertificateIssuer`; `DELETE /:issuerId`→`409` if referenced; `GET /:issuerId/status`→`{status,statusMessage}`. `CertificateIssuer = {id,name,type,status,statusMessage?,config:IssuerConfig,createdBy,createdAt,updatedAt}` (full model, includes `config`).
  - Owner grants: `GET /certificates/issuers/:issuerId/grants`→`{data: IssuerProjectGrant[]}` where `IssuerProjectGrant = {id,issuerId,projectId,createdBy,createdAt}` (no project name); `POST .../grants {projectId}`; `DELETE .../grants/:projectId`→`409` if a cert in that project uses it.
  - Project certs `/projects/:projectId/certificates`: `GET`→`{data: ManagedCertificate[], pagination:{page,limit,total,totalPages}}` (**paginated**); `GET /issuers`→`{data: CertificateIssuer[]}` (granted issuers); `POST`→`201 {certificate, approvalId:null}` (issued now) or `202 {certificate, approvalId:string}` (approval opened); `GET /:certificateId`→`ManagedCertificate`; `DELETE /:certificateId`→`409` if referenced by a domain/client; `GET /:certificateId/status`→`{status,message?,notAfter?}`; `GET /:certificateId/distribution`→`{status,lastPushedFingerprint?,message?,lastSyncedAt?}`; `POST /:certificateId/resync`.
  - **`ManagedCertificate` response is FLAT** = `{id,projectId,name,issuerId,usage,dnsNames?,status,statusMessage?,fingerprint?,notAfter?,createdAt}` — no `config`, no `subject`, no key params, no `updatedAt`.
  - Create cert body: `{name,issuerId,usage,dnsNames?:string[],subject?:string,keyAlgorithm?,keySize?,durationDays?}` (server defaults RSA/2048/90 when omitted).
  - Approvals reuse the generic engine: list `GET /projects/:projectId/approvals?entityType=certificate`; stage actions use existing `.../approvals/:approvalId/stages/:stageId/{approve,reject,cancel}`.
- **Enums:** `ManagedCertUsage='server'|'client'`; `ManagedCertStatus='pending'|'issuing'|'ready'|'error'`; `IssuerType='self_signed_ca'|'acme'`; `IssuerStatus='pending'|'ready'|'error'`; `CertDistStatus='pending'|'synced'|'error'`.
- **Permission gating (frontend-only, no backend change):** helper `hasCertPerm(perms, perm)` = `!!perms && (perms.isOwner || perms.isProjectAdmin || perms.permissions.includes(perm))`. Owner pages gate nav on `user.role === 'owner'` and rely on the server to enforce (no client redirect, matching `sso/page.tsx`).
- **Verification commands:** `npx tsc --noEmit` (typecheck), `npm test` (Jest), `npm run lint` (ESLint 9 flat config), `npm run build` (only where a full build check is called for). A task is "green" when its listed commands pass.

---

### Task 1: Certificate types + DNS-credentials API client

**Files:**
- Modify: `src/types/index.ts` (append a `// Certificate types` section; extend two approval `entityType` unions)
- Create: `src/lib/api/dns-credentials.ts`
- Modify: `src/lib/api/index.ts` (export `dnsCredentialsApi`)
- Test: `src/lib/api/dns-credentials.test.ts`

**Interfaces:**
- Produces (consumed by all later tasks): the exported types below, and `dnsCredentialsApi` with `list/get/create/update/delete`.

- [ ] **Step 1: Add the certificate types.** Append to `src/types/index.ts`:

```ts
// Certificate types
export type ManagedCertUsage = 'server' | 'client';
export type ManagedCertStatus = 'pending' | 'issuing' | 'ready' | 'error';
export type IssuerType = 'self_signed_ca' | 'acme';
export type IssuerStatus = 'pending' | 'ready' | 'error';
export type CertDistStatus = 'pending' | 'synced' | 'error';

export interface IssuerConfig {
  commonName?: string;
  keyAlgorithm?: string;
  keySize?: number;
  durationDays?: number;
  server?: string;
  email?: string;
  eabKeyId?: string;
  dnsCredentialId?: string;
  clusterIssuerName?: string;
}
export interface CertificateIssuer {
  id: string;
  name: string;
  type: IssuerType;
  status: IssuerStatus;
  statusMessage?: string;
  config: IssuerConfig;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
export interface IssuerStatusResponse { status: IssuerStatus; statusMessage?: string; }

export interface IssuerProjectGrant {
  id: string;
  issuerId: string;
  projectId: string;
  createdBy?: string;
  createdAt: string;
}

// FLAT response shape — no `config` wrapper (mirrors backend managedCertificateResponse).
export interface ManagedCertificate {
  id: string;
  projectId: string;
  name: string;
  issuerId: string;
  usage: ManagedCertUsage;
  dnsNames?: string[];
  status: ManagedCertStatus;
  statusMessage?: string;
  fingerprint?: string;
  notAfter?: string;
  createdAt: string;
}
export interface ManagedCertificateStatus { status: ManagedCertStatus; message?: string; notAfter?: string; }
export interface CertificateDistribution {
  status: CertDistStatus;
  lastPushedFingerprint?: string;
  message?: string;
  lastSyncedAt?: string;
}

export interface DNSProviderCredential {
  id: string;
  name: string;
  providerType: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateDNSCredentialInput { name: string; providerType: string; credentials: { apiToken: string }; }
export interface UpdateDNSCredentialInput { name?: string; credentials?: { apiToken: string }; }

export type CreateIssuerInput =
  | { type: 'self_signed_ca'; name: string; commonName: string; keyAlgorithm: string; keySize: number; durationDays: number }
  | { type: 'acme'; name: string; server: string; email: string; dnsCredentialId: string; eab?: { keyId: string; hmacKey: string } };

export interface CreateCertificateInput {
  name: string;
  issuerId: string;
  usage: ManagedCertUsage;
  dnsNames?: string[];
  subject?: string;
  keyAlgorithm?: string;
  keySize?: number;
  durationDays?: number;
}
export interface CreateCertificateResponse { certificate: ManagedCertificate; approvalId: string | null; }
```

- [ ] **Step 2: Extend the approval `entityType` unions.** In `src/types/index.ts`, change the three occurrences of `'route' | 'client_attachment'` (around lines 1340, 1575, 1592) to `'route' | 'client_attachment' | 'certificate'`. (Search the file for `client_attachment` to find each.)

- [ ] **Step 3: Write the failing test** at `src/lib/api/dns-credentials.test.ts`:

```ts
import { dnsCredentialsApi } from './dns-credentials';
import apiClient from './client';

jest.mock('./client');

test('list unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'c1', name: 'cf', providerType: 'cloudflare', createdAt: '', updatedAt: '' }] } });
  const r = await dnsCredentialsApi.list();
  expect(apiClient.get).toHaveBeenCalledWith('/dns/credentials');
  expect(r).toHaveLength(1);
});

test('create posts body and returns data', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'c1' } });
  await dnsCredentialsApi.create({ name: 'cf', providerType: 'cloudflare', credentials: { apiToken: 't' } });
  expect(apiClient.post).toHaveBeenCalledWith('/dns/credentials', { name: 'cf', providerType: 'cloudflare', credentials: { apiToken: 't' } });
});

test('update patches and delete deletes', async () => {
  (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: 'c1' } });
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await dnsCredentialsApi.update('c1', { name: 'x' });
  expect(apiClient.patch).toHaveBeenCalledWith('/dns/credentials/c1', { name: 'x' });
  await dnsCredentialsApi.delete('c1');
  expect(apiClient.delete).toHaveBeenCalledWith('/dns/credentials/c1');
});
```

- [ ] **Step 4: Run the test, verify it fails.** Run: `npm test -- dns-credentials` → FAIL (module not found).

- [ ] **Step 5: Implement `src/lib/api/dns-credentials.ts`:**

```ts
import apiClient from './client';
import type { DNSProviderCredential, CreateDNSCredentialInput, UpdateDNSCredentialInput } from '@/types';

export const dnsCredentialsApi = {
  list: async (): Promise<DNSProviderCredential[]> => {
    const response = await apiClient.get<{ data: DNSProviderCredential[] }>('/dns/credentials');
    return response.data.data;
  },
  get: async (id: string): Promise<DNSProviderCredential> => {
    const response = await apiClient.get<DNSProviderCredential>(`/dns/credentials/${id}`);
    return response.data;
  },
  create: async (data: CreateDNSCredentialInput): Promise<DNSProviderCredential> => {
    const response = await apiClient.post<DNSProviderCredential>('/dns/credentials', data);
    return response.data;
  },
  update: async (id: string, data: UpdateDNSCredentialInput): Promise<DNSProviderCredential> => {
    const response = await apiClient.patch<DNSProviderCredential>(`/dns/credentials/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/dns/credentials/${id}`);
  },
};
```

- [ ] **Step 6: Export it.** Add to `src/lib/api/index.ts`: `export { dnsCredentialsApi } from './dns-credentials';`

- [ ] **Step 7: Verify.** Run `npm test -- dns-credentials` (PASS) and `npx tsc --noEmit` (clean).

- [ ] **Step 8: Stop for review (no commit).**

---

### Task 2: Certificate-issuers + grants API client

**Files:**
- Create: `src/lib/api/certificate-issuers.ts`
- Modify: `src/lib/api/index.ts`
- Test: `src/lib/api/certificate-issuers.test.ts`

**Interfaces:**
- Consumes: types from Task 1 (`CertificateIssuer`, `CreateIssuerInput`, `IssuerProjectGrant`, `IssuerStatusResponse`).
- Produces: `certificateIssuersApi` with `list/get/create/delete/getStatus/listGrants/grant/revokeGrant`.

- [ ] **Step 1: Write the failing test** `src/lib/api/certificate-issuers.test.ts`:

```ts
import { certificateIssuersApi } from './certificate-issuers';
import apiClient from './client';

jest.mock('./client');

test('list unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'i1' }] } });
  const r = await certificateIssuersApi.list();
  expect(apiClient.get).toHaveBeenCalledWith('/certificates/issuers');
  expect(r).toHaveLength(1);
});

test('getStatus hits /status', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { status: 'ready' } });
  await certificateIssuersApi.getStatus('i1');
  expect(apiClient.get).toHaveBeenCalledWith('/certificates/issuers/i1/status');
});

test('grants list/grant/revoke', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
  (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await certificateIssuersApi.listGrants('i1');
  expect(apiClient.get).toHaveBeenCalledWith('/certificates/issuers/i1/grants');
  await certificateIssuersApi.grant('i1', 'p1');
  expect(apiClient.post).toHaveBeenCalledWith('/certificates/issuers/i1/grants', { projectId: 'p1' });
  await certificateIssuersApi.revokeGrant('i1', 'p1');
  expect(apiClient.delete).toHaveBeenCalledWith('/certificates/issuers/i1/grants/p1');
});
```

- [ ] **Step 2: Run, verify fail.** `npm test -- certificate-issuers` → FAIL.

- [ ] **Step 3: Implement `src/lib/api/certificate-issuers.ts`:**

```ts
import apiClient from './client';
import type { CertificateIssuer, CreateIssuerInput, IssuerProjectGrant, IssuerStatusResponse } from '@/types';

export const certificateIssuersApi = {
  list: async (): Promise<CertificateIssuer[]> => {
    const response = await apiClient.get<{ data: CertificateIssuer[] }>('/certificates/issuers');
    return response.data.data;
  },
  get: async (id: string): Promise<CertificateIssuer> => {
    const response = await apiClient.get<CertificateIssuer>(`/certificates/issuers/${id}`);
    return response.data;
  },
  create: async (data: CreateIssuerInput): Promise<CertificateIssuer> => {
    const response = await apiClient.post<CertificateIssuer>('/certificates/issuers', data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/certificates/issuers/${id}`);
  },
  getStatus: async (id: string): Promise<IssuerStatusResponse> => {
    const response = await apiClient.get<IssuerStatusResponse>(`/certificates/issuers/${id}/status`);
    return response.data;
  },
  listGrants: async (id: string): Promise<IssuerProjectGrant[]> => {
    const response = await apiClient.get<{ data: IssuerProjectGrant[] }>(`/certificates/issuers/${id}/grants`);
    return response.data.data;
  },
  grant: async (id: string, projectId: string): Promise<void> => {
    await apiClient.post(`/certificates/issuers/${id}/grants`, { projectId });
  },
  revokeGrant: async (id: string, projectId: string): Promise<void> => {
    await apiClient.delete(`/certificates/issuers/${id}/grants/${projectId}`);
  },
};
```

- [ ] **Step 4: Export.** Add `export { certificateIssuersApi } from './certificate-issuers';` to `src/lib/api/index.ts`.

- [ ] **Step 5: Verify.** `npm test -- certificate-issuers` (PASS), `npx tsc --noEmit`.

- [ ] **Step 6: Stop for review (no commit).**

---

### Task 3: Project-certificates API client

**Files:**
- Create: `src/lib/api/certificates.ts`
- Modify: `src/lib/api/index.ts`
- Test: `src/lib/api/certificates.test.ts`

**Interfaces:**
- Consumes: types from Task 1 (`ManagedCertificate`, `CreateCertificateInput`, `CreateCertificateResponse`, `ManagedCertificateStatus`, `CertificateDistribution`, `CertificateIssuer`, `PaginatedResponse`).
- Produces: `certificatesApi` with `list/issuersForProject/create/get/getStatus/getDistribution/resync/delete`.

- [ ] **Step 1: Write the failing test** `src/lib/api/certificates.test.ts`:

```ts
import { certificatesApi } from './certificates';
import apiClient from './client';

jest.mock('./client');

test('list unwraps paginated {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'c1' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } });
  const r = await certificatesApi.list('p1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates');
  expect(r).toHaveLength(1);
});

test('issuersForProject unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
  await certificatesApi.issuersForProject('p1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates/issuers');
});

test('create returns {certificate, approvalId}', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { certificate: { id: 'c1' }, approvalId: null } });
  const r = await certificatesApi.create('p1', { name: 'n', issuerId: 'i1', usage: 'server', dnsNames: ['a.example'] });
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/certificates', { name: 'n', issuerId: 'i1', usage: 'server', dnsNames: ['a.example'] });
  expect(r.approvalId).toBeNull();
});

test('status/distribution/resync/delete endpoints', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { status: 'ready' } });
  (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await certificatesApi.getStatus('p1', 'c1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates/c1/status');
  await certificatesApi.getDistribution('p1', 'c1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates/c1/distribution');
  await certificatesApi.resync('p1', 'c1');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/certificates/c1/resync');
  await certificatesApi.delete('p1', 'c1');
  expect(apiClient.delete).toHaveBeenCalledWith('/projects/p1/certificates/c1');
});
```

- [ ] **Step 2: Run, verify fail.** `npm test -- certificates.test` → FAIL.

- [ ] **Step 3: Implement `src/lib/api/certificates.ts`:**

```ts
import apiClient from './client';
import type {
  ManagedCertificate, CreateCertificateInput, CreateCertificateResponse,
  ManagedCertificateStatus, CertificateDistribution, CertificateIssuer, PaginatedResponse,
} from '@/types';

export const certificatesApi = {
  list: async (projectId: string): Promise<ManagedCertificate[]> => {
    const response = await apiClient.get<PaginatedResponse<ManagedCertificate>>(`/projects/${projectId}/certificates`);
    return response.data.data;
  },
  issuersForProject: async (projectId: string): Promise<CertificateIssuer[]> => {
    const response = await apiClient.get<{ data: CertificateIssuer[] }>(`/projects/${projectId}/certificates/issuers`);
    return response.data.data;
  },
  create: async (projectId: string, data: CreateCertificateInput): Promise<CreateCertificateResponse> => {
    const response = await apiClient.post<CreateCertificateResponse>(`/projects/${projectId}/certificates`, data);
    return response.data;
  },
  get: async (projectId: string, certificateId: string): Promise<ManagedCertificate> => {
    const response = await apiClient.get<ManagedCertificate>(`/projects/${projectId}/certificates/${certificateId}`);
    return response.data;
  },
  getStatus: async (projectId: string, certificateId: string): Promise<ManagedCertificateStatus> => {
    const response = await apiClient.get<ManagedCertificateStatus>(`/projects/${projectId}/certificates/${certificateId}/status`);
    return response.data;
  },
  getDistribution: async (projectId: string, certificateId: string): Promise<CertificateDistribution> => {
    const response = await apiClient.get<CertificateDistribution>(`/projects/${projectId}/certificates/${certificateId}/distribution`);
    return response.data;
  },
  resync: async (projectId: string, certificateId: string): Promise<void> => {
    await apiClient.post(`/projects/${projectId}/certificates/${certificateId}/resync`);
  },
  delete: async (projectId: string, certificateId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/certificates/${certificateId}`);
  },
};
```

Note: `PaginatedResponse<T>` already exists in `src/types/index.ts` (`{ data: T[]; pagination: Pagination }`).

- [ ] **Step 4: Export.** Add `export { certificatesApi } from './certificates';` to `src/lib/api/index.ts`.

- [ ] **Step 5: Verify.** `npm test -- certificates.test` (PASS), `npx tsc --noEmit`.

- [ ] **Step 6: Stop for review (no commit).**

---

### Task 4: Shared cert helpers (permission + presentation)

**Files:**
- Create: `src/lib/utils/certificates.ts`
- Test: `src/lib/utils/certificates.test.ts`

**Interfaces:**
- Consumes: `ProjectPermissions`, `ManagedCertStatus`, `IssuerStatus`, `CertDistStatus` from `@/types`.
- Produces: `hasCertPerm(perms, perm)`, `certStatusBadge(status)`, `issuerStatusBadge(status)`, `distStatusBadge(status)`, `validateCreateCertificate(input)`.

- [ ] **Step 1: Write the failing test** `src/lib/utils/certificates.test.ts`:

```ts
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
```

- [ ] **Step 2: Run, verify fail.** `npm test -- utils/certificates` → FAIL.

- [ ] **Step 3: Implement `src/lib/utils/certificates.ts`:**

```ts
import type { ProjectPermissions, ManagedCertStatus, IssuerStatus, CertDistStatus, CreateCertificateInput } from '@/types';

export function hasCertPerm(perms: ProjectPermissions | null | undefined, perm: string): boolean {
  return !!perms && (perms.isOwner || perms.isProjectAdmin || perms.permissions.includes(perm));
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
export interface BadgeSpec { label: string; variant: BadgeVariant; }

export function certStatusBadge(s: ManagedCertStatus): BadgeSpec {
  switch (s) {
    case 'ready': return { label: 'Ready', variant: 'success' };
    case 'issuing': return { label: 'Issuing', variant: 'info' };
    case 'error': return { label: 'Error', variant: 'danger' };
    default: return { label: 'Pending', variant: 'warning' };
  }
}
export function issuerStatusBadge(s: IssuerStatus): BadgeSpec {
  switch (s) {
    case 'ready': return { label: 'Ready', variant: 'success' };
    case 'error': return { label: 'Error', variant: 'danger' };
    default: return { label: 'Pending', variant: 'warning' };
  }
}
export function distStatusBadge(s: CertDistStatus): BadgeSpec {
  switch (s) {
    case 'synced': return { label: 'Synced', variant: 'success' };
    case 'error': return { label: 'Error', variant: 'danger' };
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
```

Map `BadgeVariant` to the actual `Badge` component's accepted variants — **verify the real prop values in `src/components/ui/badge.tsx` and adjust the union to match** (do not invent variant names the component does not support).

- [ ] **Step 4: Verify.** `npm test -- utils/certificates` (PASS), `npx tsc --noEmit`.

- [ ] **Step 5: Stop for review (no commit).**

---

### Task 5: DNS credentials owner page

**Files:**
- Create: `src/app/(authenticated)/dns-credentials/page.tsx`
- Reference (mirror conventions): `src/app/(authenticated)/sso/page.tsx` (owner page + error handling), `src/app/(authenticated)/users/page.tsx` (list + modal + delete), `src/components/ui` (`Button, Input, Select, Card, Badge, Modal`).

**Interfaces:**
- Consumes: `dnsCredentialsApi` (Task 1), `useAuthStore` (`user.role`).

- [ ] **Step 1: Build the list page.** `'use client'`. State: `credentials: DNSProviderCredential[]`, `isLoading`, `error`, plus modal state (`showCreate`, `editing: DNSProviderCredential | null`, form fields `name`, `apiToken`, `formErrors`, `isSaving`, `saveError`). On mount `loadData()` → `dnsCredentialsApi.list()`. Render a header with a "New Credential" button, and a list of `Card`s showing `name`, a `providerType` badge (Cloudflare), created date, and Edit / Delete actions. Empty state when none.

- [ ] **Step 2: Create/Edit modal.** A `Modal` with `Input` name, a `Select` providerType (single option `cloudflare` → label "Cloudflare", value `cloudflare`), and a password-type `Input` for `apiToken` (labelled "API Token"; on edit, blank = keep existing, non-blank = rotate). Validate name + (on create) apiToken non-empty. Submit: create → `dnsCredentialsApi.create({name, providerType:'cloudflare', credentials:{apiToken}})`; edit → `dnsCredentialsApi.update(id, { name, ...(apiToken ? {credentials:{apiToken}} : {}) })`. On success close modal + reload. On error set `saveError` from `err.response?.data?.error`.

- [ ] **Step 3: Delete with 409 guard.** Confirm, then `dnsCredentialsApi.delete(id)`; on `err.response?.status === 409` show the returned message inline (e.g. "In use by an ACME issuer") rather than a generic failure.

- [ ] **Step 4: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm test` (no regressions). Manual smoke (dev server): page renders, create/edit/delete modals open, owner-only reachable via `/dns-credentials`.

- [ ] **Step 5: Stop for review (no commit).**

---

### Task 6: Certificate issuers owner pages (list + create + detail/grants)

**Files:**
- Create: `src/app/(authenticated)/certificate-issuers/page.tsx` (list)
- Create: `src/app/(authenticated)/certificate-issuers/create/page.tsx` (CA | ACME)
- Create: `src/app/(authenticated)/certificate-issuers/[issuerId]/page.tsx` (config + status + grants)
- Reference: `src/app/(authenticated)/sso/page.tsx`, `src/app/projects/[projectId]/domains/create/page.tsx` (form + validation), `src/components/ui`.

**Interfaces:**
- Consumes: `certificateIssuersApi`, `dnsCredentialsApi`, `projectsApi`, helpers (`issuerStatusBadge`), types from Task 1.

- [ ] **Step 1: List page.** State `issuers: CertificateIssuer[]`, `isLoading`, `error`, `unavailable`. `loadData()` calls `certificateIssuersApi.list()`; **on `err.response?.status === 404` set `unavailable = true`** and render an informational empty state: "Certificate issuers require FastGateway running in-cluster with cert-manager." Otherwise render `Card`s: name, type badge (`Self-signed CA` / `ACME`), status badge via `issuerStatusBadge(issuer.status)` (+ tooltip of `statusMessage`), created date; row → link to `[issuerId]`. "New Issuer" button → `create/`. (No inline delete on the list — delete lives on the detail page; optional here.)

- [ ] **Step 2: Create page — type toggle.** Local `type: IssuerType` state with a `Select`/segmented toggle (`self_signed_ca` | `acme`). Shared field: `name`.
  - **Self-signed CA** fields: `commonName` (Input), `keyAlgorithm` (Select RSA|ECDSA, default RSA), `keySize` (Select: RSA→2048/4096, ECDSA→256/384; default 2048), `durationDays` (Input number, default 3650). Submit `certificateIssuersApi.create({ type:'self_signed_ca', name, commonName, keyAlgorithm, keySize, durationDays })`.
  - **ACME** fields: `server` (Select with presets → Let's Encrypt Production `https://acme-v02.api.letsencrypt.org/directory`, Let's Encrypt Staging `https://acme-staging-v02.api.letsencrypt.org/directory`, ZeroSSL `https://acme.zerossl.com/v2/DV90`, plus a "Custom URL" option revealing an Input), `email` (Input), `dnsCredentialId` (Select populated from `dnsCredentialsApi.list()` — if none, show a hint linking to `/dns-credentials`), optional EAB accordion (`keyId`, `hmacKey`; when either is filled, send `eab:{keyId,hmacKey}`). Submit `certificateIssuersApi.create({ type:'acme', name, server, email, dnsCredentialId, ...(eabFilled ? {eab:{keyId,hmacKey}} : {}) })`.
  - Manual `validateForm()` → `Record<string,string>`, pass to `Input error=`. On success `router.push('/certificate-issuers/' + created.id)`. On error surface `err.response?.data?.error` (incl. `422` "ACME issuer requires a dnsCredentialId").

- [ ] **Step 3: Detail page.** Load `certificateIssuersApi.get(issuerId)`, `certificateIssuersApi.getStatus(issuerId)`, `certificateIssuersApi.listGrants(issuerId)`, and `projectsApi.list()` (to map `projectId`→name for the grants list) via `Promise.all`. Sections:
  - **Overview:** name, type, status badge + `statusMessage`, and the relevant `config` fields (CA: commonName/keyAlgorithm/keySize/durationDays; ACME: server/email/masked DNS-cred name/`clusterIssuerName`). Never render secret material.
  - **Grants:** table of granted projects (resolve names from the projects list; fall back to the raw `projectId`). "Grant project" control = a `Select` of not-yet-granted projects → `certificateIssuersApi.grant(issuerId, projectId)` then reload. Each row has "Revoke" → `revokeGrant`; on `409` show the returned "cert still uses this issuer" message inline.
  - **Danger zone:** "Delete issuer" → `certificateIssuersApi.delete(issuerId)`; on `409` show "in use by a certificate"; on success `router.push('/certificate-issuers')`.

- [ ] **Step 4: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm test`. Manual smoke of all three pages (create both issuer types, grant/revoke, delete).

- [ ] **Step 5: Stop for review (no commit).**

---

### Task 7: Project certificates — list + create pages

**Files:**
- Create: `src/app/projects/[projectId]/certificates/page.tsx` (list)
- Create: `src/app/projects/[projectId]/certificates/create/page.tsx` (create form)
- Reference: `src/app/projects/[projectId]/domains/page.tsx` (project list + permissions), `src/app/projects/[projectId]/domains/create/page.tsx` (form).

**Interfaces:**
- Consumes: `certificatesApi`, `projectsApi`, `permissionsApi`, helpers (`hasCertPerm`, `certStatusBadge`, `distStatusBadge`, `validateCreateCertificate`), `TagInput` from `@/components/ui`.

- [ ] **Step 1: List page.** `useParams()` → `projectId`. `loadData()` = `Promise.all([projectsApi.get(projectId), certificatesApi.list(projectId), permissionsApi.getProjectPermissions(projectId)])`. Render a header with a "New Certificate" `Link` to `create/` gated by `hasCertPerm(permissions, 'certificate.create')`. List `Card`s (each a `Link` to `[certificateId]`) showing: name, `usage` badge, issuer (id for now — no name in the list; acceptable), `certStatusBadge(status)`, expiry (`notAfter` formatted, or "—"). Empty state. Loading skeleton (pulse) like domains.

- [ ] **Step 2: Create page.** Fields: `name` (Input), `issuerId` (Select from `certificatesApi.issuersForProject(projectId)`; when the list is empty render a nudge "No certificate issuers are granted to this project — ask an owner to grant one." and disable submit), `usage` (Select server|client). Conditionally: `usage==='server'` → `dnsNames` via `TagInput`; `usage==='client'` → `subject` Input. Advanced (collapsible, optional): `keyAlgorithm`, `keySize`, `durationDays` (leave blank → omit → server defaults).

- [ ] **Step 3: Submit + approval branch.** Build `CreateCertificateInput` (omit empty optional key params and the non-applicable dnsNames/subject). `const errors = validateCreateCertificate(input)`; if non-empty, show and stop. Else `const { certificate, approvalId } = await certificatesApi.create(projectId, input)`. If `approvalId` → toast/notice "Submitted for approval" else "Certificate created"; then `router.push(\`/projects/${projectId}/certificates/${certificate.id}\`)`. On error surface `err.response?.data?.error`. Submit button label: `"Create Certificate"` (branching happens on the response — no need to pre-know whether approvals are enabled).

- [ ] **Step 4: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm test`. Manual smoke: list renders, create form validates server vs client, submit routes to detail.

- [ ] **Step 5: Stop for review (no commit).**

---

### Task 8: Project certificate detail page

**Files:**
- Create: `src/app/projects/[projectId]/certificates/[certificateId]/page.tsx`
- Reference: `src/app/projects/[projectId]/domains/[domainId]/routes/[routeId]/page.tsx` (detail + pendingApproval banner + polling if present).

**Interfaces:**
- Consumes: `certificatesApi`, `approvalsApi` (list filtered by `entityType=certificate`), `permissionsApi`, helpers.

- [ ] **Step 1: Load + render facts.** `Promise.all([certificatesApi.get, certificatesApi.getDistribution, permissionsApi.getProjectPermissions])` (guard `getDistribution` with try/catch → treat 404 as "not yet distributed"). Header: name + `certStatusBadge(status)`. Facts card: usage, issuer id, hostnames (`dnsNames.join(', ')`), fingerprint, expiry (`notAfter`). Status message banner colored by status when `statusMessage` present.

- [ ] **Step 2: Pending-approval banner.** When `status === 'pending'`, fetch `approvalsApi.list(projectId, { entityType: 'certificate' })` (use the existing approvals list method; confirm its signature in `src/lib/api/approvals.ts` and pass the `entityType` filter it supports), find the approval whose `entityId === certificateId`, and render a banner (reuse the routes-detail pending-approval banner markup) linking to `/projects/${projectId}/approvals`.

- [ ] **Step 3: Distribution section + resync.** Show `distribution.status` via `distStatusBadge`, `lastPushedFingerprint`, `lastSyncedAt`, `message`. "Resync now" button gated by `hasCertPerm(permissions, 'certificate.edit')` → `certificatesApi.resync(projectId, certificateId)` then reload distribution.

- [ ] **Step 4: Delete + polling.** "Delete" gated by `hasCertPerm(permissions, 'certificate.delete')` → `certificatesApi.delete`; on `409` show "referenced by a domain or client"; on success `router.push(\`/projects/${projectId}/certificates\`)`. Add a `useEffect` interval (~4s) that re-fetches `certificatesApi.getStatus` (and merges `status`/`notAfter`) while `status ∈ {pending, issuing}`, clearing the interval otherwise and on unmount.

- [ ] **Step 5: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm test`. Manual smoke: detail renders, resync works, delete guard shows 409 message, polling stops at ready/error.

- [ ] **Step 6: Stop for review (no commit).**

---

### Task 9: Approvals page — certificate entity type

**Files:**
- Modify: `src/app/projects/[projectId]/approvals/page.tsx`
- Possibly modify: `src/lib/api/approvals.ts` (only if a fetch by `entityType` needs adding)
- Reference: the existing route + client-attachment merge in this page.

**Interfaces:**
- Consumes: `approvalsApi`, the extended `entityType` union (Task 1).

- [ ] **Step 1: Read the current page** to see how route + client-attachment approvals are fetched (`Promise.all`) and mapped into `UnifiedApproval`, and how the tabs are declared.

- [ ] **Step 2: Fetch certificate approvals.** Add a fetch for `entityType=certificate` to the existing `Promise.all` (via `approvalsApi` filtered — reuse the same method the route approvals use, passing the certificate entity type; certificate approvals go through the same generic engine/endpoint). Map results into the `UnifiedApproval` shape with `entityType: 'certificate'`.

- [ ] **Step 3: Add the tab + label.** Add a "Certificate" tab to the existing tab set and include certificate rows in the "all" view. Reuse the existing stage approve/reject/cancel handlers unchanged (generic endpoints).

- [ ] **Step 4: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm test`. Manual smoke: with a pending cert approval, it appears under the Certificate tab and approve/reject works.

- [ ] **Step 5: Stop for review (no commit).**

---

### Task 10: Sidebar navigation entries

**Files:**
- Modify: `src/components/features/sidebar.tsx`
- Reference: existing `adminNavItems` (owner) and `resourcesNavItems` (project) construction in the same file.

**Interfaces:**
- Consumes: `hasCertPerm` (Task 4), lucide icons.

- [ ] **Step 1: Import icons.** Add to the `lucide-react` import (top of file) icons for the new entries, e.g. `Stamp` (issuers), `Cloud` (DNS), `FileKey` (project certificates) — pick names that exist in the installed lucide version; verify by grep in `node_modules/lucide-react` or reuse already-imported ones (`Shield`, `KeyRound`, `Globe`).

- [ ] **Step 2: Owner entries.** In the `adminNavItems = isOwner ? [ ... ] : []` array, add `{ href: '/certificate-issuers', icon: Stamp, label: 'Certificate Issuers' }` and `{ href: '/dns-credentials', icon: Cloud, label: 'DNS Credentials' }`.

- [ ] **Step 3: Project entry.** In the project block where `resourcesNavItems.push(...)` runs (guarded by `projectId && permissions`), add after Domains: `if (hasCertPerm(permissions, 'certificate.view')) resourcesNavItems.push({ href: \`/projects/${projectId}/certificates\`, icon: FileKey, label: 'Certificates' });`. Import `hasCertPerm` from `@/lib/utils/certificates`. (Leave the permissionless fallback block unchanged — no Certificates entry there.)

- [ ] **Step 4: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm run build`. Manual smoke: owner sees both owner entries; a project member with `certificate.view` sees the Certificates entry; active-state highlighting works on each route.

- [ ] **Step 5: Stop for review (no commit).**

---

## Self-Review

- **Spec coverage:** owner DNS creds (T1,T5), owner issuers+grants (T2,T6), project certs list/create/detail/status/distribution/resync/delete (T3,T7,T8), approvals integration (T9), permissions helper + gating (T4, used T5–T10), types (T1), sidebar (T10), 404-degradation for issuers (T6), no-secret display (T5/T6), out-of-scope items excluded. Covered.
- **Type consistency:** `ManagedCertificate` is the flat shape everywhere; issuer carries `config`; list unwraps `{data}` (issuers/dns/grants) vs `{data,pagination}` (certs); create returns `{certificate,approvalId}`. `hasCertPerm` signature identical across tasks. `PaginatedResponse<T>` reused from existing types.
- **Verification-note items to resolve during implementation (flagged inline, not placeholders):** exact `Badge` variant prop values (T4), the `approvalsApi` list method's `entityType` filter signature (T8/T9), lucide icon names available in the installed version (T10). Each is a "read the file, match it" step, not undefined behavior.
