'use client';

// Slim create/edit form for TCP/UDP routes attached to a Stream. L4 routes have
// no hostname, path matches, filters or security: just a listener port, weighted
// Kubernetes Service backends and a protocol-gated BackendTrafficPolicy subset.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Input, Select, Checkbox } from '@/components/ui';
import { streamsApi, projectTeamsApi, projectNamespacesApi, kubernetesApi, domainTemplatesApi } from '@/lib/api';
import type { DomainTemplate, ProjectTeamRole, Stream, StreamRoute, K8sService, LoadBalancerType } from '@/types';
import {
  L4_LB_TYPES,
  buildCreateInput,
  buildUpdateInput,
  emptyPolicyForm,
  findPortCollision,
  parseListenerPort,
  policyCapabilities,
  rangeError,
  routeToFormState,
  type L4BackendForm,
  type L4PolicyForm,
  type L4Protocol,
} from '@/lib/utils/l4route';
import { streamListener } from '@/lib/utils/gateway-listeners';

interface Props {
  projectId: string;
  streamId: string;
  /** When set, the form edits this route; otherwise it creates one. */
  routeId?: string;
}

const emptyBackend = (): L4BackendForm => ({ namespace: '', service: '', port: '', weight: '100' });

export function L4RouteForm({ projectId, streamId, routeId }: Props) {
  const router = useRouter();
  const isEdit = Boolean(routeId);
  const streamUrl = `/projects/${projectId}/streams/${streamId}`;

  const [stream, setStream] = useState<Stream | null>(null);
  const [template, setTemplate] = useState<DomainTemplate | null>(null);
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

  const caps = policyCapabilities(protocol);
  const port = parseListenerPort(portInput);

  // Allowed listener-port range from the stream template's TCP/UDP listener.
  // Unknown (template fetch failed / no stream listener) => no client-side
  // range check; the server's 400 stays authoritative either way.
  const range = useMemo(() => {
    const sl = streamListener(template?.listeners ?? []);
    return sl && sl.portRangeMin != null && sl.portRangeMax != null
      ? { min: sl.portRangeMin, max: sl.portRangeMax }
      : null;
  }, [template]);

  // Live (client-side) collision check against the ports already on this stream.
  const collision = useMemo(
    () => findPortCollision(existingRoutes, port, protocol, routeId),
    [existingRoutes, port, protocol, routeId]
  );

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
        const [streamData, routesData, nsData, teamsData, routeData] = await Promise.all([
          streamsApi.get(projectId, streamId),
          streamsApi.listRoutes(projectId, streamId).catch(() => ({ data: [] as StreamRoute[] })),
          projectNamespacesApi.list(projectId).catch(() => []),
          projectTeamsApi.listMyTeams(projectId).catch(() => [] as ProjectTeamRole[]),
          routeId ? streamsApi.getRoute(projectId, streamId, routeId) : Promise.resolve(null),
        ]);
        setStream(streamData);
        // Best-effort: the template gives the allowed port range. On failure
        // fall back to the plain 1-65535 check and let the server decide.
        try {
          setTemplate(await domainTemplatesApi.get(projectId, streamData.gatewayTemplateId));
        } catch {
          setTemplate(null);
        }
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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!isEdit) {
      if (!name.trim()) errs.name = 'Name is required';
      if (!teamId) errs.team = 'Owner team is required';
    }
    if (port == null) errs.port = 'Listener port must be an integer between 1 and 65535';
    else if (range && rangeError(port, range.min, range.max)) errs.port = rangeError(port, range.min, range.max) as string;
    else if (collision) errs.port = `Port ${port}/${protocol.toUpperCase()} is already used by route "${collision.routeName}"`;
    if (backends.length === 0) errs.backends = 'At least one backend is required';
    backends.forEach((b, i) => {
      if (!b.namespace || !b.service) errs[`backend-${i}`] = 'Namespace and service are required';
      else if (!/^\d+$/.test(b.port) || Number(b.port) < 1 || Number(b.port) > 65535)
        errs[`backend-${i}`] = 'Backend port must be between 1 and 65535';
      else if (b.weight !== '' && (!/^\d+$/.test(b.weight) || Number(b.weight) > 100))
        errs[`backend-${i}`] = 'Weight must be between 0 and 100';
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setServerPortError(null);
    setWarnings([]);
    if (!validate() || port == null) return;

    setIsSubmitting(true);
    try {
      const values = { name: name.trim(), description, teamId, protocol, listenerPort: port, backends, policy };
      const result = isEdit
        ? await streamsApi.updateRoute(projectId, streamId, routeId as string, buildUpdateInput(values))
        : await streamsApi.createRoute(projectId, streamId, buildCreateInput(streamId, values));

      const returned = result?.warnings ?? [];
      if (returned.length > 0) {
        // Surface backend warnings (e.g. mixed-protocol LoadBalancer) before leaving.
        setWarnings(returned);
        setTimeout(() => router.push(streamUrl), 4000);
      } else {
        router.push(streamUrl);
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      const msg = err.response?.data?.error;
      if (err.response?.status === 409) {
        // Authoritative port-collision error from the backend.
        setServerPortError(msg || 'Listener port is already in use');
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

  if (loadError || !stream) {
    return (
      <div className="p-8">
        <Link href={streamUrl} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Stream
        </Link>
        <p className="text-red-700">{loadError || 'Stream not found'}</p>
      </div>
    );
  }

  const portError = serverPortError || formErrors.port;
  const portWarning = !portError && collision
    ? `Port ${collision.port}/${collision.protocol.toUpperCase()} is already used by route "${collision.routeName}"`
    : null;

  return (
    <div className="p-8 max-w-3xl">
      <Link href={streamUrl} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Stream
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">{isEdit ? `Edit Route: ${name}` : 'Add L4 Route'}</h1>
      <p className="text-gray-600 mt-1 mb-6">Stream: {stream.name}</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
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
                      onChange={() => setProtocol(p)}
                    />
                    {p.toUpperCase()}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <Input
                id="listenerPort"
                label="Listener Port"
                inputMode="numeric"
                placeholder="e.g., 5432"
                value={portInput}
                onChange={(e) => {
                  setPortInput(e.target.value);
                  setServerPortError(null);
                }}
                error={portError}
              />
              {portWarning && (
                <p role="alert" data-testid="port-collision" className="mt-1 text-sm text-amber-700">
                  {portWarning}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                The Gateway listener port this route is exposed on. A port can be used once per protocol.
                {range && <> Allowed range: {range.min}–{range.max}.</>}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Backends</h2>
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Advanced ({protocol.toUpperCase()} policy)</h2>
            {protocol === 'udp' && (
              <p className="text-sm text-gray-500" data-testid="udp-policy-note">
                UDP routes support load balancing only. Circuit breaker and health checks do not apply to datagrams.
              </p>
            )}

            {caps.loadBalancer && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Checkbox
                    aria-label="Enable load balancer"
                    checked={policy.lbEnabled}
                    onChange={(e) => patchPolicy({ lbEnabled: e.target.checked })}
                  />
                  Load balancing algorithm
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
              </div>
            )}

            {caps.circuitBreaker && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Checkbox
                    aria-label="Enable circuit breaker"
                    checked={policy.cbEnabled}
                    onChange={(e) => patchPolicy({ cbEnabled: e.target.checked })}
                  />
                  Circuit breaker
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
              </div>
            )}

            {caps.healthCheck && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
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
              </div>
            )}
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

        <div className="flex justify-end gap-3">
          <Link href={streamUrl}>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
          <Button type="submit" isLoading={isSubmitting} disabled={warnings.length > 0}>
            {isEdit ? 'Save Changes' : 'Create Route'}
          </Button>
        </div>
      </form>
    </div>
  );
}
