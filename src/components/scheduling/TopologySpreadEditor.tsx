'use client';

import React from 'react';
import type { TopologySpreadConstraintConfig, WhenUnsatisfiable } from '@/types';
import { defaultTopologySpreadConstraint } from './scheduling-defaults';

interface Props {
  value: TopologySpreadConstraintConfig[] | undefined;
  onChange: (next: TopologySpreadConstraintConfig[]) => void;
  disabled?: boolean;
}

const WHEN_OPTIONS: { value: WhenUnsatisfiable; label: string }[] = [
  { value: 'ScheduleAnyway', label: 'ScheduleAnyway (best-effort)' },
  { value: 'DoNotSchedule', label: 'DoNotSchedule (strict)' },
];

export function TopologySpreadEditor({ value, onChange, disabled }: Props) {
  const rows = value ?? [];

  function update(i: number, next: TopologySpreadConstraintConfig) {
    onChange(rows.map((r, idx) => (idx === i ? next : r)));
  }
  function add() {
    onChange([...rows, defaultTopologySpreadConstraint()]);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase text-gray-600">Topology spread constraints</h4>
        <button
          type="button"
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline"
          onClick={add}
        >+ Add constraint</button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-gray-500">No spread constraints — replicas may cluster on the same zone/node.</p>
      )}
      {rows.map((c, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end border border-gray-200 rounded-md p-2">
          <div className="col-span-2">
            <label className="block text-xs text-gray-700">Max skew</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              type="number"
              min={1}
              value={c.maxSkew}
              disabled={disabled}
              onChange={(e) => update(i, { ...c, maxSkew: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="col-span-5">
            <label className="block text-xs text-gray-700">Topology key</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={c.topologyKey}
              disabled={disabled}
              onChange={(e) => update(i, { ...c, topologyKey: e.target.value })}
            />
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-gray-700">When unsatisfiable</label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={c.whenUnsatisfiable}
              disabled={disabled}
              onChange={(e) => update(i, { ...c, whenUnsatisfiable: e.target.value as WhenUnsatisfiable })}
            >
              {WHEN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <button
              type="button"
              disabled={disabled}
              className="text-xs text-red-600 hover:underline"
              onClick={() => remove(i)}
            >Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
