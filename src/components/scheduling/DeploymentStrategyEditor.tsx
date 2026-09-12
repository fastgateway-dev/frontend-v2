'use client';

import React from 'react';
import type { DeploymentStrategyConfig } from '@/types';
import { defaultRollingUpdate, validateIntOrPercent } from './scheduling-defaults';

interface Props {
  value: DeploymentStrategyConfig | null | undefined;
  onChange: (next: DeploymentStrategyConfig | null) => void;
  disabled?: boolean;
}

type Mode = 'default' | 'rolling-custom' | 'recreate';

function modeOf(v: DeploymentStrategyConfig | null | undefined): Mode {
  if (!v) return 'default';
  if (v.type === 'Recreate') return 'recreate';
  if (v.rollingUpdate) return 'rolling-custom';
  return 'default';
}

export function DeploymentStrategyEditor({ value, onChange, disabled }: Props) {
  const mode = modeOf(value);

  function setMode(m: Mode) {
    if (m === 'default') return onChange(null);
    if (m === 'recreate') return onChange({ type: 'Recreate' });
    return onChange(defaultRollingUpdate());
  }

  const surgeErr = value?.rollingUpdate?.maxSurge !== undefined
    ? validateIntOrPercent(value.rollingUpdate.maxSurge, { min: 0 })
    : null;
  const unavailErr = value?.rollingUpdate?.maxUnavailable !== undefined
    ? validateIntOrPercent(value.rollingUpdate.maxUnavailable, { min: 0 })
    : null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-900">Update strategy</h3>
      <fieldset>
        <legend className="block text-xs font-medium uppercase text-gray-600 mb-1">Mode</legend>
        <div className="flex gap-3 text-sm">
          {(['default', 'rolling-custom', 'recreate'] as Mode[]).map((m) => (
            <label key={m} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="strategy-mode"
                checked={mode === m}
                disabled={disabled}
                onChange={() => setMode(m)}
              />
              {m === 'default' ? 'Default' : m === 'rolling-custom' ? 'Rolling update (custom)' : 'Recreate'}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'rolling-custom' && value?.rollingUpdate && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-700">Max surge (int or NN%)</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={value.rollingUpdate.maxSurge ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({
                ...value,
                rollingUpdate: { ...value.rollingUpdate!, maxSurge: e.target.value },
              })}
            />
            {surgeErr && <p className="mt-1 text-xs text-red-600">{surgeErr}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-700">Max unavailable (int or NN%)</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={value.rollingUpdate.maxUnavailable ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({
                ...value,
                rollingUpdate: { ...value.rollingUpdate!, maxUnavailable: e.target.value },
              })}
            />
            {unavailErr && <p className="mt-1 text-xs text-red-600">{unavailErr}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
