'use client';

import { useParams } from 'next/navigation';
import { Sidebar } from '@/components/features/sidebar';
import { AuthGuard } from '@/components/features/auth-guard';
import { ProjectVersionBar } from '@/components/features/project-version-bar';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar projectId={projectId} />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <ProjectVersionBar projectId={projectId} />
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
