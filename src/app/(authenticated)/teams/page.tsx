'use client';

import { useState, useEffect } from 'react';
import { globalTeamsApi } from '@/lib/api';
import { Team, CreateTeamInput, User, TeamEmailInvite } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Users, UserPlus, Trash2, Mail, X } from 'lucide-react';
import { usersApi } from '@/lib/api/users';

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [formData, setFormData] = useState<CreateTeamInput>({
    name: '',
    description: '',
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [addMode, setAddMode] = useState<'select' | 'email'>('select');
  const [emailInput, setEmailInput] = useState('');
  const [invites, setInvites] = useState<TeamEmailInvite[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTeams();
    fetchAllUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const data = await globalTeamsApi.list();
      setTeams(data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await usersApi.list(1, 100);
      setAllUsers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const members = await globalTeamsApi.listMembers(teamId);
      setTeamMembers(members || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch team members');
    }
  };

  const fetchInvites = async (teamId: string) => {
    try {
      const data = await globalTeamsApi.listInvites(teamId);
      setInvites(data || []);
    } catch (err) {
      console.error('Failed to fetch invites:', err);
      setInvites([]);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await globalTeamsApi.create(formData);
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      fetchTeams();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    setSubmitting(true);

    try {
      await globalTeamsApi.delete(selectedTeam.id);
      setShowDeleteModal(false);
      setSelectedTeam(null);
      fetchTeams();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to delete team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMembers = async (team: Team) => {
    setSelectedTeam(team);
    await Promise.all([fetchTeamMembers(team.id), fetchInvites(team.id)]);
    setShowMembersModal(true);
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !selectedUserId) return;
    setSubmitting(true);

    try {
      await globalTeamsApi.addMember(selectedTeam.id, selectedUserId);
      await fetchTeamMembers(selectedTeam.id);
      setShowAddMemberModal(false);
      setSelectedUserId('');
      fetchTeams(); // Refresh member counts
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;

    try {
      await globalTeamsApi.removeMember(selectedTeam.id, userId);
      await fetchTeamMembers(selectedTeam.id);
      fetchTeams(); // Refresh member counts
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleAddByEmail = async () => {
    if (!selectedTeam || !emailInput.trim()) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const result = await globalTeamsApi.addMemberByEmail(selectedTeam.id, emailInput.trim());
      if (result.type === 'added') {
        // User was found and added directly
        await fetchTeamMembers(selectedTeam.id);
      }
      // Refresh invites in both cases
      await fetchInvites(selectedTeam.id);
      setShowAddMemberModal(false);
      setEmailInput('');
      setAddMode('select');
      fetchTeams();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to invite member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!selectedTeam) return;

    try {
      await globalTeamsApi.deleteInvite(selectedTeam.id, inviteId);
      await fetchInvites(selectedTeam.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel invite');
    }
  };

  const availableUsers = allUsers.filter(
    (user) => !teamMembers.some((member) => member.id === user.id)
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-600 mt-1">Manage global teams that can be assigned to projects</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          Create Team
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading teams...</p>
        </div>
      ) : teams.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No teams found</p>
          <Button onClick={() => setShowCreateModal(true)}>
            Create First Team
          </Button>
        </Card>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {team.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 max-w-xs truncate">
                      {team.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="default">{team.memberCount} members</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenMembers(team)}
                      className="mr-2"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Members
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowDeleteModal(true);
                      }}
                      className="text-red-600 hover:text-red-700"
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

      {/* Create Team Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormError(null);
        }}
        title="Create Team"
      >
        <form onSubmit={handleCreateTeam} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {formError}
            </div>
          )}

          <Input
            label="Team Name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
            placeholder="Enter team name"
          />

          <Input
            label="Description"
            value={formData.description || ''}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Enter team description (optional)"
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTeam(null);
        }}
        title="Delete Team"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete team{' '}
            <span className="font-semibold">{selectedTeam?.name}</span>?
            This will remove the team from all projects and cannot be undone.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedTeam(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteTeam}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Deleting...' : 'Delete Team'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Team Members Modal */}
      <Modal
        isOpen={showMembersModal}
        onClose={() => {
          setShowMembersModal(false);
          setSelectedTeam(null);
          setTeamMembers([]);
          setInvites([]);
        }}
        title={`Members of ${selectedTeam?.name}`}
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </p>
            <Button
              size="sm"
              onClick={() => setShowAddMemberModal(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Add Member
            </Button>
          </div>

          {teamMembers.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No members yet</p>
          ) : (
            <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.username}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending Invites Section */}
          {invites.length > 0 && (
            <div className="pt-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Pending Invites ({invites.length})
              </h4>
              <div className="divide-y divide-gray-200 max-h-48 overflow-y-auto border border-gray-100 rounded-md">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between py-2 px-3"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-700">{invite.email}</p>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowMembersModal(false);
                setSelectedTeam(null);
                setTeamMembers([]);
                setInvites([]);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setSelectedUserId('');
          setEmailInput('');
          setAddMode('select');
          setFormError(null);
        }}
        title="Add Member"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {formError}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button
              type="button"
              className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-1 ${
                addMode === 'select'
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => {
                setAddMode('select');
                setFormError(null);
              }}
            >
              <UserPlus className="h-4 w-4" />
              Select User
            </button>
            <button
              type="button"
              className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-1 ${
                addMode === 'email'
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => {
                setAddMode('email');
                setFormError(null);
              }}
            >
              <Mail className="h-4 w-4" />
              Invite by Email
            </button>
          </div>

          {addMode === 'select' ? (
            <>
              {availableUsers.length === 0 ? (
                <p className="text-gray-500">All users are already members of this team.</p>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select User
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Input
                label="Email Address"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter email address"
              />
              <p className="text-xs text-gray-500">
                If a user with this email exists, they will be added directly. Otherwise, an invitation will be created.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddMemberModal(false);
                setSelectedUserId('');
                setEmailInput('');
                setAddMode('select');
                setFormError(null);
              }}
            >
              Cancel
            </Button>
            {addMode === 'select' ? (
              <Button
                onClick={handleAddMember}
                disabled={submitting || !selectedUserId}
              >
                {submitting ? 'Adding...' : 'Add Member'}
              </Button>
            ) : (
              <Button
                onClick={handleAddByEmail}
                disabled={submitting || !emailInput.trim()}
              >
                {submitting ? 'Sending...' : 'Send Invite'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
