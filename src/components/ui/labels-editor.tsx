'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface LabelsEditorProps {
  labels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
  error?: string;
}

const KEY_VALUE_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9._-]{0,61}[a-zA-Z0-9])?$/;

export function LabelsEditor({ labels, onChange, error }: LabelsEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [inputError, setInputError] = useState('');

  const handleAdd = () => {
    setInputError('');

    const key = newKey.trim();
    const value = newValue.trim();

    if (!key) {
      setInputError('Key is required');
      return;
    }
    if (!KEY_VALUE_REGEX.test(key)) {
      setInputError('Key must be 1-63 alphanumeric chars, dashes, underscores, or dots');
      return;
    }
    if (value && !KEY_VALUE_REGEX.test(value)) {
      setInputError('Value must be 0-63 alphanumeric chars, dashes, underscores, or dots');
      return;
    }
    if (Object.keys(labels).length >= 10) {
      setInputError('Maximum 10 labels allowed');
      return;
    }
    if (key in labels) {
      setInputError(`Label "${key}" already exists`);
      return;
    }

    onChange({ ...labels, [key]: value });
    setNewKey('');
    setNewValue('');
  };

  const handleRemove = (key: string) => {
    const updated = { ...labels };
    delete updated[key];
    onChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const entries = Object.entries(labels);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Labels</label>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-200 rounded text-sm"
            >
              <span className="font-medium">{key}</span>
              {value && (
                <>
                  <span className="text-gray-400">=</span>
                  <span>{value}</span>
                </>
              )}
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="ml-1 text-gray-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Key (e.g. env)"
            value={newKey}
            onChange={(e) => { setNewKey(e.target.value); setInputError(''); }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Value (e.g. production)"
            value={newValue}
            onChange={(e) => { setNewValue(e.target.value); setInputError(''); }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {(inputError || error) && (
        <p className="text-sm text-red-500">{inputError || error}</p>
      )}

      <p className="text-xs text-gray-500">
        {entries.length}/10 labels. Keys and values: alphanumeric, dashes, underscores, dots (1-63 chars).
      </p>
    </div>
  );
}
