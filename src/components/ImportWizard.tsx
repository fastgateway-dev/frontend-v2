'use client';

import { useState, useEffect } from 'react';
import { FileText, Globe, FileCode } from 'lucide-react';
import { AIImportWizard, type ImportMode as AIImportMode } from './AIImportWizard';
import { OpenAPIImportFlow } from './OpenAPIImportFlow';
import { Button, Card, CardContent, Select } from '@/components/ui';
import { projectTeamsApi } from '@/lib/api';
import type { ProjectTeamRole } from '@/types';

interface ImportWizardProps {
  projectId: string;
  domainId: string;
}

type WizardMode = Exclude<AIImportMode, 'natural_language'> | 'openapi';

const MODE_OPTIONS: {
  key: WizardMode;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    key: 'ingress',
    label: 'Import Kubernetes Ingress',
    description: 'Convert Kubernetes Ingress resources to FastGateway routes (AI)',
    icon: FileText,
  },
  {
    key: 'istio',
    label: 'Import Istio Configuration',
    description: 'Convert Istio VirtualService and Gateway resources (AI)',
    icon: Globe,
  },
  {
    key: 'kong',
    label: 'Import Kong Configuration',
    description: 'Convert Kong declarative configuration to routes (AI)',
    icon: FileText,
  },
  {
    key: 'openapi',
    label: 'Import from OpenAPI',
    description: 'Parse an OpenAPI 3.x spec into routes (no AI, deterministic)',
    icon: FileCode,
  },
];

export function ImportWizard({ projectId, domainId }: ImportWizardProps) {
  const [stage, setStage] = useState<'select' | 'flow'>('select');
  const [selectedMode, setSelectedMode] = useState<WizardMode | null>(null);
  const [teams, setTeams] = useState<ProjectTeamRole[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    projectTeamsApi.listMyTeams(projectId).then((data) => {
      setTeams(data);
      if (data.length === 1) {
        setSelectedTeamId(data[0].team.id);
      }
      setLoadingTeams(false);
    });
  }, [projectId]);

  const handleBack = () => {
    setStage('select');
  };

  if (stage === 'flow' && selectedMode === 'openapi') {
    return (
      <OpenAPIImportFlow
        projectId={projectId}
        domainId={domainId}
        teamId={selectedTeamId}
        onBack={handleBack}
      />
    );
  }

  if (stage === 'flow' && selectedMode && selectedMode !== 'openapi') {
    return (
      <AIImportWizard
        projectId={projectId}
        domainId={domainId}
        mode={selectedMode}
        teamId={selectedTeamId}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Import Routes</h2>
        <p className="text-sm text-gray-500">Choose how you want to add routes to this domain.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selectedMode === opt.key;
          return (
            <Card
              key={opt.key}
              className={`cursor-pointer transition ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
              onClick={() => setSelectedMode(opt.key)}
            >
              <CardContent className="p-4 flex gap-3">
                <Icon className="w-5 h-5 mt-0.5 text-indigo-600" />
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Team</label>
        <Select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          disabled={loadingTeams}
          options={[
            { value: '', label: 'Select team...' },
            ...teams.map((t) => ({ value: t.team.id, label: t.team.name })),
          ]}
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => setStage('flow')}
          disabled={!selectedMode || !selectedTeamId}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
