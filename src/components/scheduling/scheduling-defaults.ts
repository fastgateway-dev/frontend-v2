import type {
  DeploymentStrategyConfig,
  PDBConfig,
  PodPlacementConfig,
  TolerationConfig,
  TopologySpreadConstraintConfig,
} from '@/types';

export function defaultPodPlacement(): PodPlacementConfig {
  return {
    nodeSelector: {},
    tolerations: [],
    topologySpreadConstraints: [],
    priorityClassName: '',
  };
}

export function defaultToleration(): TolerationConfig {
  return { key: '', operator: 'Equal', value: '', effect: 'NoSchedule' };
}

export function defaultTopologySpreadConstraint(): TopologySpreadConstraintConfig {
  return { maxSkew: 1, topologyKey: 'topology.kubernetes.io/zone', whenUnsatisfiable: 'ScheduleAnyway' };
}

export function defaultPDB(): PDBConfig {
  return { kind: 'minAvailable', value: '50%' };
}

export function defaultRollingUpdate(): DeploymentStrategyConfig {
  return { type: 'RollingUpdate', rollingUpdate: { maxSurge: '25%', maxUnavailable: '25%' } };
}

// validateIntOrPercent returns null if `s` is a non-negative integer (with the caller's min)
// or a percentage in [0%-100%]. Returns an error string otherwise.
// Used by client-side feedback BEFORE the backend validator runs.
export function validateIntOrPercent(s: string, opts: { min?: number } = {}): string | null {
  const min = opts.min ?? 0;
  if (s === '') return 'value required';
  if (s.endsWith('%')) {
    const num = Number(s.slice(0, -1));
    if (!Number.isInteger(num) || num < 0 || num > 100) return 'percentage must be 0%-100%';
    return null;
  }
  const num = Number(s);
  if (!Number.isInteger(num) || num < min) return `must be an integer >= ${min}`;
  return null;
}
