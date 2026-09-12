'use client';

import React from 'react';
import type { TolerationConfig, TolerationOperator, TolerationEffect } from '@/types';
import { defaultToleration } from './scheduling-defaults';

interface Props {
  value: TolerationConfig[] | undefined;
  onChange: (next: TolerationConfig[]) => void;
  disabled?: boolean;
}

const OPERATORS: { value: TolerationOperator; label: string }[] = [
  { value: 'Equal', label: 'Equal' },
  { value: 'Exists', label: 'Exists' },
];

const EFFECTS: { value: TolerationEffect; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'NoSchedule', label: 'NoSchedule' },
  { value: 'PreferNoSchedule', label: 'PreferNoSchedule' },
  { value: 'NoExecute', label: 'NoExecute' },
];

export function TolerationsEditor({ value, onChange, disabled }: Props) {
  const rows = value ?? [];

  function update(i: number, next: TolerationConfig) {
    const arr = rows.map((r, idx) => (idx === i ? next : r));
    onChange(arr);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...rows, defaultToleration()]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase text-gray-600">Tolerations</h4>
        <button
          type="button"
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline"
          onClick={add}
        >+ Add toleration</button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-gray-500">No tolerations — pods will not schedule on tainted nodes.</p>
      )}
      {rows.map((tol, i) => (
        <Row key={i} tol={tol} disabled={disabled} onChange={(next) => update(i, next)} onRemove={() => remove(i)} />
      ))}
    </div>
  );
}

function Row({ tol, onChange, onRemove, disabled }: {
  tol: TolerationConfig;
  onChange: (t: TolerationConfig) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const showValue = tol.operator === 'Equal';
  const showSeconds = tol.effect === 'NoExecute';

  return (
    <div className="grid grid-cols-12 gap-2 items-end border border-gray-200 rounded-md p-2">
      <div className="col-span-3">
        <label className="block text-xs text-gray-700">Key</label>
        <input
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          value={tol.key ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ ...tol, key: e.target.value })}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-gray-700">Operator</label>
        <select
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          value={tol.operator ?? 'Equal'}
          disabled={disabled}
          onChange={(e) => {
            const op = e.target.value as TolerationOperator;
            onChange(op === 'Exists' ? { ...tol, operator: 'Exists', value: '' } : { ...tol, operator: 'Equal' });
          }}
        >
          {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {showValue ? (
        <div className="col-span-2">
          <label className="block text-xs text-gray-700">Value</label>
          <input
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={tol.value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...tol, value: e.target.value })}
          />
        </div>
      ) : (<div className="col-span-2" />)}
      <div className="col-span-2">
        <label className="block text-xs text-gray-700">Effect</label>
        <select
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          value={tol.effect ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const eff = e.target.value as TolerationEffect;
            onChange(eff === 'NoExecute' ? { ...tol, effect: 'NoExecute' } : { ...tol, effect: eff, tolerationSeconds: undefined });
          }}
        >
          {EFFECTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {showSeconds ? (
        <div className="col-span-2">
          <label className="block text-xs text-gray-700">Seconds</label>
          <input
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            type="number"
            min={0}
            value={tol.tolerationSeconds ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...tol, tolerationSeconds: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
      ) : (<div className="col-span-2" />)}
      <div className="col-span-1">
        <button
          type="button"
          disabled={disabled}
          className="text-xs text-red-600 hover:underline"
          onClick={onRemove}
        >Remove</button>
      </div>
    </div>
  );
}
