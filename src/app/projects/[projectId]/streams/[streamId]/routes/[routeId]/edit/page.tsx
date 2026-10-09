'use client';

import { useParams } from 'next/navigation';
import { L4RouteForm } from '@/components/streams/L4RouteForm';

export default function EditStreamRoutePage() {
  const params = useParams();
  return (
    <L4RouteForm
      projectId={params.projectId as string}
      streamId={params.streamId as string}
      routeId={params.routeId as string}
    />
  );
}
