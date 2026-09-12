<div align="center">
  <img src="docs/assets/logo.png" alt="FastGateway" width="110">

  <h1>FastGateway</h1>

  <p><strong>Manage the Kubernetes Gateway API without hand-writing YAML.</strong></p>

  <p>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg"></a>
    <a href="https://github.com/fastgateway-dev/frontend-v2/actions/workflows/main.yaml"><img alt="CI" src="https://github.com/fastgateway-dev/frontend-v2/actions/workflows/main.yaml/badge.svg"></a>
    <a href="package.json"><img alt="Next.js" src="https://img.shields.io/github/package-json/dependency-version/fastgateway-dev/frontend-v2/next?label=next.js"></a>
    <a href="https://github.com/fastgateway-dev/frontend-v2/pkgs/container/frontend-v2"><img alt="Image" src="https://img.shields.io/badge/ghcr.io-frontend--v2-informational"></a>
  </p>

  <p>
    <a href="https://fastgateway.dev">Website</a> ·
    <a href="https://github.com/fastgateway-dev/backend-v2">Backend</a>
  </p>
</div>

---

FastGateway is a web-based management interface for the Kubernetes Gateway API. Create and manage Gateways, HTTPRoutes, and traffic policies through a UI and REST API instead of hand-writing manifests, with teams, approvals, and an audit trail on top.

This repository contains the **frontend** (Next.js web UI). The backend lives in [`fastgateway-dev/backend-v2`](https://github.com/fastgateway-dev/backend-v2).

## 📦 Prerequisites

- Node.js 20.9 or later (required by Next.js 16)
- npm
- A running instance of the open-source [`backend-v2`](https://github.com/fastgateway-dev/backend-v2) API

## 🚀 Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file and configure it:

   ```bash
   cp .env.example .env.local
   ```

   Set `BACKEND_URL` in `.env.local` to the address of your running `backend-v2` API instance (e.g. `http://localhost:8081`).

3. Start the development server:

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`.

## 🔗 Backend Compatibility

This frontend targets the open-source [`backend-v2`](https://github.com/fastgateway-dev/backend-v2) API. Make sure a compatible backend instance is running and reachable at the `BACKEND_URL` you configured above.

## 🏗️ Building for Production

```bash
npm run build
npm start
```

A container image is also published to `ghcr.io/fastgateway-dev/frontend-v2` (multi-arch: `linux/amd64`, `linux/arm64`).

## 🧪 Running Tests

```bash
npm test
```

Linting:

```bash
npm run lint
```

## 🤖 AI Provider Configuration (Not Yet Available)

Configuring AI providers via this UI is not yet supported. AI provider configuration is currently done server-side on `backend-v2`. A UI for managing this will be added once the backend exposes an AI-config API.

## 📄 License

FastGateway is licensed under the [Apache License 2.0](LICENSE).
