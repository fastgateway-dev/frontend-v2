'use client';

// Create/edit form for TCP/UDP routes attached to a Stream, in the same tabs as
// the domain route form: Basic Info · Backends · Traffic Policy · Preview.
// L4 routes have no hostname, path matches, filters or security: just a listener
// port, weighted Kubernetes Service backends and a protocol-gated
// BackendTrafficPolicy subset. Fields and validation rules are unchanged; the
// Preview tab shows the server's manifest preview, and the server's 400/409
// stays authoritative.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { streamsApi, projectTeamsApi, projectNamespacesApi, kubernetesApi, permissionsApi } from '@/lib/api';
import type { ProjectPermissions, ProjectTeamRole, Stream, StreamRoute, K8sService, LoadBalancerType } from '@/types';
import { L4ManifestDiff, type L4ManifestPair } from './L4ManifestDiff';
import {
  L4_FORM_TABS,
  L4_LB_TYPES,
  buildCreateInput,
  buildUpdateInput,
  emptyPolicyForm,
  errorsForTab,
  l4RouteKind,
  mergeTabErrors,
  parseListenerPort,
  policyCapabilities,
  routeToFormState,
  tabErrors,
  validateL4Form,
  type L4BackendForm,
  type L4FormTab,
  type L4PolicyForm,
  type L4Protocol,
} from '@/lib/utils/l4route';
import { freeClaims, portLabel } from '@/lib/utils/stream-entrypoint';

interface Props {
  projectId: string;
  streamId: string;
  /** When set, the form edits this route; otherwise it creates one. */
  routeId?: string;
}

const TAB_LABELS: Record<L4FormTab, string> = {
  basic: 'Basic Info',
  backends: 'Backends',
  policy: 'Traffic Policy',
  preview: 'Preview',
};

const emptyBackend = (): L4BackendForm => ({ namespace: '', service: '', port: '', weight: '100' });

