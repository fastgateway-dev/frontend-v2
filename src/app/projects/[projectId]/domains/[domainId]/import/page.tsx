'use client';

import { useParams } from 'next/navigation';
import { ImportWizard } from '@/components/ImportWizard';

export default function ImportPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const domainId = params.domainId as string;

  return (
    <div className="p-8">
      <ImportWizard projectId={projectId} domainId={domainId} />
    </div>
  );
}
