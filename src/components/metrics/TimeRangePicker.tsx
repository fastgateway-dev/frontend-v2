'use client';

import React from 'react';
import type { MetricsRange } from '@/types';

interface TimeRangePickerProps {
  value: MetricsRange;
  onChange: (value: MetricsRange) => void;
}

const OPTIONS: Array<{ value: MetricsRange; label: string }> = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
];

export function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-white">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-sm ${
            opt.value === value
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          } ${opt.value === OPTIONS[0].value ? 'rounded-l-md' : ''} ${
            opt.value === OPTIONS[OPTIONS.length - 1].value ? 'rounded-r-md' : ''
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
