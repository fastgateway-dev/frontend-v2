# Managed Certificates — Frontend Design (frontend-v2)

**Status:** Approved for planning
**Date:** 2026-09-20
**Component:** frontend-v2 (FastGateway OSS web UI)
**Backend spec:** `backend-v2/docs/superpowers/specs/2026-09-19-managed-certificates-design.md`
**Backend API contract:** `backend-v2/docs/superpowers/plans/2026-09-19-managed-certificates-api.md`

**Goal:** Add a web UI (and its API client layer) for the managed-certificates
feature that backend-v2 already serves: owner-managed trust infrastructure (DNS
provider credentials, certificate issuers, issuer→project grants) and
project-scoped certificate issuance (create → approval → issue → distribute →
observe → delete). The UI follows frontend-v2's existing conventions exactly; no
design-language changes.

---

## Global Constraints

- **Build only against the live backend surface.** As of this spec, backend-v2
  serves Phase 1 (trust infra) + Phase 2 (project cert issuance) + the Phase 3
  distribution *status* endpoints. Not live, therefore out of scope: PATCH
  cert edit/re-issue, attach-cert-to-domain/client, and the owner-wide fleet
  view (`GET /certificates`).
- **No secret material is ever displayed.** DNS credentials, ACME account keys,
  EAB HMAC, and private keys are never returned by the API and never rendered.
- **Follow existing frontend-v2 patterns, do not introduce new libraries.**
  `'use client'` pages, a shared axios client (`src/lib/api/client.ts`, baseURL
  `/api/v1`), client modules that return `response.data`, `useState`/`useEffect`
  + `Promise.all` fetching (no React Query/SWR), manual form validation (no
  zod), `@/components/ui` primitives, Tailwind, lucide-react icons.
- **Two route groups, per convention:** owner-global pages under
  `src/app/(authenticated)/`; project-scoped pages under
  `src/app/projects/[projectId]/`.
- **Permission gating is frontend-only** (approved default): no backend-v2
  change. Gate on `isOwner || isProjectAdmin || permissions.includes('<perm>')`
  using the `permissions: string[]` array the existing `ProjectPermissions`
  response already returns. Owner-global pages gate navigation on
  `user.role === 'owner'` (matching SSO/Users/Teams) and rely on the backend to
  enforce.
- **Owner UI is split into two separate pages** (approved): Certificate Issuers
  and DNS Credentials are distinct owner nav entries, not a combined tabbed area.

---

## 1. Live backend surface (what the UI consumes)

All under `/api/v1`, authenticated. camelCase params.

### Owner-global (`RequireRole("owner")`)

DNS provider credentials:
| Method | Path | Body / Response |
|---|---|---|
| GET | `/dns/credentials` | → `DNSProviderCredential[]` (no secrets) |
| POST | `/dns/credentials` | `{name, providerType, credentials{apiToken}}` → created (no secrets) |
| GET | `/dns/credentials/:dnsCredentialId` | → one (masked) |
| PATCH | `/dns/credentials/:dnsCredentialId` | `{name?, credentials?{apiToken}}` (rename / rotate) |
| DELETE | `/dns/credentials/:dnsCredentialId` | 409 if referenced by an ACME issuer |

Certificate issuers (routes registered **only when backend runs in-cluster with
cert-manager**; otherwise absent → 404):
| Method | Path | Body / Response |
|---|---|---|
| GET | `/certificates/issuers` | → `CertificateIssuer[]` |
| POST | `/certificates/issuers` | discriminated on `type` (below) |
| GET | `/certificates/issuers/:issuerId` | → one |
| DELETE | `/certificates/issuers/:issuerId` | 409 if referenced by a `ManagedCertificate` |
| GET | `/certificates/issuers/:issuerId/status` | cert-manager Ready condition + message |
| GET | `/certificates/issuers/:issuerId/grants` | → granted projects |
| POST | `/certificates/issuers/:issuerId/grants` | `{projectId}` |
| DELETE | `/certificates/issuers/:issuerId/grants/:projectId` | 409 if a cert in that project uses it |

Create issuer bodies:
- self-signed CA: `{type:"self_signed_ca", name, commonName, keyAlgorithm, keySize, durationDays}`
- ACME: `{type:"acme", name, server, email, eab?{keyId,hmacKey}, dnsCredentialId}`

### Project-scoped (`RequireProjectAccess` + per-handler `certificate.*`)

