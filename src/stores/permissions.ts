import { create } from 'zustand';
import type { ProjectPermissions } from '@/types';
import { permissionsApi } from '@/lib/api';

interface PermissionsState {
  // Cache permissions by projectId
  permissionsCache: Record<string, ProjectPermissions>;
  isLoading: Record<string, boolean>;

  // Get permissions for a project (from cache or fetch)
  getPermissions: (projectId: string) => Promise<ProjectPermissions>;

  // Fetch and cache permissions for a project
  fetchPermissions: (projectId: string) => Promise<ProjectPermissions>;

  // Clear permissions cache (e.g., on logout)
  clearCache: () => void;

  // Invalidate specific project cache
  invalidateProject: (projectId: string) => void;
}

// Default permissions for when loading or error
const defaultPermissions: ProjectPermissions = {
  canManageDomainTemplates: false,
  canManageDomains: false,
  canManageTeams: false,
  canCreateRoutes: false,
  canApproveRoutes: false,
  canViewAudit: false,
  permissions: [] as string[],
  isOwner: false,
  isProjectAdmin: false,
};

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissionsCache: {},
  isLoading: {},

  getPermissions: async (projectId: string) => {
    const state = get();

    // Return cached permissions if available
    if (state.permissionsCache[projectId]) {
      return state.permissionsCache[projectId];
    }

    // Fetch if not cached
    return state.fetchPermissions(projectId);
  },

  fetchPermissions: async (projectId: string) => {
    const state = get();

    // If already loading, wait and return default
    if (state.isLoading[projectId]) {
      return state.permissionsCache[projectId] || defaultPermissions;
    }

    // Set loading state
    set((state) => ({
      isLoading: { ...state.isLoading, [projectId]: true },
    }));

    try {
      const permissions = await permissionsApi.getProjectPermissions(projectId);

      set((state) => ({
        permissionsCache: { ...state.permissionsCache, [projectId]: permissions },
        isLoading: { ...state.isLoading, [projectId]: false },
      }));

      return permissions;
    } catch (error) {
      console.error('Failed to fetch permissions:', error);

      set((state) => ({
        isLoading: { ...state.isLoading, [projectId]: false },
      }));

      return defaultPermissions;
    }
  },

  clearCache: () => {
    set({ permissionsCache: {}, isLoading: {} });
  },

  invalidateProject: (projectId: string) => {
    set((state) => {
      const newCache = { ...state.permissionsCache };
      delete newCache[projectId];
      return { permissionsCache: newCache };
    });
  },
}));

// Hook to use permissions with automatic fetching
export function useProjectPermissions(projectId: string | undefined) {
  const { permissionsCache, isLoading, fetchPermissions } = usePermissionsStore();

  // Fetch permissions on first access if projectId exists
  if (projectId && !permissionsCache[projectId] && !isLoading[projectId]) {
    // Trigger fetch (async)
    fetchPermissions(projectId);
  }

  const permissions = projectId ? permissionsCache[projectId] : undefined;
  const loading = projectId ? isLoading[projectId] || false : false;

  return {
    permissions: permissions || defaultPermissions,
    isLoading: loading,
    hasPermissions: !!permissions,
  };
}
