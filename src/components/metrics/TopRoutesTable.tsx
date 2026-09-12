'use client';

import React from 'react';
import Link from 'next/link';
import type { TopRouteEntry } from '@/types';

interface TopRoutesTableProps {
  title: string;
  entries: TopRouteEntry[];
  projectId: string;
  domainId: string;
  valueLabel: string;
  valueFormatter?: (v: number) => string;
}

export function TopRoutesTable({
  title,
  entries,
  projectId,
  domainId,
  valueLabel,
  valueFormatter = (v) => v.toFixed(1),
}: TopRoutesTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-3 text-sm font-medium text-gray-700">
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No data</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500">
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2 text-right">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.routeId} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <Link
                    href={`/projects/${projectId}/domains/${domainId}/routes/${e.routeId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {e.routeName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{valueFormatter(e.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
