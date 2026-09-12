'use client';

import { Sidebar } from '@/components/features/sidebar';
import { AuthGuard } from '@/components/features/auth-guard';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
