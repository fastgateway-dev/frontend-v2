'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import type { ProjectTopologyResponse, TopologyIPRow } from '@/types/topology';
import { topologyApi } from '@/lib/api/topology';
import { ProjectDomainsGrid } from '@/components/topology/ProjectDomainsGrid';
import { ClientsByDomainMatrix } from '@/components/topology/ClientsByDomainMatrix';
import { IPAuditTab } from '@/components/topology/IPAuditTab';
import { SidePanel } from '@/components/topology/SidePanel';

export default function ProjectTopologyPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ProjectTopologyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<TopologyIPRow | null>(null);

  useEffect(() => {
    let active = true;
    topologyApi.getProjectTopology(params.projectId)
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [params.projectId]);

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-sm">Loading…</div>;

  return (
    <div className="p-4">
      <Tabs defaultValue="topology">
        <TabsList>
          <TabsTrigger value="topology">Topology</TabsTrigger>
          <TabsTrigger value="ips">IPs</TabsTrigger>
        </TabsList>
        <TabsContent value="topology">
          <div className="space-y-4">
            <ProjectDomainsGrid
              domains={data.domains}
              onSelectDomain={(id) => router.push(`/projects/${params.projectId}/domains/${id}/topology`)}
            />
            <ClientsByDomainMatrix
              domains={data.domains}
              clients={data.clients}
              onCellClick={({ clientId, domainId }) => router.push(`/projects/${params.projectId}/domains/${domainId}/topology?client=${clientId}`)}
            />
          </div>
        </TabsContent>
        <TabsContent value="ips">
          <IPAuditTab
            ips={data.ips}
            domains={data.domains.map((d) => ({ id: d.id, name: d.name }))}
            onRowClick={setSelection}
          />
        </TabsContent>
      </Tabs>
      <SidePanel open={!!selection} onClose={() => setSelection(null)} title="IP detail">
        {selection ? (
          <pre className="text-[10px]">{JSON.stringify(selection, null, 2)}</pre>
        ) : null}
      </SidePanel>
    </div>
  );
}
