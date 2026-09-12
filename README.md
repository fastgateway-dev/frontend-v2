# FastGateway Frontend

FastGateway Frontend is the open-source web UI for [FastGateway](https://github.com/fastgateway-dev/backend-v2), a control plane for managing Kubernetes Gateway API resources. It provides screens for managing projects, domains, routes, teams, approvals, and audit logs against a running FastGateway backend API.

## Prerequisites

- Node.js 20.9 or later (required by Next.js 16)
- npm
- A running instance of the open-source [`backend-v2`](https://github.com/fastgateway-dev/backend-v2) API

## Setup

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

## Backend compatibility

This frontend targets the open-source [`backend-v2`](https://github.com/fastgateway-dev/backend-v2) API. Make sure a compatible backend instance is running and reachable at the `BACKEND_URL` you configured above.

## Building for production

```bash
npm run build
npm start
```

## Running tests

```bash
npm test
```

## Not yet available

Configuring AI providers (e.g. for AI-assisted features) via this UI is not yet supported. AI provider configuration is currently done server-side on `backend-v2`. A UI for managing this will be added once the backend exposes an AI-config API.