export function L4RouteForm({ projectId, streamId, routeId }: Props) {
  const router = useRouter();
  const isEdit = Boolean(routeId);
  const streamUrl = `/projects/${projectId}/streams/${streamId}`;
  // Edit returns to the L4 route detail page; create returns to the stream.
  const doneUrl = routeId ? `${streamUrl}/routes/${routeId}` : streamUrl;

  const [stream, setStream] = useState<Stream | null>(null);
  const [permissions, setPermissions] = useState<ProjectPermissions | null>(null);
  const [teams, setTeams] = useState<ProjectTeamRole[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [existingRoutes, setExistingRoutes] = useState<StreamRoute[]>([]);
  const [servicesByNs, setServicesByNs] = useState<Record<string, K8sService[]>>({});
  const requestedNs = useRef<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [protocol, setProtocol] = useState<L4Protocol>('tcp');
  const [portInput, setPortInput] = useState('');
  const [backends, setBackends] = useState<L4BackendForm[]>([emptyBackend()]);
  const [policy, setPolicy] = useState<L4PolicyForm>(emptyPolicyForm());

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverPortError, setServerPortError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<L4FormTab>('basic');
  const [preview, setPreview] = useState<{ current?: L4ManifestPair; proposed: L4ManifestPair } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  // Only the latest preview request may write state; a slow earlier one is dropped.
  const previewSeq = useRef(0);

  const caps = policyCapabilities(protocol);
  const transport = protocol === 'udp' ? 'UDP' : 'TCP';

  // The stream's claimed ports on this protocol that no other route uses. The
  // route being edited doesn't hold its own port, so it stays selectable.
  const freePorts = useMemo(
    () => freeClaims(stream?.ports ?? [], existingRoutes, transport, routeId),
    [stream, existingRoutes, transport, routeId]
  );
  // Only a free claim counts as a selection; anything else (a stale value, a
  // legacy route port that isn't claimed) must be re-picked.
  const parsedPort = parseListenerPort(portInput);
  const port = parsedPort != null && freePorts.includes(parsedPort) ? parsedPort : null;

  const ensureServices = async (ns: string) => {
    if (!ns || requestedNs.current.has(ns)) return;
    requestedNs.current.add(ns);
    try {
      const list = await kubernetesApi.listServices(projectId, ns);
      setServicesByNs((prev) => ({ ...prev, [ns]: list || [] }));
    } catch {
      setServicesByNs((prev) => ({ ...prev, [ns]: [] }));
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [streamData, routesData, nsData, teamsData, routeData, permsData] = await Promise.all([
          streamsApi.get(projectId, streamId),
          streamsApi.listRoutes(projectId, streamId).catch(() => ({ data: [] as StreamRoute[] })),
          projectNamespacesApi.list(projectId).catch(() => []),
          projectTeamsApi.listMyTeams(projectId).catch(() => [] as ProjectTeamRole[]),
          routeId ? streamsApi.getRoute(projectId, streamId, routeId) : Promise.resolve(null),
          // Best-effort: only decides whether "Claim another port" is a link.
          permissionsApi.getProjectPermissions(projectId).catch(() => null),
        ]);
        setStream(streamData);
        setPermissions(permsData);
        setExistingRoutes(routesData.data || []);
        const nsNames = (nsData || []).filter((n) => n.referenceGrantCreated).map((n) => n.namespace);
        setNamespaces(nsNames);
        setTeams(teamsData || []);

        if (routeData) {
          const s = routeToFormState(routeData);
          setName(routeData.name);
          setDescription(routeData.description || '');
          setTeamId(routeData.teamId);
          setProtocol(routeData.protocol === 'udp' ? 'udp' : 'tcp');
          setPortInput(s.listenerPort);
          setBackends(s.backends.length > 0 ? s.backends : [emptyBackend()]);
          setPolicy(s.policy);
          s.backends.forEach((b) => ensureServices(b.namespace));
        } else {
          if (teamsData && teamsData.length > 0) setTeamId(teamsData[0].team.id);
          if (nsNames.length > 0) {
            setBackends([{ ...emptyBackend(), namespace: nsNames[0] }]);
            ensureServices(nsNames[0]);
          }
        }
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        setLoadError(err.response?.data?.error || 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, streamId, routeId]);

  const updateBackend = (i: number, patch: Partial<L4BackendForm>) =>
    setBackends((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  // A selection the new protocol doesn't offer is dropped, not carried over.
  const onProtocolChange = (p: L4Protocol) => {
    setProtocol(p);
    const t = p === 'udp' ? 'UDP' : 'TCP';
    const free = freeClaims(stream?.ports ?? [], existingRoutes, t, routeId);
    if (parsedPort == null || !free.includes(parsedPort)) setPortInput('');
  };

  const onNamespaceChange = (i: number, ns: string) => {
    updateBackend(i, { namespace: ns, service: '', port: '' });
    ensureServices(ns);
  };

  const onServiceChange = (i: number, svcName: string) => {
    const b = backends[i];
    const svc = (servicesByNs[b.namespace] || []).find((s) => s.name === svcName);
    updateBackend(i, { service: svcName, port: svc?.ports?.[0] ? String(svc.ports[0].port) : b.port });
  };

  const patchPolicy = (patch: Partial<L4PolicyForm>) => setPolicy((p) => ({ ...p, ...patch }));

  const validateAll = () => validateL4Form({ isEdit, name, teamId, protocol, port, backends });

  const formValues = (listenerPort: number) => ({
    name: name.trim(),
    description,
    teamId,
    protocol,
    listenerPort,
    backends,
    policy,
  });

  const goNext = () => {
    const idx = L4_FORM_TABS.indexOf(activeTab);
    if (idx >= L4_FORM_TABS.length - 1) return;
    // Like the domain route form, Next checks only the tab being left.
    const current = errorsForTab(validateAll(), activeTab);
    setFormErrors((prev) => mergeTabErrors(prev, activeTab, current));
    if (Object.keys(current).length === 0) setActiveTab(L4_FORM_TABS[idx + 1]);
  };

  const goBack = () => {
    const idx = L4_FORM_TABS.indexOf(activeTab);
    if (idx > 0) setActiveTab(L4_FORM_TABS[idx - 1]);
  };

  const loadPreview = async () => {
    const seq = ++previewSeq.current;
    setPreview(null);
    setPreviewError(null);
    if (port == null) {
      setIsPreviewLoading(false);
      setPreviewError('Select a listener port on Basic Info to preview the manifests.');
      return;
    }
    setIsPreviewLoading(true);
    try {
      if (isEdit) {
        const r = await streamsApi.previewUpdateRoute(projectId, streamId, routeId as string, buildUpdateInput(formValues(port)));
        if (seq !== previewSeq.current) return;
        setPreview({
          current: { route: r.currentYaml, btp: r.currentBackendTrafficPolicyYaml },
          proposed: { route: r.proposedYaml, btp: r.proposedBackendTrafficPolicyYaml },
        });
      } else {
        const r = await streamsApi.previewCreateRoute(projectId, streamId, buildCreateInput(streamId, formValues(port)));
        if (seq !== previewSeq.current) return;
        setPreview({ proposed: { route: r.proposedYaml, btp: r.proposedBackendTrafficPolicyYaml } });
      }
    } catch (error: unknown) {
      if (seq !== previewSeq.current) return;
      const err = error as { response?: { data?: { error?: string } } };
      // The same 400/409 a submit would get, shown inline on the Preview tab.
      setPreviewError(err.response?.data?.error || 'Failed to generate preview');
    } finally {
      if (seq === previewSeq.current) setIsPreviewLoading(false);
    }
  };

  // Re-run the preview every time the Preview tab opens, with the current values.
  useEffect(() => {
    if (activeTab === 'preview') loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setServerPortError(null);
    setWarnings([]);
    const errs = validateAll();
    setFormErrors(errs);
    const badTabs = tabErrors(errs);
    if (badTabs.length > 0 || port == null) {
      // Take the user to the first tab that needs fixing.
      if (badTabs.length > 0) setActiveTab(badTabs[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const values = formValues(port);
      const result = isEdit
        ? await streamsApi.updateRoute(projectId, streamId, routeId as string, buildUpdateInput(values))
        : await streamsApi.createRoute(projectId, streamId, buildCreateInput(streamId, values));

      const returned = result?.warnings ?? [];
      if (returned.length > 0) {
        // Surface backend warnings (e.g. mixed-protocol LoadBalancer) before leaving.
        setWarnings(returned);
        setTimeout(() => router.push(doneUrl), 4000);
      } else {
        router.push(doneUrl);
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      const msg = err.response?.data?.error;
      const status = err.response?.status;
      if (status === 409 || (status === 400 && /not claimed by the stream/i.test(msg ?? ''))) {
        // Authoritative port error from the backend (in use by another route /
        // not claimed by the stream), shown on the port field.
        setServerPortError(msg || 'Listener port is not available');
        setActiveTab('basic');
      } else {
        setSubmitError(msg || `Failed to ${isEdit ? 'update' : 'create'} route`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const backLabel = isEdit ? 'Back to Route' : 'Back to Stream';

  if (loadError || !stream) {
    return (
      <div className="p-8">
        <Link href={doneUrl} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <p className="text-red-700">{loadError || 'Stream not found'}</p>
      </div>
    );
  }

  const portError = serverPortError || formErrors.port;
  // A legacy stream with no claims at all reads differently from one whose claims are all taken.
  const noClaims = (stream.ports ?? []).length === 0;
  const claimLabel = noClaims ? 'Claim a port on the stream.' : 'Claim another port on the stream.';
  const errorTabs = tabErrors({ ...formErrors, port: portError });

  return (
    <div className="p-8 max-w-3xl">
      <Link href={doneUrl} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">{isEdit ? `Edit Route: ${name}` : 'Add L4 Route'}</h1>
      <p className="text-gray-600 mt-1 mb-6">Stream: {stream.name}</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as L4FormTab)} defaultValue="basic">
              <TabsList className="mb-2">
                {L4_FORM_TABS.map((t) => (
                  <TabsTrigger key={t} value={t}>
                    {TAB_LABELS[t]}
                    {errorTabs.includes(t) && (
                      <span data-testid={`tab-error-${t}`} className="ml-1 text-red-500">
                        *
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="basic">
                <div className="space-y-4">
                  <Input
                    id="name"
                    label="Name"
                    placeholder="e.g., postgres"
                    value={name}
                    disabled={isEdit}
                    onChange={(e) => setName(e.target.value)}
                    error={formErrors.name}
                  />
                  <Input
                    id="description"
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  {!isEdit && (
                    <Select
                      id="teamId"
                      label="Owner Team"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                      options={teams.map((t) => ({ value: t.team.id, label: t.team.name }))}
                      error={formErrors.team}
                    />
                  )}

                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-700 mb-1">Protocol</legend>
                    <div className="flex gap-6">
                      {(['tcp', 'udp'] as const).map((p) => (
                        <label key={p} className="flex items-center gap-2 text-sm text-gray-900">
                          <input
                            type="radio"
                            name="protocol"
                            value={p}
                            checked={protocol === p}
                            disabled={isEdit}
                            onChange={() => onProtocolChange(p)}
                          />
                          {p.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <Select
                      id="listenerPort"
                      label="Listener Port"
                      value={port != null ? String(port) : ''}
                      disabled={freePorts.length === 0}
                      onChange={(e) => {
                        setPortInput(e.target.value);
                        setServerPortError(null);
                      }}
                      options={[
                        { value: '', label: 'Select...' },
                        ...freePorts.map((p) => ({ value: String(p), label: portLabel({ transport, port: p }) })),
                      ]}
                      error={portError}
                    />
                    {freePorts.length === 0 ? (
                      <p data-testid="no-free-ports" className="mt-1 text-sm text-amber-700">
                        {noClaims
                          ? 'This stream has no ports claimed. '
                          : `All of this stream's ${transport} ports are in use. `}
                        {permissions?.canManageDomains ? (
                          <Link href={streamUrl} className="underline">
                            {claimLabel}
                          </Link>
                        ) : (
                          claimLabel
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">
                        The Gateway listener port this route is exposed on: one of the ports this stream has claimed
                        that no other route uses.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="backends">
                <div className="space-y-4">
                  {namespaces.length === 0 && (
                    <p className="text-sm text-amber-700">
                      No project namespaces with a ReferenceGrant are available. Add one under Namespaces first.
                    </p>
                  )}
                  {backends.map((b, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2" data-testid="backend-row">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <Select
                          id={`backend-ns-${i}`}
                          label="Namespace"
                          value={b.namespace}
                          onChange={(e) => onNamespaceChange(i, e.target.value)}
                          options={[{ value: '', label: 'Select...' }, ...namespaces.map((n) => ({ value: n, label: n }))]}
                        />
                        <Select
                          id={`backend-svc-${i}`}
                          label="Service"
                          value={b.service}
                          onChange={(e) => onServiceChange(i, e.target.value)}
                          options={[
                            { value: '', label: 'Select...' },
                            ...(servicesByNs[b.namespace] || []).map((s) => ({ value: s.name, label: s.name })),
                          ]}
                        />
                        <Input
                          id={`backend-port-${i}`}
                          label="Port"
                          inputMode="numeric"
                          value={b.port}
                          onChange={(e) => updateBackend(i, { port: e.target.value })}
                        />
                        <Input
                          id={`backend-weight-${i}`}
                          label="Weight"
                          inputMode="numeric"
                          value={b.weight}
                          onChange={(e) => updateBackend(i, { weight: e.target.value })}
                        />
                      </div>
                      {formErrors[`backend-${i}`] && <p className="text-sm text-red-600">{formErrors[`backend-${i}`]}</p>}
                      {backends.length > 1 && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setBackends((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  {formErrors.backends && <p className="text-sm text-red-600">{formErrors.backends}</p>}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBackends((prev) => [...prev, { ...emptyBackend(), namespace: namespaces[0] ?? '' }])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add backend
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="policy">
                <div className="space-y-6">
                  {protocol === 'udp' && (
                    <p className="text-sm text-gray-500" data-testid="udp-policy-note">
                      UDP routes support load balancing only. Circuit breaker and health checks do not apply to datagrams.
                    </p>
                  )}

                  {caps.loadBalancer && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900">Load balancing</h3>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <Checkbox
                          aria-label="Enable load balancer"
                          checked={policy.lbEnabled}
                          onChange={(e) => patchPolicy({ lbEnabled: e.target.checked })}
                        />
                        Set a load balancing algorithm
                      </label>
                      {policy.lbEnabled && (
                        <Select
                          id="lbType"
                          aria-label="Load balancer type"
                          value={policy.lbType}
                          onChange={(e) => patchPolicy({ lbType: e.target.value as LoadBalancerType })}
                          options={L4_LB_TYPES.map((t) => ({ value: t, label: t }))}
                        />
                      )}
                    </section>
                  )}

                  {caps.circuitBreaker && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900">Circuit breaker</h3>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <Checkbox
                          aria-label="Enable circuit breaker"
                          checked={policy.cbEnabled}
                          onChange={(e) => patchPolicy({ cbEnabled: e.target.checked })}
                        />
                        Limit connections
                      </label>
                      {policy.cbEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            id="cbMaxConnections"
                            label="Max connections"
                            inputMode="numeric"
                            value={policy.cbMaxConnections}
                            onChange={(e) => patchPolicy({ cbMaxConnections: e.target.value })}
                          />
                          <Input
                            id="cbMaxRequestsPerConnection"
                            label="Max requests per connection"
                            inputMode="numeric"
                            value={policy.cbMaxRequestsPerConnection}
                            onChange={(e) => patchPolicy({ cbMaxRequestsPerConnection: e.target.value })}
                          />
                        </div>
                      )}
                    </section>
                  )}

                  {caps.healthCheck && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-900">Health check</h3>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <Checkbox
                          aria-label="Enable health check"
                          checked={policy.hcEnabled}
                          onChange={(e) => patchPolicy({ hcEnabled: e.target.checked })}
                        />
                        Active TCP health check
                      </label>
                      {policy.hcEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            id="hcInterval"
                            label="Interval"
                            placeholder="e.g., 10s"
                            value={policy.hcInterval}
                            onChange={(e) => patchPolicy({ hcInterval: e.target.value })}
                          />
                          <Input
                            id="hcTimeout"
                            label="Timeout"
                            placeholder="e.g., 1s"
                            value={policy.hcTimeout}
                            onChange={(e) => patchPolicy({ hcTimeout: e.target.value })}
                          />
                          <Input
                            id="hcUnhealthy"
                            label="Unhealthy threshold"
                            inputMode="numeric"
                            value={policy.hcUnhealthyThreshold}
                            onChange={(e) => patchPolicy({ hcUnhealthyThreshold: e.target.value })}
                          />
                          <Input
                            id="hcHealthy"
                            label="Healthy threshold"
                            inputMode="numeric"
                            value={policy.hcHealthyThreshold}
                            onChange={(e) => patchPolicy({ hcHealthyThreshold: e.target.value })}
                          />
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="preview">
                {isPreviewLoading ? (
                  <p className="text-sm text-gray-500">Generating preview…</p>
                ) : previewError ? (
                  <div
                    role="alert"
                    data-testid="preview-error"
                    className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
                  >
                    {previewError}
                  </div>
                ) : preview ? (
                  <L4ManifestDiff routeKind={l4RouteKind(protocol)} current={preview.current} proposed={preview.proposed} />
                ) : null}
              </TabsContent>
            </Tabs>

            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <div>
                {activeTab !== 'basic' && (
                  <Button type="button" variant="secondary" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Link href={doneUrl}>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </Link>
                {/* Distinct keys: React must replace (not retype) the button, or the click
                    that opens Preview would submit the form once it becomes type=submit. */}
                {activeTab !== 'preview' ? (
                  <Button key="next" type="button" onClick={goNext}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button key="submit" type="submit" isLoading={isSubmitting} disabled={warnings.length > 0}>
                    {isEdit ? 'Save Changes' : 'Create Route'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {warnings.length > 0 && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200" data-testid="submit-warnings">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Route {isEdit ? 'updated' : 'created'} with warnings</h4>
                <ul className="mt-1 text-sm text-amber-700 list-disc pl-4">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {submitError && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Failed to {isEdit ? 'update' : 'create'} route</h4>
                <p className="mt-1 text-sm text-red-700">{submitError}</p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