| Method | Path | Auth | Body / Response |
|---|---|---|---|
| GET | `/projects/:projectId/certificates` | cert.view | → `ManagedCertificate[]` |
| GET | `/projects/:projectId/certificates/issuers` | cert.view | issuers granted to this project (for the create form) |
| POST | `/projects/:projectId/certificates` | cert.create | body below → `201 {certificate, approvalId:null}` (issued now) or `202 {certificate, approvalId}` (approval opened) |
| GET | `/projects/:projectId/certificates/:certificateId` | cert.view | → one |
| DELETE | `/projects/:projectId/certificates/:certificateId` | cert.delete | 409 if referenced by a Domain/Client |
| GET | `/projects/:projectId/certificates/:certificateId/status` | cert.view | issuance status from cert-manager Ready condition |
| GET | `/projects/:projectId/certificates/:certificateId/distribution` | cert.view | sync state (last-pushed fingerprint, status, timestamp) |
| POST | `/projects/:projectId/certificates/:certificateId/resync` | cert.edit | force reconcile now |

Create cert body: `{name, issuerId, usage, dnsNames[] | subject, keyAlgorithm?, keySize?, durationDays?}`.
Defaults applied server-side when omitted: `keyAlgorithm="RSA"`, `keySize=2048`, `durationDays=90`.

### Approvals (existing generic engine, reused)

Cert creation opens a `certificate` approval (when project approvals are
enabled). Listing: `GET /projects/:projectId/approvals?entityType=certificate`.
Stage actions use the existing generic endpoints
`/projects/:projectId/approvals/:approvalId/stages/:stageId/{approve,reject,cancel}`.

### Enums / field values (from backend models)

- `ManagedCertUsage`: `server | client`
- `ManagedCertStatus`: `pending | issuing | ready | error`
- `IssuerType`: `self_signed_ca | acme`
- `IssuerStatus`: `pending | ready | error`
- `CertDistStatus`: `pending | synced | error` — **exact string set to be pinned
  from `backend-v2/internal/models/certificate_distribution.go` during planning.**
- DNS `providerType`: `cloudflare` only (credential field `apiToken`).

---

## 2. Data model (frontend types)

New `// Certificate types` section in `src/types/index.ts`. Timestamps are
`string`; ids are `string`.

```ts
export type ManagedCertUsage = 'server' | 'client';
export type ManagedCertStatus = 'pending' | 'issuing' | 'ready' | 'error';
export type IssuerType = 'self_signed_ca' | 'acme';
export type IssuerStatus = 'pending' | 'ready' | 'error';
export type CertDistStatus = 'pending' | 'synced' | 'error'; // pin exact set

export interface IssuerConfig {
  // self_signed_ca
  commonName?: string; keyAlgorithm?: string; keySize?: number; durationDays?: number;
  // acme
  server?: string; email?: string; eabKeyId?: string; dnsCredentialId?: string;
  // resolved cert-manager names (read-only, informational)
  clusterIssuerName?: string;
}
export interface CertificateIssuer {
  id: string; name: string; type: IssuerType; status: IssuerStatus;
  statusMessage?: string; config: IssuerConfig; createdAt: string; updatedAt: string;
}

// NOTE: the managed-certificate API response is FLAT (no `config` wrapper) and
// does NOT echo back subject / key params / updatedAt. It mirrors the backend's
// `managedCertificateResponse` DTO exactly.
export interface ManagedCertificate {
  id: string; projectId: string; name: string; issuerId: string;
  usage: ManagedCertUsage; dnsNames?: string[]; status: ManagedCertStatus;
  statusMessage?: string; fingerprint?: string; notAfter?: string; createdAt: string;
}
// GET /:id/status → CertStatus
export interface ManagedCertificateStatus { status: ManagedCertStatus; message?: string; notAfter?: string; }

export interface DNSProviderCredential {
  id: string; name: string; providerType: string; createdAt: string; updatedAt: string;
}
export interface CertificateDistribution {
  status: CertDistStatus; lastPushedFingerprint?: string; message?: string; updatedAt?: string;
}
export interface IssuerProjectGrant { issuerId: string; projectId: string; projectName?: string; }

// inputs
export type CreateIssuerInput =
  | { type: 'self_signed_ca'; name: string; commonName: string; keyAlgorithm: string; keySize: number; durationDays: number }
  | { type: 'acme'; name: string; server: string; email: string; dnsCredentialId: string; eab?: { keyId: string; hmacKey: string } };
export interface CreateDNSCredentialInput { name: string; providerType: string; credentials: { apiToken: string }; }
export interface UpdateDNSCredentialInput { name?: string; credentials?: { apiToken: string }; }
export interface CreateCertificateInput {
  name: string; issuerId: string; usage: ManagedCertUsage;
  dnsNames?: string[]; subject?: string;
  keyAlgorithm?: string; keySize?: number; durationDays?: number;
}
export interface CreateCertificateResponse { certificate: ManagedCertificate; approvalId: string | null; }
```

