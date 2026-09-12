// frontend/src/components/topology/ClientRouteMatrix.tsx
import type { DomainTopologyResponse } from '@/types/topology';
import { StatusBadge } from './StatusBadge';

interface Props {
  data: DomainTopologyResponse;
  onCellClick: (sel: { clientId?: string; routeId: string; feature?: keyof typeof FEATURE_LABELS }) => void;
}

const FEATURE_LABELS = {
  ipAllowlist: 'IP', mtls: 'mTLS', apiKey: 'API key', jwt: 'JWT',
  oidc: 'OIDC', rateLimit: 'RL', waf: 'WAF',
} as const;

export function ClientRouteMatrix({ data, onCellClick }: Props) {
  if (data.domain.securityMode === 'general') {
    const cols = Object.entries(FEATURE_LABELS) as Array<[keyof typeof FEATURE_LABELS, string]>;
    return (
      <table className="w-full text-xs border">
        <thead className="sticky top-0 bg-background">
          <tr><th className="text-left px-2 py-1">Route</th>{cols.map(([k, l]) => <th key={k} className="px-2 py-1">{l}</th>)}</tr>
        </thead>
        <tbody>
          {data.routes.map((r) => (
            <tr key={r.id}>
              <td className="px-2 py-1 truncate sticky left-0 bg-background">{r.name}</td>
              {cols.map(([k]) => (
                <td
                  key={k}
                  data-testid={`cell-${r.id}-${k}`}
                  className="px-2 py-1 text-center cursor-pointer hover:bg-muted"
                  onClick={() => onCellClick({ routeId: r.id, feature: k })}
                >
                  {(r.routeLevelSecurity as any)[k] ? '●' : '–'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full text-xs border">
      <thead className="sticky top-0 bg-background">
        <tr>
          <th className="text-left px-2 py-1 sticky left-0 bg-background">Client</th>
          {data.routes.map((r) => <th key={r.id} className="px-2 py-1">{r.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.clients.map((c) => (
          <tr key={c.id}>
            <td className="px-2 py-1 sticky left-0 bg-background truncate">{c.name}</td>
            {data.routes.map((r) => {
              const a = data.attachments.find((x) => x.clientId === c.id && x.routeId === r.id);
              return (
                <td
                  key={r.id}
                  data-testid={`cell-${c.id}-${r.id}`}
                  className="px-2 py-1 text-center cursor-pointer hover:bg-muted"
                  onClick={() => onCellClick({ clientId: c.id, routeId: r.id })}
                >
                  {a ? <StatusBadge status={a.status} /> : '–'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
