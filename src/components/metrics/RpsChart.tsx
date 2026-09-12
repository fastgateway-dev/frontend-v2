'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { RpsByClass, MetricsPoint } from '@/types';

interface RpsChartProps {
  data: RpsByClass;
}

function mergePoints(data: RpsByClass): Array<Record<string, number>> {
  const byTs = new Map<number, Record<string, number>>();

  const add = (klass: string, points: MetricsPoint[] | undefined) => {
    if (!points) return;
    for (const p of points) {
      const ts = new Date(p.time).getTime();
      const row = byTs.get(ts) ?? { timestamp: ts };
      row[klass] = p.value;
      byTs.set(ts, row);
    }
  };

  add('2xx', data['2xx']);
  add('3xx', data['3xx']);
  add('4xx', data['4xx']);
  add('5xx', data['5xx']);

  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function RpsChart({ data }: RpsChartProps) {
  const merged = mergePoints(data);

  if (merged.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-gray-500">No data</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} />
          <YAxis />
          <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleString()} />
          <Legend />
          <Area type="monotone" dataKey="2xx" stackId="1" stroke="#10b981" fill="#10b98155" />
          <Area type="monotone" dataKey="3xx" stackId="1" stroke="#3b82f6" fill="#3b82f655" />
          <Area type="monotone" dataKey="4xx" stackId="1" stroke="#f59e0b" fill="#f59e0b55" />
          <Area type="monotone" dataKey="5xx" stackId="1" stroke="#ef4444" fill="#ef444455" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