Extend the existing approval types: add `'certificate'` to `ApprovalRequest.entityType`
(and wherever the unified approvals page discriminates `entityType`).

**Exact server field names for `CertificateDistribution` and the issuer/status
responses are to be verified against the handler DTOs during planning** (the
handlers wrap models in `toXResponse` helpers; the plan pins the precise JSON).

---

## 3. API client modules (`src/lib/api/`)

Each is a plain object of async methods returning `response.data`, matching
`presets.ts`/`domains.ts`. All three re-exported from `src/lib/api/index.ts`.

**`dns-credentials.ts` → `dnsCredentialsApi`** (owner):
`list()`, `get(id)`, `create(input: CreateDNSCredentialInput)`,
`update(id, input: UpdateDNSCredentialInput)`, `delete(id)`.

**`certificate-issuers.ts` → `certificateIssuersApi`** (owner):
`list()`, `get(id)`, `create(input: CreateIssuerInput)`, `delete(id)`,
`getStatus(id)`, `listGrants(id)`, `grant(id, projectId)`, `revokeGrant(id, projectId)`.

**`certificates.ts` → `certificatesApi`** (project-scoped, `projectId` first):
`list(projectId)`, `issuersForProject(projectId)`,
`create(projectId, input: CreateCertificateInput): Promise<CreateCertificateResponse>`,
`get(projectId, certificateId)`, `getStatus(projectId, certificateId)`,
`getDistribution(projectId, certificateId)`, `resync(projectId, certificateId)`,
`delete(projectId, certificateId)`.

Errors bubble to callers (no per-module handling), matching existing modules.

---

## 4. Owner pages (`src/app/(authenticated)/`)

Navigation gated by `user.role === 'owner'`; pages themselves call owner-only
APIs and render the server error if rejected (matching `sso/page.tsx`).

### 4.1 `dns-credentials/`

- **`page.tsx`** — list (name, providerType, created). "New Credential" button
  opens a **create modal** (`name`, `providerType` select = Cloudflare, `apiToken`
  password input). Each row has edit (rename / rotate token via modal) and delete.
  Delete surfaces the **409** ("in use by an ACME issuer") inline.
- Simple 3-field resource → modals on the list page, no sub-pages.

### 4.2 `certificate-issuers/`

- **`page.tsx`** — list (name, type badge, cert-manager status badge from
  `status`/`statusMessage`, created). "New Issuer" → `create/`. Row delete
  surfaces **409** ("in use by a certificate"). If `GET /certificates/issuers`
  returns **404** (backend not in-cluster), render an informational empty state:
  "Certificate issuers require FastGateway running in-cluster with cert-manager."
- **`create/page.tsx`** — a **type toggle** (Self-signed CA | ACME):
  - Self-signed CA: `name`, `commonName`, `keyAlgorithm` (RSA/ECDSA select),
    `keySize`, `durationDays` (defaults RSA/2048/365-ish; pin defaults in plan).
  - ACME: `name`, `server` (Let's Encrypt prod/staging/ZeroSSL presets or custom
    URL), `email`, `dnsCredentialId` (dropdown from `dnsCredentialsApi.list()`),
    optional **EAB** (`keyId`, `hmacKey`) for ZeroSSL.
  - Manual validation; on success route to the issuer detail page.
- **`[issuerId]/page.tsx`** — config (read-only), live cert-manager status
  (`getStatus`), and **grants management**: list granted projects
  (`listGrants`), add a grant via a project picker (`projectsApi.list()` minus
  already-granted), revoke a grant (409 guard when a cert still uses it). Delete
  issuer here too.

## 5. Project pages (`src/app/projects/[projectId]/certificates/`)

Data load: `Promise.all([projectsApi.get, certificatesApi.list, permissionsApi.getProjectPermissions])`.

