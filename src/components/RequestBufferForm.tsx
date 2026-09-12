'use client';

import type { RequestBufferConfig } from '@/types';

interface RequestBufferFormProps {
  value?: RequestBufferConfig;
  onChange: (value: RequestBufferConfig | undefined) => void;
  disabled?: boolean;
}

export default function RequestBufferForm({ value, onChange, disabled }: RequestBufferFormProps) {
  const handleRemove = () => {
    onChange(undefined);
  };

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange({ limit: '1Mi' })}
        disabled={disabled}
        className="text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50"
      >
        + Add Request Buffering
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Buffer Limit</label>
          <input
            type="text"
            placeholder="e.g., 4Ki, 1Mi"
            value={value.limit}
            onChange={(e) => onChange({ limit: e.target.value })}
            disabled={disabled}
            className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          className="px-3 py-2 text-sm text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Requests larger than this limit will receive HTTP 413 (Content Too Large). Supports SI units: Ki, Mi, Gi.
      </p>
    </div>
  );
}
