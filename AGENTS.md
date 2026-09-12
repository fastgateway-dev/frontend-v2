# FastGateway Frontend - AI Agent Context

## Project Overview

FastGateway frontend is a Next.js application providing a UI for managing Kubernetes Gateway API resources. It communicates with the Go backend REST API.

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Directory Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── login/              # Login page
│   │   ├── users/              # User management (admin only)
│   │   ├── projects/           # Project pages
│   │   │   ├── new/            # Create project
│   │   │   └── [projectId]/    # Project-specific pages
│   │   │       ├── domains/    # Domain management
│   │   │       ├── teams/      # Team management
│   │   │       ├── approvals/  # Approval workflow
│   │   │       └── audit/      # Audit logs
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   └── features/           # Feature-specific components
│   ├── lib/
│   │   └── api/                # API client functions
│   ├── stores/                 # Zustand stores
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript type definitions
├── public/
├── .env.local                  # Environment variables
└── package.json
```

## Key Patterns

### Page Structure (App Router)

```
app/
├── page.tsx                    # / (redirects to /projects)
├── layout.tsx                  # Root layout with providers
├── login/page.tsx              # /login
└── projects/
    ├── page.tsx                # /projects (list)
    ├── layout.tsx              # Auth guard wrapper
    └── [projectId]/
        ├── layout.tsx          # Project layout with sidebar
        └── domains/page.tsx    # /projects/:id/domains
```

### API Client Pattern

API functions are in `src/lib/api/`. Each resource has its own file:

```typescript
// src/lib/api/teams.ts
export const teamsApi = {
  list: async (projectId: string): Promise<Team[]> => {
    const response = await apiClient.get<Team[]>(`/projects/${projectId}/teams`);
    return response.data;
  },
  create: async (projectId: string, data: CreateTeamInput): Promise<Team> => {
    const response = await apiClient.post<Team>(`/projects/${projectId}/teams`, data);
    return response.data;
  },
  // ...
};
```

### Component Pattern

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Modal } from '@/components/ui';
import { resourceApi } from '@/lib/api';
import type { Resource } from '@/types';

export default function ResourcePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [items, setItems] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const data = await resourceApi.list(projectId);
      setItems(data);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ... render
}
```

## UI Components

Located in `src/components/ui/`:

- `Button` - Variants: `primary`, `secondary`, `ghost`; Sizes: `sm`, `md`, `lg`
- `Card`, `CardContent` - Container components
- `Badge` - Variants: `default`, `success`, `warning`, `error`, `info`
- `Modal` - Dialog component with `isOpen`, `onClose`, `title` props
- `Input` - Form input with `label`, `error` props
- `Select` - Dropdown with `options` array

### Usage Example

```typescript
import { Button, Card, CardContent, Badge, Modal, Input, Select } from '@/components/ui';

<Button variant="secondary" size="sm" onClick={handler}>
  Click me
</Button>

<Badge variant="success">Active</Badge>

<Modal isOpen={show} onClose={() => setShow(false)} title="Title">
  <form>...</form>
</Modal>

<Select
  id="role"
  label="Role"
  options={[
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' },
  ]}
  {...register('role')}
/>
```

## Authentication

- JWT tokens stored in localStorage via `src/lib/api/client.ts`
- `AuthGuard` component protects routes requiring authentication
- Auth state managed by Zustand store in `src/stores/auth.ts`
- Token refresh handled automatically by axios interceptor

## Types

All TypeScript types are in `src/types/index.ts`:

- `User`, `UserRole` - User management
- `Project`, `CreateProjectInput` - Projects
- `Team`, `TeamRole`, `CreateTeamInput` - Teams
- `Domain`, `CreateDomainInput` - Domains
- `Route`, `RouteConfig`, `CreateRouteInput` - Routes
- `PathMatch` - Route path matching (`Exact`, `Prefix`, `RegularExpression`)
- `ApprovalRequest`, `ApprovalStatus` - Approval workflow

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8081
```

## Common Tasks

### Adding a New Page

1. Create directory in `src/app/`
2. Add `page.tsx` with `'use client'` directive
3. Import components from `@/components/ui`
4. Use API functions from `@/lib/api`

### Adding API Functions

1. Create or update file in `src/lib/api/`
2. Export from `src/lib/api/index.ts`
3. Add types to `src/types/index.ts` if needed

### Form Handling

Use React Hook Form:

```typescript
import { useForm } from 'react-hook-form';

const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

<form onSubmit={handleSubmit(onSubmit)}>
  <Input
    {...register('name', { required: 'Name is required' })}
    error={errors.name?.message}
  />
</form>
```

## Navigation

### Project-Level Sidebar

The sidebar in `/projects/[projectId]/layout.tsx` contains:
- Domains
- Teams
- Approvals
- Audit Logs

### Admin-Only Pages

- `/users` - User management (visible only to `owner`, `super_admin`)

## Important Conventions

1. **Always use 'use client'** for pages with interactivity
2. **Prefer Link component** over router.push for navigation
3. **Use dedicated pages** for create/edit flows (not modals) for complex forms
4. **Keep namespace selector** for backend services in route creation (services can be in any namespace)
5. **Gateway objects** are always in `fastgateway-system` namespace (handled by backend)

## Building

```bash
npm run build
npm run dev   # Development
npm start     # Production
```

## File Naming

- Pages: `page.tsx`
- Layouts: `layout.tsx`
- Components: PascalCase (`Button.tsx`)
- API files: lowercase (`teams.ts`)
- Types: `index.ts` (single file for all types)
