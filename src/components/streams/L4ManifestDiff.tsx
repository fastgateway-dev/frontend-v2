'use client';

// Route + BackendTrafficPolicy manifests of an L4 route as YamlDiffViewer sections.
// Each section picks create/update/delete from which side is present, and is
// hidden when neither side has YAML. Used by the form Preview tab and the delete modal.

import { YamlDiffViewer } from '@/components/features/yaml-diff-viewer';
import { diffMode, type DiffMode } from '@/lib/utils/l4route';

export interface L4ManifestPair {
  route?: string;
  btp?: string;
}

interface Props {
  /** "TCPRoute" | "UDPRoute" (l4RouteKind). */
  routeKind: string;
  current?: L4ManifestPair;
  proposed?: L4ManifestPair;
}

export function L4ManifestDiff({ routeKind, current, proposed }: Props) {
  const sections = [
    { key: 'route', title: routeKind, cur: current?.route, prop: proposed?.route },
    { key: 'btp', title: 'BackendTrafficPolicy', cur: current?.btp, prop: proposed?.btp },
  ];
  const visible: Array<{ key: string; title: string; cur?: string; prop?: string; mode: DiffMode }> = [];
  for (const s of sections) {
    const mode = diffMode(s.cur, s.prop);
    if (mode) visible.push({ ...s, mode });
  }

  if (visible.length === 0) return <p className="text-sm text-gray-500">No manifests to show.</p>;

  return (
    <div className="space-y-6">
      {visible.map((s) => (
        <section key={s.key} data-testid={`manifest-diff-${s.key}`}>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">{s.title}</h3>
          <YamlDiffViewer currentYaml={s.cur} proposedYaml={s.prop || ''} mode={s.mode} />
        </section>
      ))}
    </div>
  );
}
