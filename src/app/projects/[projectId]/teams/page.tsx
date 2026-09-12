'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Users, Trash2, Shield } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal, Select, Checkbox } from '@/components/ui';
import { projectTeamsApi, globalTeamsApi, presetsApi } from '@/lib/api';
import type { Team, ProjectTeamRole, AssignTeamInput, UpdateTeamPresetsInput, PermissionPreset } from '@/types';

function PresetSelector({
  presets,
  selectedPresetIds,
  togglePreset,
}: {
  presets: PermissionPreset[];
  selectedPresetIds: string[];
  togglePreset: (presetId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Permission Presets
      </label>
      <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
        {presets.map((preset) => (
          <label
            key={preset.id}
            className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer"
          >
            <Checkbox
              checked={selectedPresetIds.includes(preset.id)}
              onChange={() => togglePreset(preset.id)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{preset.name}</span>
                {preset.isBuiltin && (
                  <Badge variant="default" className="text-xs">Built-in</Badge>
                )}
              </div>
              {preset.description && (
                <p className="text-sm text-gray-500">{preset.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {preset.permissions.length} permissions
              </p>
            </div>
          </label>
        ))}
      </div>
      {selectedPresetIds.length > 0 && (
        <p className="text-sm text-gray-500">
          {selectedPresetIds.length} preset{selectedPresetIds.length > 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}

export default function ProjectTeamsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [projectTeams, setProjectTeams] = useState<ProjectTeamRole[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [presets, setPresets] = useState<PermissionPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedProjectTeam, setSelectedProjectTeam] = useState<ProjectTeamRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [projectTeamsData, allTeamsData, presetsData] = await Promise.all([
        projectTeamsApi.list(projectId),
        globalTeamsApi.list(),
        presetsApi.list(projectId),
      ]);
      setProjectTeams(projectTeamsData || []);
      setAllTeams(allTeamsData || []);
      setPresets(presetsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTeamId('');
    setSelectedPresetIds([]);
    setError(null);
  };

  const onAssignTeam = async () => {
    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }
    if (selectedPresetIds.length === 0) {
      setError('Please select at least one preset');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const input: AssignTeamInput = {
        teamId: selectedTeamId,
        presetIds: selectedPresetIds,
      };
      await projectTeamsApi.assign(projectId, input);
      setShowAssignModal(false);
      resetForm();
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      console.error('Failed to assign team:', error);
      setError(error.response?.data?.error || 'Failed to assign team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePresets = async () => {
    if (!selectedProjectTeam) return;

    if (selectedPresetIds.length === 0) {
      setError('Please select at least one preset');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const input: UpdateTeamPresetsInput = {
        presetIds: selectedPresetIds,
      };
      await projectTeamsApi.updatePresets(projectId, selectedProjectTeam.teamId, input);
      setShowEditModal(false);
      setSelectedProjectTeam(null);
      resetForm();
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      console.error('Failed to update presets:', error);
      setError(error.response?.data?.error || 'Failed to update presets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveTeam = async () => {
    if (!selectedProjectTeam) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await projectTeamsApi.remove(projectId, selectedProjectTeam.teamId);
      setShowRemoveModal(false);
      setSelectedProjectTeam(null);
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      console.error('Failed to remove team:', error);
      setError(error.response?.data?.error || 'Failed to remove team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (ptr: ProjectTeamRole) => {
    setSelectedProjectTeam(ptr);
    // Extract preset IDs from the team's current presets
    const currentPresetIds = ptr.presets?.map((ptp) => ptp.presetId) || [];
    setSelectedPresetIds(currentPresetIds);
    setError(null);
    setShowEditModal(true);
  };

  const openRemoveModal = (ptr: ProjectTeamRole) => {
    setSelectedProjectTeam(ptr);
    setError(null);
    setShowRemoveModal(true);
  };

  const togglePreset = (presetId: string) => {
    setSelectedPresetIds((prev) =>
      prev.includes(presetId)
        ? prev.filter((id) => id !== presetId)
        : [...prev, presetId]
    );
  };

  // Get teams that are not already assigned to this project
  const availableTeams = allTeams.filter(
    (team) => !projectTeams.some((ptr) => ptr.teamId === team.id)
  );

  const getPresetBadges = (ptr: ProjectTeamRole) => {
    if (!ptr.presets || ptr.presets.length === 0) {
      return <Badge variant="default">No presets</Badge>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {ptr.presets.map((ptp) => {
          const preset = ptp.preset;
          if (!preset) return null;

          let variant: 'default' | 'success' | 'warning' | 'error' | 'info' = 'default';
          if (preset.isBuiltin) {
            switch (preset.name) {
              case 'Editor':
                variant = 'success';
                break;
              case 'Approver':
                variant = 'info';
                break;
              case 'Admin':
                variant = 'warning';
                break;
            }
          }

          return (
            <Badge key={ptp.id} variant={variant}>
              {preset.name}
            </Badge>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Teams</h1>
          <p className="text-gray-600 mt-1">Manage team access and permissions for this project</p>
        </div>
        <Button onClick={() => {
          resetForm();
          setShowAssignModal(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Team
        </Button>
      </div>

      {projectTeams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No teams assigned</h3>
            <p className="text-gray-600 mb-4">
              Assign global teams to this project to give users access.
              {availableTeams.length === 0 && (
                <span className="block mt-2 text-sm">
                  No global teams available. Ask an owner to create teams first.
                </span>
              )}
            </p>
            {availableTeams.length > 0 && (
              <Button onClick={() => setShowAssignModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Assign Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projectTeams.map((ptr) => (
            <Card key={ptr.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{ptr.team.name}</h3>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        {ptr.team.description || 'No description'}
                      </p>
                      {getPresetBadges(ptr)}
                      {ptr.effectivePermissions && ptr.effectivePermissions.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Effective: {ptr.effectivePermissions.slice(0, 3).join(', ')}
                          {ptr.effectivePermissions.length > 3 && ` +${ptr.effectivePermissions.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{ptr.team.memberCount} members</span>
                    <Button variant="secondary" size="sm" onClick={() => openEditModal(ptr)}>
                      <Shield className="h-4 w-4 mr-1" />
                      Edit Presets
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRemoveModal(ptr)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Team Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          resetForm();
        }}
        title="Assign Team to Project"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {availableTeams.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No teams available to assign. All teams are already assigned to this project,
              or no global teams exist yet.
            </p>
          ) : (
            <>
              <Select
                id="teamId"
                label="Team"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                options={[
                  { value: '', label: 'Select a team...' },
                  ...availableTeams.map((team) => ({
                    value: team.id,
                    label: `${team.name}${team.memberCount > 0 ? ` (${team.memberCount} members)` : ''}`,
                  })),
                ]}
              />

              <PresetSelector
                presets={presets}
                selectedPresetIds={selectedPresetIds}
                togglePreset={togglePreset}
              />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            {availableTeams.length > 0 && (
              <Button onClick={onAssignTeam} isLoading={isSubmitting}>
                Assign Team
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Presets Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProjectTeam(null);
          resetForm();
        }}
        title={`Edit Presets for ${selectedProjectTeam?.team.name}`}
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <PresetSelector
            presets={presets}
            selectedPresetIds={selectedPresetIds}
            togglePreset={togglePreset}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePresets} isLoading={isSubmitting}>
              Update Presets
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Team Modal */}
      <Modal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setSelectedProjectTeam(null);
          setError(null);
        }}
        title="Remove Team from Project"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <p className="text-gray-600">
            Are you sure you want to remove{' '}
            <span className="font-semibold">{selectedProjectTeam?.team.name}</span> from this project?
            Team members will lose access to this project.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowRemoveModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRemoveTeam}
              isLoading={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Team
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
