# Changelog

All notable changes to the FastGateway frontend are documented here.

## v0.1.0 — 2026-09-24

First open-source release of the **FastGateway** web UI — the management
console for the Kubernetes Gateway API, built with Next.js 16.

This release opens the source and unlocks every feature: the previous
commercial license layer has been removed, so all capabilities are available
to everyone. It also ships a complete **managed-certificates** experience.

### Highlights

- **Fully open source, no feature gating.** The commercial license layer
  (license checks, gated pages, and Enterprise-only prompts) is gone; all
  features are enabled out of the box.
- **Managed certificates, end to end** — issue, observe, distribute, attach,
  and export TLS certificates from the UI, without hand-writing Kubernetes
  Secrets or cert-manager manifests.

### Managed certificates

**Trust infrastructure (owner)**
- **Certificate issuers** — create and manage self-signed (private CA) and
  ACME issuers, with per-project grants controlling which projects may use
  each issuer, and live cert-manager readiness status.
- **DNS credentials** — manage DNS-provider credentials (Cloudflare) used by
  ACME DNS-01 issuance; secrets are write-only and never displayed.

**Server certificates (project)**
- Create (approval-gated), list, and inspect certificates, with issuer name,
  issuance status, distribution/sync state, and referencing domains shown
  inline.
- Attach / detach a managed server certificate to a domain (replacing
  bring-your-own TLS secrets), plus force-resync and delete (guarded when in
  use).
- **Fleet view** — an owner-wide list of every certificate across all
  projects, filterable by status and usage.

**Client certificates / mTLS identities (project)**
- Create client certificates in **managed-key** mode (subject + URI SANs) or
  **CSR** mode (upload a CSR; the platform signs it and never holds the key),
  restricted to private-CA issuers.
- **Approval-gated one-time export** of a managed client-cert bundle
  (request → approve → single-use download of key + leaf + CA chain).
- **Attach / detach** a client certificate to a Client as its mTLS identity
  (mutually exclusive with a bring-your-own CA).

**Approvals**
- Certificate create and export approvals are surfaced in the unified
  approvals view, alongside route and client-attachment approvals.

### Navigation

- The owner **Admin** navigation is grouped into **IAM** (Users, Teams, SSO),
  **Certificate** (All Certificates, Issuers), and **DNS** (Provider), with
  Settings standalone.

### Tooling & packaging

- **Next.js 16** with standalone output; **ESLint 9** flat config.
- **Multi-arch container images** (`linux/amd64` + `linux/arm64`) built and
  published to `ghcr.io/fastgateway-dev/frontend-v2` via GitHub Actions
  (CI on `main`, image publish on `v*.*.*` tags).
- Licensed under **Apache-2.0**.

### Container image

```
ghcr.io/fastgateway-dev/frontend-v2:v0.1.0
```
