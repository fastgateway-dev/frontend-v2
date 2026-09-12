'use client';

import { useEffect, useState } from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import apiClient from '@/lib/api/client';

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get('/docs/openapi.yaml', { responseType: 'text', headers: { Accept: 'application/yaml' } })
      .then((res) => setSpec(res.data))
      .catch(() => setError('Failed to load API documentation'));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <ApiReferenceReact
        configuration={{
          content: spec,
          hideTestRequestButton: true,
          hiddenClients: true,
          hideClientButton: true,
          withDefaultFonts: false,
          theme: 'default',
          telemetry: false,
        }}
      />
    </div>
  );
}
