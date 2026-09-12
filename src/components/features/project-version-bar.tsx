'use client';

import { useProjectVersions } from '@/hooks/useProjectVersions';
import { ProjectVersionChips } from './project-version-chips';
import { VersionCompatBanner } from './version-compat-banner';

interface Props {
  projectId: string;
}

export function ProjectVersionBar({ projectId }: Props) {
  const { data, isLoading, isRefreshing, refresh } = useProjectVersions(projectId);

  return (
    <div>
      <div className="flex items-center justify-end gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <ProjectVersionChips
          data={data}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onRefresh={refresh}
        />
      </div>
      <VersionCompatBanner projectId={projectId} data={data} />
    </div>
  );
}