- **`page.tsx`** — list (name, usage, issuer name, status badge, expiry
  `notAfter`, sync/distribution status). "New Certificate" gated on
  `certificate.create`. When `issuersForProject` is empty, show an empty-state
  nudge ("No certificate issuers are granted to this project — ask an owner to
  grant one.").
- **`create/page.tsx`** — form: `name`, `issuer` (dropdown from
  `issuersForProject`), `usage` (server | client). Then conditionally: `dnsNames`
  (`TagInput`) when `usage=server`, or `subject` (`Input`) when `usage=client`.
  Advanced (collapsible): `keyAlgorithm`, `keySize`, `durationDays` (blank →
  server defaults RSA/2048/90). No Preview/YAML tab (no backend preview
  endpoint). On submit → `certificatesApi.create`; branch on `approvalId`:
  non-null → "Submitted for approval"; null → "Certificate created"; then route
  to detail. Button label reflects whether approvals are on (reuse the project's
  existing approval-enabled signal if available; otherwise always "Create
  Certificate" and branch on the response).
- **`[certificateId]/page.tsx`** — detail:
  - Status + `statusMessage` banner (color by status).
  - Pending-approval banner when `status==='pending'`: fetch project approvals
    filtered to `entityType=certificate`, match `entityId===certificateId`, show
    approver/stage info (reuse the routes-detail `pendingApproval` banner
    pattern).
  - Facts: issuer, hostnames/subject, fingerprint, expiry, key params.
  - **Distribution** section: `getDistribution` (sync status + last-pushed
    fingerprint + timestamp) and a "Resync now" button gated on
    `certificate.edit` (`resync`).
  - **Delete** with 409 guard ("referenced by a domain/client").
  - **Light polling** (e.g. every 4s) while `status ∈ {pending, issuing}`, then
    stop.

## 6. Approvals integration

Fold certificate approvals into the existing unified `approvals/page.tsx`:
- Fetch `entityType=certificate` alongside route + client-attachment approvals
  (via `approvalsApi` with the extended entity type), map into the existing
  `UnifiedApproval` shape, add a "Certificate" tab.
- Stage approve/reject/cancel reuse the existing generic approval endpoints — no
  new approval API surface.

## 7. Permissions & sidebar

- **Helper** `hasCertPerm(perms: ProjectPermissions | null, perm: string): boolean`
  = `!!perms && (perms.isOwner || perms.isProjectAdmin || perms.permissions.includes(perm))`.
  Used for `certificate.view/create/edit/delete` gating on project pages/buttons.
- **Sidebar** (`src/components/features/sidebar.tsx`):
  - Owner group (`user.role === 'owner'`): add **Certificate Issuers**
    (`/certificate-issuers`) and **DNS Credentials** (`/dns-credentials`), each
    with a lucide icon (e.g. `Stamp`/`ShieldCheck` and `Cloud`).
  - Project Resources group: add **Certificates**
    (`/projects/:projectId/certificates`) gated on
    `hasCertPerm(permissions, 'certificate.view')`, icon e.g. `FileKey`.

## 8. Error handling

- `409` (delete/revoke guards) → read `err.response?.data?.error`, show inline.
- `404` on `/certificates/issuers` → owner issuer pages show the "requires
  in-cluster cert-manager" empty state (not a crash).
- `403` → server-enforced; page shows the returned error (owner pages don't
  pre-redirect, matching `sso`).
- `422` (semantic, e.g. ACME needs a `dnsCredentialId`) → surface the message on
  the offending field / form banner.
- Create-cert list/detail refresh on mutation; distribution/status polled only
  while transitional.

## 9. Testing

Match repo density (Jest; see `src/lib/api/topology.test.ts`):
- Unit-test each new API client module with a mocked axios (`apiClient`),
  asserting method → URL/verb/body and `response.data` unwrapping, including the
  `create` 201-vs-202 envelope.
- Unit-test pure helpers: status→badge mapping, create-form validation
  (server-vs-client field requirement), `hasCertPerm`.
- Component tests kept light, consistent with the existing codebase.

## 10. Out of scope (YAGNI / backend not live)

- Owner-wide fleet view (`GET /certificates` not live).
- Attach-cert-to-domain and attach-cert-to-client UI (endpoints not live) — this
  iteration manages certs but does not wire them onto a Gateway listener from
  the UI.
- PATCH cert edit/re-issue (certs immutable in the live backend).
- DNS providers beyond Cloudflare.
- Any redesign of the existing UI language.
