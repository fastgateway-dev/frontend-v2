'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Props {
  value: Record<string, string> | undefined;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}

interface Row {
  id: string;
  key: string;
  value: string;
}

function newId(): string {
  // Deterministic enough for in-process row identity; not exposed to the API.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fromRecord(rec: Record<string, string> | undefined): Row[] {
  return Object.entries(rec ?? {}).map(([key, value]) => ({ id: newId(), key, value }));
}

function toRecord(rows: Row[]): Record<string, string> {
  // Keys with the same string collapse to the last value, mirroring K8s nodeSelector
  // semantics. Empty keys are dropped on serialization but preserved during editing.
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.key === '') continue;
    out[r.key] = r.value;
  }
  return out;
}

function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function NodeSelectorEditor({ value, onChange, disabled }: Props) {
  const [rows, setRows] = useState<Row[]>(() => fromRecord(value));
  const lastEmittedRef = useRef<Record<string, string>>(toRecord(rows));

  // Re-sync from parent only when the parent value diverges from what we last emitted
  // (e.g., load from API, preset switch). Avoids overwriting in-progress edits.
  useEffect(() => {
    const incoming = value ?? {};
    if (!recordsEqual(incoming, lastEmittedRef.current)) {
      setRows(fromRecord(incoming));
      lastEmittedRef.current = incoming;
    }
  }, [value]);

  function emit(next: Row[]) {
    setRows(next);
    const rec = toRecord(next);
    lastEmittedRef.current = rec;
    onChange(rec);
  }

  function setKey(id: string, newKey: string) {
    emit(rows.map((r) => (r.id === id ? { ...r, key: newKey } : r)));
  }
  function setVal(id: string, newVal: string) {
    emit(rows.map((r) => (r.id === id ? { ...r, value: newVal } : r)));
  }
  function add() {
    emit([...rows, { id: newId(), key: '', value: '' }]);
  }
  function remove(id: string) {
    emit(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase text-gray-600">Node selector</h4>
        <button
          type="button"
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline"
          onClick={add}
        >+ Add label</button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-gray-500">No node-selector labels — pods may schedule on any node.</p>
      )}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-5">
            <label className="block text-xs text-gray-700">Key</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={r.key}
              disabled={disabled}
              onChange={(e) => setKey(r.id, e.target.value)}
            />
          </div>
          <div className="col-span-6">
            <label className="block text-xs text-gray-700">Value</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={r.value}
              disabled={disabled}
              onChange={(e) => setVal(r.id, e.target.value)}
            />
          </div>
          <div className="col-span-1">
            <button
              type="button"
              disabled={disabled}
              className="text-xs text-red-600 hover:underline"
              onClick={() => remove(r.id)}
            >Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
