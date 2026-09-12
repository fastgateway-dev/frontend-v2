import React from 'react';

interface StatTileProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
}

export function StatTile({ label, value, tone = 'neutral' }: StatTileProps) {
  const toneClasses = {
    neutral: 'text-gray-900',
    success: 'text-green-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClasses}`}>{value}</div>
    </div>
  );
}
