import apiClient from './client';
import type {
  Team,
  CreateTeamInput,
  UpdateTeamInput,
  ProjectTeamRole,
  AssignTeamInput,
  UpdateTeamPresetsInput,
  User,
  AddMemberByEmailResult,
  TeamEmailInvite
} from '@/types';

// Global Teams API - for managing global teams (owner only)
export const globalTeamsApi = {
  list: async (): Promise<Team[]> => {
    const response = await apiClient.get<Team[]>('/teams');
    return response.data;
  },

  // List teams the current user is a member of (any authenticated user)
  listMyTeams: async (): Promise<Team[]> => {
    const response = await apiClient.get<Team[]>('/my-teams');
    return response.data;
  },

  get: async (teamId: string): Promise<Team> => {
    const response = await apiClient.get<Team>(`/teams/${teamId}`);
    return response.data;
  },

  create: async (data: CreateTeamInput): Promise<Team> => {
    const response = await apiClient.post<Team>('/teams', data);
    return response.data;
  },

  update: async (teamId: string, data: UpdateTeamInput): Promise<Team> => {
    const response = await apiClient.patch<Team>(`/teams/${teamId}`, data);
    return response.data;
  },

  delete: async (teamId: string): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}`);
  },

  listMembers: async (teamId: string): Promise<User[]> => {
    const response = await apiClient.get<User[]>(`/teams/${teamId}/members`);
    return response.data;
  },

  addMember: async (teamId: string, userId: string): Promise<void> => {
    await apiClient.post(`/teams/${teamId}/members`, { userId });
  },

  removeMember: async (teamId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}/members/${userId}`);
  },

  listProjects: async (teamId: string): Promise<ProjectTeamRole[]> => {
    const response = await apiClient.get<ProjectTeamRole[]>(`/teams/${teamId}/projects`);
    return response.data;
  },

  addMemberByEmail: async (teamId: string, email: string): Promise<AddMemberByEmailResult> => {
    const response = await apiClient.post<AddMemberByEmailResult>(`/teams/${teamId}/members/email`, { email });
    return response.data;
  },

  listInvites: async (teamId: string): Promise<TeamEmailInvite[]> => {
    const response = await apiClient.get<TeamEmailInvite[]>(`/teams/${teamId}/invites`);
    return response.data;
  },

  deleteInvite: async (teamId: string, inviteId: string): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}/invites/${inviteId}`);
  },
};

// Project Teams API - for managing team assignments to projects
export const projectTeamsApi = {
  list: async (projectId: string): Promise<ProjectTeamRole[]> => {
    const response = await apiClient.get<ProjectTeamRole[]>(`/projects/${projectId}/teams`);
    return response.data;
  },

  // List only teams the current user is a member of (for route owner selection)
  listMyTeams: async (projectId: string): Promise<ProjectTeamRole[]> => {
    const response = await apiClient.get<ProjectTeamRole[]>(`/projects/${projectId}/my-teams`);
    return response.data;
  },

  get: async (projectId: string, teamId: string): Promise<ProjectTeamRole> => {
    const response = await apiClient.get<ProjectTeamRole>(`/projects/${projectId}/teams/${teamId}`);
    return response.data;
  },

  assign: async (projectId: string, data: AssignTeamInput): Promise<ProjectTeamRole> => {
    const response = await apiClient.post<ProjectTeamRole>(`/projects/${projectId}/teams`, data);
    return response.data;
  },

  updatePresets: async (projectId: string, teamId: string, data: UpdateTeamPresetsInput): Promise<ProjectTeamRole> => {
    const response = await apiClient.patch<ProjectTeamRole>(`/projects/${projectId}/teams/${teamId}`, data);
    return response.data;
  },

  remove: async (projectId: string, teamId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/teams/${teamId}`);
  },
};

// Legacy API for backward compatibility during transition
// This maps old API calls to new structure
export const teamsApi = {
  // For listing teams in a project context, returns ProjectTeamRole[]
  list: async (projectId: string): Promise<ProjectTeamRole[]> => {
    return projectTeamsApi.list(projectId);
  },

  // For getting a team's role in a project
  get: async (projectId: string, teamId: string): Promise<ProjectTeamRole> => {
    return projectTeamsApi.get(projectId, teamId);
  },

  // For assigning a team to a project
  create: async (projectId: string, data: AssignTeamInput): Promise<ProjectTeamRole> => {
    return projectTeamsApi.assign(projectId, data);
  },

  // For updating a team's presets in a project
  update: async (projectId: string, teamId: string, data: UpdateTeamPresetsInput): Promise<ProjectTeamRole> => {
    return projectTeamsApi.updatePresets(projectId, teamId, data);
  },

  // For removing a team from a project
  delete: async (projectId: string, teamId: string): Promise<void> => {
    return projectTeamsApi.remove(projectId, teamId);
  },

  // These still work the same way but use global teams endpoint
  listMembers: async (_projectId: string, teamId: string): Promise<User[]> => {
    return globalTeamsApi.listMembers(teamId);
  },

  addMember: async (_projectId: string, teamId: string, userId: string): Promise<void> => {
    return globalTeamsApi.addMember(teamId, userId);
  },

  removeMember: async (_projectId: string, teamId: string, userId: string): Promise<void> => {
    return globalTeamsApi.removeMember(teamId, userId);
  },
};
