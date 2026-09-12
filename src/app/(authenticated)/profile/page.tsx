'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/lib/api/auth';
import { globalTeamsApi, projectsApi, permissionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield, Eye, EyeOff, Check, Key, Users, FolderOpen, ChevronDown, ChevronRight, Plus, Copy, Trash2, Lock, AlertTriangle } from 'lucide-react';
import type { Team, Project, ProjectPermissions, ApiToken, ApiTokenCapabilities } from '@/types';

type Tab = 'account' | 'security' | 'api-keys' | 'access';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and security preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'account'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="h-4 w-4" />
            Account
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'security'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="h-4 w-4" />
            Security
          </button>
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'api-keys'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Key className="h-4 w-4" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'access'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Access
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'account' && <AccountTab user={user} />}
      {activeTab === 'security' && <SecurityTab />}
      {activeTab === 'api-keys' && <APIKeysTab />}
      {activeTab === 'access' && <AccessTab />}
    </div>
  );
}

function AccountTab({ user }: { user: { username: string; email: string; role: string; authProvider?: string; authMethod?: string } | null }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Account Information</h2>

      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-2xl font-medium text-primary-700">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Profile picture coming soon</p>
          </div>
        </div>

        {/* User Info */}
        <div className="grid gap-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <Input value={user?.username || ''} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input value={user?.email || ''} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <div className="mt-1">
              <Badge variant={user?.role === 'owner' ? 'info' : 'default'}>
                {user?.role}
              </Badge>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Authentication</label>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={user?.authProvider === 'oidc' ? 'info' : 'default'}>
                {user?.authProvider === 'oidc' ? 'SSO' : 'Password'}
              </Badge>
              {user?.authMethod === 'api_token' && (
                <Badge variant="warning">
                  API Key Session
                </Badge>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Contact your administrator to update your account information.
        </p>
      </div>
    </Card>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Password validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== '';
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch && currentPassword !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Change Password</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          Password changed successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Password
          </label>
          <div className="relative">
            <Input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <div className="relative">
            <Input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Password Requirements */}
        {newPassword && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Password requirements:</p>
            <ul className="space-y-1 text-sm">
              <PasswordRequirement met={hasMinLength} text="At least 8 characters" />
              <PasswordRequirement met={hasUppercase} text="At least one uppercase letter" />
              <PasswordRequirement met={hasLowercase} text="At least one lowercase letter" />
              <PasswordRequirement met={hasNumber} text="At least one number" />
              {confirmPassword && (
                <PasswordRequirement met={passwordsMatch} text="Passwords match" />
              )}
            </ul>
          </div>
        )}

        <Button type="submit" disabled={!isValid || submitting}>
          {submitting ? 'Changing Password...' : 'Change Password'}
        </Button>
      </form>
    </Card>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-2 ${met ? 'text-green-600' : 'text-gray-500'}`}>
      <div className={`h-4 w-4 rounded-full flex items-center justify-center ${
        met ? 'bg-green-100' : 'bg-gray-100'
      }`}>
        {met ? (
          <Check className="h-3 w-3" />
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        )}
      </div>
      {text}
    </li>
  );
}

function APIKeysTab() {
  const [capabilities, setCapabilities] = useState<ApiTokenCapabilities | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiry, setNewTokenExpiry] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [caps, tokenList] = await Promise.all([
        authApi.getApiTokenCapabilities(),
        authApi.listApiTokens().catch(() => [] as ApiToken[]),
      ]);
      setCapabilities(caps);
      setTokens(tokenList);
    } catch {
      setError('Failed to load API key data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const result = await authApi.createApiToken(
        newTokenName.trim(),
        newTokenExpiry || undefined
      );
      setCreatedToken(result.token);
      setNewTokenName('');
      setNewTokenExpiry('');
      setShowCreateForm(false);
      const [caps, tokenList] = await Promise.all([
        authApi.getApiTokenCapabilities(),
        authApi.listApiTokens(),
      ]);
      setCapabilities(caps);
      setTokens(tokenList);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }
    setRevokingId(tokenId);
    setError(null);
    try {
      await authApi.revokeApiToken(tokenId);
      const [caps, tokenList] = await Promise.all([
        authApi.getApiTokenCapabilities(),
        authApi.listApiTokens(),
      ]);
      setCapabilities(caps);
      setTokens(tokenList);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async () => {
    if (createdToken) {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </Card>
    );
  }

  if (capabilities && !capabilities.enabled) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Lock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">API Keys</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            API Keys allow programmatic access to the FastGateway API.
            API Keys are not currently enabled for your account.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {createdToken && (
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 mb-1">API Key Created</h3>
              <p className="text-sm text-gray-600 mb-3">
                Copy this key now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border rounded px-3 py-2 font-mono break-all">
                  {createdToken}
                </code>
                <Button
                  variant="secondary"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="secondary"
                onClick={() => { setCreatedToken(null); setCopied(false); }}
                className="mt-3"
              >
                Done
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">API Keys</h2>
            {capabilities && (
              <p className="text-sm text-gray-500 mt-1">
                {capabilities.currentCount} of {capabilities.maxTokens} keys used
              </p>
            )}
          </div>
          {capabilities && capabilities.currentCount < capabilities.maxTokens && !showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Create New API Key</h3>
            <div className="grid gap-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="e.g., CI/CD Pipeline, Dev Platform"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date <span className="text-gray-400">(optional)</span>
                </label>
                <Input
                  type="date"
                  value={newTokenExpiry}
                  onChange={(e) => setNewTokenExpiry(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating || !newTokenName.trim()}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowCreateForm(false); setNewTokenName(''); setNewTokenExpiry(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}

        {tokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Key className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium">Last Used</th>
                  <th className="pb-2 font-medium">Expires</th>
                  <th className="pb-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tokens.map((token) => (
                  <tr key={token.id} className="text-gray-700">
                    <td className="py-3 font-medium">{token.name}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-500">
                      {token.lastUsedAt
                        ? new Date(token.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-3 text-gray-500">
                      {token.expiresAt
                        ? new Date(token.expiresAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="danger"
                        onClick={() => handleRevoke(token.id)}
                        disabled={revokingId === token.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

interface ProjectWithPermissions {
  project: Project;
  permissions: ProjectPermissions | null;
  isLoading: boolean;
}

function AccessTab() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<ProjectWithPermissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch teams and projects in parallel
      const [teamsData, projectsData] = await Promise.all([
        globalTeamsApi.listMyTeams(),
        projectsApi.list(1, 100),
      ]);

      setTeams(teamsData || []);

      // Initialize projects with loading state for permissions
      const projectsList = projectsData.data || [];
      const projectsWithPerms: ProjectWithPermissions[] = projectsList.map((p) => ({
        project: p,
        permissions: null,
        isLoading: true,
      }));
      setProjects(projectsWithPerms);

      // Fetch permissions for each project in parallel
      const permissionsPromises = projectsList.map(async (p) => {
        try {
          const perms = await permissionsApi.getProjectPermissions(p.id);
          return { projectId: p.id, permissions: perms };
        } catch {
          return { projectId: p.id, permissions: null };
        }
      });

      const permissionsResults = await Promise.all(permissionsPromises);

      // Update projects with permissions
      setProjects((prev) =>
        prev.map((p) => {
          const result = permissionsResults.find((r) => r.projectId === p.project.id);
          return {
            ...p,
            permissions: result?.permissions || null,
            isLoading: false,
          };
        })
      );
    } catch (error) {
      console.error('Failed to load access data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Teams Section */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          My Teams
        </h2>
        {teams.length === 0 ? (
          <p className="text-gray-500 text-sm">You are not a member of any team.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="border rounded-lg p-4 bg-gray-50"
              >
                <h3 className="font-medium text-gray-900">{team.name}</h3>
                {team.description && (
                  <p className="text-sm text-gray-500 mt-1">{team.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* My Projects Section */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          My Projects
        </h2>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-sm">You do not have access to any projects.</p>
        ) : (
          <div className="space-y-3">
            {projects.map(({ project, permissions, isLoading: permLoading }) => (
              <ProjectAccessCard
                key={project.id}
                project={project}
                permissions={permissions}
                isLoading={permLoading}
                isExpanded={expandedProjects.has(project.id)}
                onToggle={() => toggleProject(project.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProjectAccessCard({
  project,
  permissions,
  isLoading,
  isExpanded,
  onToggle,
}: {
  project: Project;
  permissions: ProjectPermissions | null;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FolderOpen className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-900">{project.name}</span>
          {permissions?.isOwner && (
            <Badge variant="warning">Owner</Badge>
          )}
          {permissions?.isProjectAdmin && !permissions?.isOwner && (
            <Badge variant="info">Admin</Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-4 border-t bg-white">
          {isLoading ? (
            <div className="animate-pulse h-8 bg-gray-200 rounded" />
          ) : permissions ? (
            <PermissionsList permissions={permissions} />
          ) : (
            <p className="text-sm text-gray-500">Unable to load permissions</p>
          )}
        </div>
      )}
    </div>
  );
}

function PermissionsList({ permissions }: { permissions: ProjectPermissions }) {
  // If owner or admin, show simplified view
  if (permissions.isOwner || permissions.isProjectAdmin) {
    return (
      <div className="text-sm text-gray-600">
        <Badge variant="success" className="mr-2">Full Access</Badge>
        All permissions granted
      </div>
    );
  }

  // Group permissions by category
  const permissionsByCategory: Record<string, string[]> = {
    Route: [],
    Client: [],
    Domain: [],
    Project: [],
  };

  for (const perm of permissions.permissions) {
    const [category] = perm.split('.');
    const categoryKey = category.charAt(0).toUpperCase() + category.slice(1);
    if (permissionsByCategory[categoryKey]) {
      permissionsByCategory[categoryKey].push(perm.split('.')[1]);
    }
  }

  const hasAnyPermissions = Object.values(permissionsByCategory).some((p) => p.length > 0);

  if (!hasAnyPermissions) {
    return <p className="text-sm text-gray-500">No specific permissions</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(permissionsByCategory).map(([category, perms]) => {
        if (perms.length === 0) return null;
        return (
          <div key={category}>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">{category}</h4>
            <div className="flex flex-wrap gap-1">
              {perms.map((perm) => (
                <Badge
                  key={perm}
                  variant={perm === 'view' ? 'default' : perm === 'approve' ? 'info' : 'success'}
                >
                  {perm}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
