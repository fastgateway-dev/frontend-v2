'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { LatencyPercentiles, MetricsPoint } from '@/types';

interface LatencyChartProps {
  data: LatencyPercentiles;
}

function mergePoints(data: LatencyPercentiles): Array<Record<string, number>> {
  const byTs = new Map<number, Record<string, number>>();
  const add = (key: 'p50' | 'p95' | 'p99', points: MetricsPoint[] | undefined) => {
    if (!points) return;
    for (const p of points) {
      const ts = new Date(p.time).getTime();
      const row = byTs.get(ts) ?? { timestamp: ts };
      row[key] = p.value;
      byTs.set(ts, row);
    }
  };
  add('p50', data.p50);
  add('p95', data.p95);
  add('p99', data.p99);
  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function LatencyChart({ data }: LatencyChartProps) {
  const merged = mergePoints(data);

  if (merged.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-gray-500">No data</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} />
          <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
          <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleString()} />
          <Legend />
          <Line type="monotone" dataKey="p50" stroke="#3b82f6" dot={false} />
          <Line type="monotone" dataKey="p95" stroke="#f59e0b" dot={false} />
          <Line type="monotone" dataKey="p99" stroke="#ef4444" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
