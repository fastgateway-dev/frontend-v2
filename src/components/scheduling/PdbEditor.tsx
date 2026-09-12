'use client';

import React from 'react';
import type { PDBConfig, PDBKind } from '@/types';
import { defaultPDB, validateIntOrPercent } from './scheduling-defaults';

interface Props {
  value: PDBConfig | null | undefined;
  onChange: (next: PDBConfig | null) => void;
  disabled?: boolean;
}

type Mode = 'none' | 'minAvailable' | 'maxUnavailable';

export function PdbEditor({ value, onChange, disabled }: Props) {
  const mode: Mode = value?.kind ?? 'none';
  const error = value ? validateIntOrPercent(value.value, { min: 1 }) : null;

  function setMode(next: Mode) {
    if (next === 'none') {
      onChange(null);
      return;
    }
    const base = value ?? defaultPDB();
    onChange({ kind: next as PDBKind, value: base.value });
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-900">PodDisruptionBudget</h3>
      <fieldset>
        <legend className="block text-xs font-medium uppercase text-gray-600 mb-1">Mode</legend>
        <div className="flex gap-3 text-sm">
          {(['none', 'minAvailable', 'maxUnavailable'] as Mode[]).map((m) => (
            <label key={m} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="pdb-mode"
                checked={mode === m}
                disabled={disabled}
                onChange={() => setMode(m)}
              />
              {m === 'none' ? 'None' : m === 'minAvailable' ? 'Min available' : 'Max unavailable'}
            </label>
          ))}
        </div>
      </fieldset>

      {mode !== 'none' && value && (
        <div>
          <label className="block text-xs text-gray-700">Value (positive integer or percentage like &quot;50%&quot;)</label>
          <input
            className="mt-1 block w-40 rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={value.value}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}
