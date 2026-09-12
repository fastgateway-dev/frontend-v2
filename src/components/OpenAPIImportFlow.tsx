'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Upload,
  AlertTriangle,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { openapiImportApi } from '@/lib/api/openapiImport';
import { routesApi } from '@/lib/api/routes';
import { kubernetesApi } from '@/lib/api/kubernetes';
import { projectNamespacesApi } from '@/lib/api/projectNamespaces';
import {
  subscribeToImportEvents,
  type RouteCreatedFromPrefillMessage,
} from '@/lib/utils/importBroadcast';
import type {
  DefaultBackend,
  OpenAPIImportResponse,
  ParsedRoute,
  ImportWarning,
  Rename,
  RouteEdit,
  RouteBackend,
  CreateRouteInput,
  RoutePrefillData,
  ConflictResult,
  K8sNamespace,
  K8sService,
} from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OpenAPIImportFlowProps {
  projectId: string;
  domainId: string;
  teamId: string;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NAME_REGEX = /^[a-z]([a-z0-9-]*[a-z0-9])?$/;

function isValidName(name: string): boolean {
  return NAME_REGEX.test(name) && name.length > 0;
}

function isBackendValid(kind: 'kubernetes' | 'external', backend: DefaultBackend): boolean {
  if (!backend.port || backend.port <= 0) return false;
  if (kind === 'kubernetes') return !!(backend.service && backend.namespace);
  return !!backend.address;
}

function backendSummary(route: ParsedRoute): string {
  const b = route.config.backends?.[0];
  if (!b) return '(no backend)';
  if (b.type === 'kubernetes') return `${b.service}.${b.namespace}:${b.port}`;
  return `${b.address}:${b.port}`;
}

// ---------------------------------------------------------------------------
// RouteCard
// ---------------------------------------------------------------------------

interface RouteCardProps {
  index: number;
  route: ParsedRoute;
  name: string;
  onNameChange: (idx: number, name: string) => void;
  selected: boolean;
  onToggleSelect: (idx: number) => void;
  conflicts: ConflictResult[];
  importResult?: { success: boolean; error?: string };
  isImporting: boolean;
  edit: RouteEdit;
  onEditChange: (idx: number, patch: Partial<RouteEdit>) => void;
  expanded: boolean;
  onToggleExpanded: (idx: number) => void;
  rename?: Rename;
  projectId: string;
  domainId: string;
  teamId: string;
  namespaces: K8sNamespace[];
  servicesByNs: Record<string, K8sService[]>;
  loadServicesForNs: (ns: string) => Promise<K8sService[]>;
  onMarkEditKey: (index: number, key: string) => void;
  submittedInfo?: { routeId: string; routeName: string };
}

function RouteCard({
  index,
  route,
  name,
  onNameChange,
  selected,
  onToggleSelect,
  conflicts,
  importResult,
  isImporting,
  edit,
  onEditChange,
  expanded,
  onToggleExpanded,
  rename,
  projectId,
  domainId,
  teamId,
  namespaces,
  servicesByNs,
  loadServicesForNs,
  onMarkEditKey,
  submittedInfo,
}: RouteCardProps) {
  const nameValid = isValidName(name);
  const hasConflict = conflicts && conflicts.length > 0;

  // Derive current backend values from route + edit override
  const originalBackend = route.config.backends?.[0];
  const editBackend = edit.backend;

  // Derive backend kind from current state — never store separately, or it can
  // desync from edit.backend (e.g. after the parent resets routeEdits on re-parse).
  const editBackendKind: 'kubernetes' | 'external' = editBackend
    ? editBackend.service
      ? 'kubernetes'
      : 'external'
    : originalBackend?.type === 'external'
      ? 'external'
      : 'kubernetes';

  // Current matcher from original config or edit override
  const originalMatcher = route.config.matches?.[0]?.path;
  const currentMatcherType = edit.matcher?.type ?? originalMatcher?.type ?? 'Prefix';
  const currentMatcherValue = edit.matcher?.value ?? originalMatcher?.value ?? '/';

  // Current effective backend values (edit override → original)
  const currentService =
    editBackend?.service ?? originalBackend?.service ?? '';
  const currentNamespace =
    editBackend?.namespace ?? originalBackend?.namespace ?? '';
  const currentPort =
    editBackend?.port ?? originalBackend?.port ?? 8080;

  // Lazily load services for whichever namespace is currently selected for
  // this card (in the kubernetes branch). Only kick off when the panel is
  // expanded so we don't make N requests for N collapsed cards.
  useEffect(() => {
    if (expanded && editBackendKind === 'kubernetes' && currentNamespace) {
      loadServicesForNs(currentNamespace);
    }
  }, [expanded, editBackendKind, currentNamespace, loadServicesForNs]);

  const cardServices = servicesByNs[currentNamespace] ?? [];
  const selectedService = cardServices.find((s) => s.name === currentService);

  // Current backend display
  const displayBackend = editBackend
    ? editBackend.service
      ? `${editBackend.service}.${editBackend.namespace ?? ''}:${editBackend.port}`
      : `${editBackend.address}:${editBackend.port}`
    : backendSummary(route);

  // HTTP method from matches
  const method =
    route.config.matches?.[0]?.method ?? 'ANY';

  const handleEditInCreatePage = () => {
    // Build config with any edits applied
    const config = applyEditsToConfig(route, edit);
    const prefill: RoutePrefillData = {
      name,
      description: edit.description ?? route.description,
      protocol: route.protocol,
      securityMode: route.securityMode,
      teamId,
      config,
    };
    const key = `openapi-prefill-${crypto.randomUUID()}`;
    try {
      sessionStorage.setItem(key, JSON.stringify(prefill));
    } catch {
      alert('Failed to store route data. Please use Import Selected instead.');
      return;
    }
    onMarkEditKey(index, key);
    const url = `/projects/${projectId}/domains/${domainId}/routes/create?prefill=${key}`;
    window.open(url, '_blank');
  };

  const isSubmitted = submittedInfo !== undefined;

  return (
    <Card
      className={`${selected ? 'border-primary-500' : ''} ${isSubmitted ? 'opacity-60' : ''}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSubmitted ? false : selected}
            onChange={() => onToggleSelect(index)}
            className="h-4 w-4 mt-1"
            disabled={isSubmitted || isImporting || hasConflict || !nameValid}
          />
          <div className="flex-1 min-w-0">
            {/* Method + path + rename badge */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge variant="default">{method}</Badge>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">
                {currentMatcherValue}
              </span>
              {rename && (
                <Badge variant="info">
                  renamed from &quot;{rename.original}&quot; ({rename.reason})
                </Badge>
              )}
            </div>

            {/* Editable name */}
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(index, e.target.value.toLowerCase())}
              className={`w-full text-sm font-medium px-2 py-1 border rounded mb-0.5 ${
                !nameValid && name.length > 0
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
              placeholder="route-name"
              disabled={isImporting}
            />
            {!nameValid && name.length > 0 && (
              <p className="text-xs text-red-500 mb-0.5">
                Must be lowercase DNS name (a-z, 0-9, hyphens)
              </p>
            )}

            {/* Backend summary */}
            <div className="text-xs text-gray-500 mt-1">→ {displayBackend}</div>

            {/* Conflict badge */}
            {hasConflict && (
              <div className="mt-1.5">
                <Badge variant="warning">
                  Conflicts with &quot;{conflicts[0].routeName}&quot;
                  {conflicts.length > 1 && ` +${conflicts.length - 1} more`}
                </Badge>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div
                className={`mt-2 flex items-center gap-1.5 text-xs ${
                  importResult.success ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {importResult.success ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Imported successfully</span>
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" />
                    <span>Failed: {importResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isSubmitted ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="rounded bg-green-100 text-green-800 px-2 py-0.5 text-xs"
                  title={`Submitted as ${submittedInfo!.routeName}`}
                >
                  Submitted
                </span>
                <a
                  href={`/projects/${projectId}/domains/${domainId}/routes/${submittedInfo!.routeId}`}
                  className="text-xs text-indigo-600 hover:underline"
                  title={submittedInfo!.routeName}
                >
                  View route
                </a>
              </span>
            ) : (
              <button
                onClick={handleEditInCreatePage}
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                title="Edit in Create Page"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={() => onToggleExpanded(index)}
              className="text-gray-400 hover:text-gray-600"
              title={expanded ? 'Hide edit panel' : 'Show edit panel'}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Inline edit panel */}
        {expanded && (
          <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-3 space-y-4">
            {/* 1. Path matcher */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                Path Matcher
              </p>
              <div className="flex gap-2">
                <select
                  value={currentMatcherType}
                  onChange={(e) =>
                    onEditChange(index, {
                      matcher: {
                        type: e.target.value as 'Exact' | 'Prefix' | 'RegularExpression',
                        value: currentMatcherValue,
                      },
                    })
                  }
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                  disabled={isImporting}
                >
                  <option value="Exact">Exact</option>
                  <option value="Prefix">Prefix</option>
                  <option value="RegularExpression">RegularExpression</option>
                </select>
                <input
                  type="text"
                  value={currentMatcherValue}
                  onChange={(e) =>
                    onEditChange(index, {
                      matcher: { type: currentMatcherType, value: e.target.value },
                    })
                  }
                  className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 font-mono"
                  placeholder="/path"
                  disabled={isImporting}
                />
              </div>
            </div>

            {/* 2. Backend override */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                Backend Override
              </p>
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`backend-kind-${index}`}
                    value="kubernetes"
                    checked={editBackendKind === 'kubernetes'}
                    onChange={() => {
                      // Switch to kubernetes: clear external-only fields
                      onEditChange(index, {
                        backend: {
                          service: editBackend?.service ?? originalBackend?.service ?? '',
                          namespace: editBackend?.namespace ?? originalBackend?.namespace ?? '',
                          address: undefined,
                          port:
                            editBackend?.port ?? originalBackend?.port ?? 8080,
                        },
                      });
                    }}
                    disabled={isImporting}
                  />
                  Kubernetes Service
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`backend-kind-${index}`}
                    value="external"
                    checked={editBackendKind === 'external'}
                    onChange={() => {
                      // Switch to external: clear kubernetes-only fields
                      onEditChange(index, {
                        backend: {
                          service: undefined,
                          namespace: undefined,
                          address: editBackend?.address ?? originalBackend?.address ?? '',
                          port:
                            editBackend?.port ?? originalBackend?.port ?? 8080,
                        },
                      });
                    }}
                    disabled={isImporting}
                  />
                  External address
                </label>
              </div>

              {editBackendKind === 'kubernetes' && (
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">Namespace</label>
                    <select
                      value={currentNamespace}
                      onChange={(e) =>
                        onEditChange(index, {
                          backend: {
                            service: undefined,
                            namespace: e.target.value || undefined,
                            address: undefined,
                            port: currentPort,
                          },
                        })
                      }
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                      disabled={isImporting}
                    >
                      <option value="">Select…</option>
                      {namespaces.map((ns) => (
                        <option key={ns.name} value={ns.name}>
                          {ns.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-5">
                    <label className="block text-xs text-gray-500 mb-1">Service</label>
                    <select
                      value={currentService}
                      onChange={(e) =>
                        onEditChange(index, {
                          backend: {
                            service: e.target.value || undefined,
                            namespace: currentNamespace || undefined,
                            address: undefined,
                            port: currentPort,
                          },
                        })
                      }
                      disabled={isImporting || !currentNamespace}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 disabled:opacity-50"
                    >
                      <option value="">Select…</option>
                      {cardServices.map((svc) => (
                        <option key={svc.name} value={svc.name}>
                          {svc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Port</label>
                    {selectedService && selectedService.ports.length > 0 ? (
                      <select
                        value={currentPort}
                        onChange={(e) =>
                          onEditChange(index, {
                            backend: {
                              service: currentService || undefined,
                              namespace: currentNamespace || undefined,
                              address: undefined,
                              port: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                        disabled={isImporting}
                      >
                        {selectedService.ports.map((p) => (
                          <option key={p.port} value={p.port}>
                            {p.port}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={currentPort}
                        onChange={(e) =>
                          onEditChange(index, {
                            backend: {
                              service: currentService || undefined,
                              namespace: currentNamespace || undefined,
                              address: undefined,
                              port: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                        disabled={isImporting}
                      />
                    )}
                  </div>
                </div>
              )}

              {editBackendKind === 'external' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="FQDN or IP address"
                    value={editBackend?.address ?? originalBackend?.address ?? ''}
                    onChange={(e) =>
                      onEditChange(index, {
                        backend: {
                          ...(editBackend ?? {}),
                          address: e.target.value,
                          port: editBackend?.port ?? originalBackend?.port ?? 8080,
                        },
                      })
                    }
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                    disabled={isImporting}
                  />
                  <input
                    type="number"
                    placeholder="Port"
                    value={editBackend?.port ?? originalBackend?.port ?? 8080}
                    onChange={(e) =>
                      onEditChange(index, {
                        backend: {
                          ...(editBackend ?? {}),
                          port: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                    disabled={isImporting}
                  />
                </div>
              )}
            </div>

            {/* 3. Description */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                Description
              </p>
              <textarea
                value={edit.description ?? route.description ?? ''}
                onChange={(e) => onEditChange(index, { description: e.target.value })}
                rows={2}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                placeholder="Optional description"
                disabled={isImporting}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helper: apply edits to a ParsedRoute config to build a CreateRouteInput
// ---------------------------------------------------------------------------

function applyEditsToConfig(
  route: ParsedRoute,
  edit: RouteEdit
): import('@/types').RouteConfig {
  // Deep-clone config
  const config: import('@/types').RouteConfig = JSON.parse(JSON.stringify(route.config));

  // Apply matcher override
  if (edit.matcher) {
    if (!config.matches) config.matches = [{}];
    if (!config.matches[0]) config.matches[0] = {};
    config.matches[0].path = {
      type: edit.matcher.type,
      value: edit.matcher.value,
    };
  }

  // Apply backend override
  if (edit.backend) {
    const eb = edit.backend;
    const address = eb.address ?? '';
    const newBackend: RouteBackend = eb.service
      ? {
          type: 'kubernetes',
          service: eb.service,
          namespace: eb.namespace ?? 'default',
          port: eb.port,
        }
      : {
          type: 'external',
          address,
          addressType: isIPLiteral(address) ? 'ip' : 'fqdn',
          port: eb.port,
        };

    if (!config.backends) config.backends = [];
    if (config.backends.length === 0) {
      config.backends.push(newBackend);
    } else {
      // Full replace, not merge — switching kinds must drop stale fields
      // (e.g. service/namespace when going kubernetes → external).
      config.backends[0] = newBackend;
    }
  }

  return config;
}

// isIPLiteral returns true if s parses as an IPv4 or IPv6 address. Used to
// pick the correct addressType for external backends when the user enters
// an IP rather than a hostname.
function isIPLiteral(s: string): boolean {
  if (!s) return false;
  // Simple IPv4 check
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(s)) {
    return s.split('.').every((part) => {
      const n = parseInt(part, 10);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6: contains ':' and no spaces; cheap check (full RFC validation isn't worth it here)
  return s.includes(':') && !s.includes(' ');
}

// ---------------------------------------------------------------------------
// ReviewStep
// ---------------------------------------------------------------------------

interface ReviewStepProps {
  parsed: OpenAPIImportResponse;
  projectId: string;
  domainId: string;
  teamId: string;
  routeNames: Record<number, string>;
  onRouteNameChange: (idx: number, name: string) => void;
  routeEdits: Record<number, RouteEdit>;
  onRouteEditChange: (idx: number, patch: Partial<RouteEdit>) => void;
  expandedEdits: Set<number>;
  onToggleExpandedEdit: (idx: number) => void;
  expandedTags: Set<string>;
  onToggleExpandedTag: (tag: string) => void;
  selectedRoutes: Set<number>;
  onToggleSelectRoute: (idx: number) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  routeConflicts: Record<number, ConflictResult[]>;
  warningsExpanded: boolean;
  onToggleWarnings: () => void;
  importProgress: { current: number; total: number } | null;
  importResults: Record<number, { success: boolean; error?: string }>;
  onReparse: () => void;
  onImport: () => Promise<void>;
  namespaces: K8sNamespace[];
  servicesByNs: Record<string, K8sService[]>;
  loadServicesForNs: (ns: string) => Promise<K8sService[]>;
  onMarkEditKey: (index: number, key: string) => void;
  submittedFromEdit: Map<number, { routeId: string; routeName: string }>;
}

function ReviewStep({
  parsed,
  projectId,
  domainId,
  teamId,
  routeNames,
  onRouteNameChange,
  routeEdits,
  onRouteEditChange,
  expandedEdits,
  onToggleExpandedEdit,
  expandedTags,
  onToggleExpandedTag,
  selectedRoutes,
  onToggleSelectRoute,
  onSelectAll,
  onSelectNone,
  routeConflicts,
  warningsExpanded,
  onToggleWarnings,
  importProgress,
  importResults,
  onReparse,
  onImport,
  namespaces,
  servicesByNs,
  loadServicesForNs,
  onMarkEditKey,
  submittedFromEdit,
}: ReviewStepProps) {
  const { routes, warnings, renames, specInfo } = parsed;

  const skippedCount = warnings.filter((w) =>
    w.message.toLowerCase().startsWith('skipped')
  ).length;
  const notesCount = warnings.length + renames.length;

  // Group routes by tag
  const tagGroups: Record<string, number[]> = {};
  routes.forEach((r, i) => {
    const tag = r.tag || '(no tag)';
    if (!tagGroups[tag]) tagGroups[tag] = [];
    tagGroups[tag].push(i);
  });

  const isImporting = importProgress !== null && importProgress.current < importProgress.total;
  const isImportComplete =
    importProgress !== null && importProgress.current === importProgress.total;

  // Check if any selected route has an invalid name
  const anyInvalidName = Array.from(selectedRoutes).some(
    (i) => !isValidName(routeNames[i] ?? routes[i]?.name ?? '')
  );

  const importDisabled =
    selectedRoutes.size === 0 || anyInvalidName || isImporting;

  // Build a rename lookup by final name
  const renameByFinal: Record<string, Rename> = {};
  renames.forEach((r) => {
    renameByFinal[r.final] = r;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Banner */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="info">{specInfo.format}</Badge>
            <span className="font-semibold">{specInfo.title}</span>
            <span className="text-gray-400 text-sm">v{specInfo.version}</span>
            <span className="text-gray-500 text-sm ml-auto">
              {routes.length} routes parsed
              {skippedCount > 0 && `, ${skippedCount} skipped`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Notes panel */}
      {notesCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <button
              className="flex items-center gap-2 w-full text-left text-sm font-medium"
              onClick={onToggleWarnings}
            >
              {warningsExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
              Notes ({notesCount})
            </button>
            {warningsExpanded && (
              <div className="mt-3 space-y-2">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge variant={w.level === 'warning' ? 'warning' : 'info'}>
                      {w.level}
                    </Badge>
                    <span className="text-gray-500">{w.source}</span>
                    <span className="text-gray-700 dark:text-gray-300">{w.message}</span>
                  </div>
                ))}
                {renames.map((r, i) => (
                  <div key={`rename-${i}`} className="flex items-start gap-2 text-xs">
                    <Badge variant="default">rename</Badge>
                    <span className="text-gray-700 dark:text-gray-300">
                      &quot;{r.original}&quot; → &quot;{r.final}&quot;{' '}
                      <span className="text-gray-500">({r.reason})</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" onClick={onSelectNone}>
            Select None
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onReparse} disabled={isImporting}>
            Re-parse
          </Button>
          {!isImportComplete && (
            <Button
              variant="primary"
              onClick={onImport}
              disabled={importDisabled}
            >
              {isImporting
                ? `Importing… ${importProgress!.current}/${importProgress!.total}`
                : `Import Selected (${selectedRoutes.size})`}
            </Button>
          )}
        </div>
      </div>

      {/* Import progress bar */}
      {importProgress && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>{isImporting ? 'Importing…' : 'Import complete'}</span>
            <span className="text-gray-500">
              {importProgress.current} / {importProgress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all"
              style={{
                width: `${
                  importProgress.total > 0
                    ? (importProgress.current / importProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Tag groups */}
      {Object.entries(tagGroups).map(([tag, indices]) => {
        const isTagExpanded = expandedTags.has(tag);
        return (
          <div key={tag} className="space-y-2">
            <button
              className="flex items-center gap-2 w-full text-left"
              onClick={() => onToggleExpandedTag(tag)}
            >
              {isTagExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
              <span className="font-medium text-sm">{tag}</span>
              <Badge variant="default">{indices.length}</Badge>
            </button>

            {isTagExpanded && (
              <div className="space-y-2 pl-4">
                {indices.map((idx) => {
                  const route = routes[idx];
                  const routeName = routeNames[idx] ?? route.name;
                  const routeRename = renameByFinal[route.name];
                  return (
                    <RouteCard
                      key={idx}
                      index={idx}
                      route={route}
                      name={routeName}
                      onNameChange={onRouteNameChange}
                      selected={selectedRoutes.has(idx)}
                      onToggleSelect={onToggleSelectRoute}
                      conflicts={routeConflicts[idx] ?? []}
                      importResult={importResults[idx]}
                      isImporting={isImporting}
                      edit={routeEdits[idx] ?? {}}
                      onEditChange={onRouteEditChange}
                      expanded={expandedEdits.has(idx)}
                      onToggleExpanded={onToggleExpandedEdit}
                      rename={routeRename}
                      projectId={projectId}
                      domainId={domainId}
                      teamId={teamId}
                      namespaces={namespaces}
                      servicesByNs={servicesByNs}
                      loadServicesForNs={loadServicesForNs}
                      onMarkEditKey={onMarkEditKey}
                      submittedInfo={submittedFromEdit.get(idx)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OpenAPIImportFlow({
  projectId,
  domainId,
  teamId,
  onBack,
}: OpenAPIImportFlowProps) {
  // ── Step state ────────────────────────────────────────────────
  const [step, setStep] = useState<'input' | 'review'>('input');

  // ── Input step state ──────────────────────────────────────────
  const [specText, setSpecText] = useState('');
  const [backendKind, setBackendKind] = useState<'kubernetes' | 'external'>('kubernetes');
  const [backend, setBackend] = useState<DefaultBackend>({ port: 8080 });
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // ── K8s discovery state (shared by input + inline edits) ──────
  // Namespaces are project-managed (only the ones the project may use as
  // backends); services are fetched lazily per namespace and cached.
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([]);
  const [servicesByNs, setServicesByNs] = useState<Record<string, K8sService[]>>({});
  const [k8sError, setK8sError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Use the project-managed namespace list (not the full cluster list).
    // The route create endpoint validates against this set, so we must offer
    // the same set to keep UI selections valid. Filter to namespaces with a
    // ReferenceGrant — those are the only ones routes can target.
    projectNamespacesApi
      .list(projectId)
      .then((projNs) => {
        if (cancelled) return;
        const usable = projNs
          .filter((ns) => ns.referenceGrantCreated)
          .map((ns) => ({ name: ns.namespace, status: 'Active' }));
        setNamespaces(usable);
      })
      .catch((err) => {
        if (!cancelled) {
          setK8sError(err instanceof Error ? err.message : 'Failed to load namespaces');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadServicesForNs = useCallback(
    async (ns: string): Promise<K8sService[]> => {
      if (!ns) return [];
      if (servicesByNs[ns]) return servicesByNs[ns];
      try {
        const services = await kubernetesApi.listServices(projectId, ns);
        setServicesByNs((prev) => ({ ...prev, [ns]: services }));
        return services;
      } catch {
        // Cache an empty array so we don't refetch endlessly on a permission error.
        setServicesByNs((prev) => ({ ...prev, [ns]: [] }));
        return [];
      }
    },
    [projectId, servicesByNs]
  );

  // Eagerly load services when the input-step namespace changes so the
  // service dropdown is populated by the time the user reaches it.
  useEffect(() => {
    if (backendKind === 'kubernetes' && backend.namespace) {
      loadServicesForNs(backend.namespace);
    }
  }, [backendKind, backend.namespace, loadServicesForNs]);

  // ── Review state ──────────────────────────────────────────────
  const [parsed, setParsed] = useState<OpenAPIImportResponse | null>(null);
  const [routeNames, setRouteNames] = useState<Record<number, string>>({});
  const [routeEdits, setRouteEdits] = useState<Record<number, RouteEdit>>({});
  const [expandedEdits, setExpandedEdits] = useState<Set<number>>(new Set());
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [selectedRoutes, setSelectedRoutes] = useState<Set<number>>(new Set());
  const [routeConflicts, setRouteConflicts] = useState<Record<number, ConflictResult[]>>({});
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [importResults, setImportResults] = useState<
    Record<number, { success: boolean; error?: string }>
  >({});

  // ── Edit-in-create-page tracking ──────────────────────────────
  const [editKeysByIndex, setEditKeysByIndex] = useState<Record<number, string>>({});
  const [submittedFromEdit, setSubmittedFromEdit] = useState<
    Map<number, { routeId: string; routeName: string }>
  >(new Map());

  useEffect(() => {
    const unsub = subscribeToImportEvents((evt: RouteCreatedFromPrefillMessage) => {
      if (evt.type !== 'route-created-from-prefill') return;
      const matchingIndex = Object.entries(editKeysByIndex).find(
        ([, k]) => k === evt.key,
      )?.[0];
      if (matchingIndex === undefined) return;
      const idx = Number(matchingIndex);
      setSubmittedFromEdit((prev) => {
        const next = new Map(prev);
        next.set(idx, { routeId: evt.routeId, routeName: evt.routeName });
        return next;
      });
      setSelectedRoutes((prev) => {
        if (!prev.has(idx)) return prev;
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    });
    return unsub;
  }, [editKeysByIndex]);

  const handleMarkEditKey = useCallback((index: number, key: string) => {
    setEditKeysByIndex((prev) => ({ ...prev, [index]: key }));
  }, []);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Initialize review state when parsed becomes non-null ──────
  useEffect(() => {
    if (!parsed) return;

    // Default names
    const names: Record<number, string> = {};
    parsed.routes.forEach((r, i) => {
      names[i] = r.name;
    });
    setRouteNames(names);

    // All tags expanded
    const tags = new Set<string>();
    parsed.routes.forEach((r) => tags.add(r.tag || '(no tag)'));
    setExpandedTags(tags);

    // Reset edits / results
    setRouteEdits({});
    setExpandedEdits(new Set());
    setImportProgress(null);
    setImportResults({});
    setRouteConflicts({});

    // Conflict check
    const checkConflicts = async () => {
      const conflictMap: Record<number, ConflictResult[]> = {};
      try {
        const results = await Promise.all(
          parsed.routes.map((route) => {
            const match = route.config?.matches?.[0];
            if (!match) return Promise.resolve([] as ConflictResult[]);
            return routesApi.checkConflicts(projectId, domainId, match).catch(() => [] as ConflictResult[]);
          })
        );
        results.forEach((conflicts, index) => {
          if (conflicts.length > 0) {
            conflictMap[index] = conflicts;
          }
        });
      } catch {
        // Silently fail — backend is the safety net
      }

      setRouteConflicts(conflictMap);

      // Auto-select non-conflicting routes
      const selected = new Set<number>();
      parsed.routes.forEach((_, i) => {
        if (!conflictMap[i]) {
          selected.add(i);
        }
      });
      setSelectedRoutes(selected);
    };

    checkConflicts();
  }, [parsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Input step handlers ───────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSpecText(ev.target?.result as string);
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  };

  const handleParse = async () => {
    if (!specText.trim()) return;
    if (!isBackendValid(backendKind, backend)) return;

    setParseError(null);
    setParsing(true);

    // Build backend payload — omit unused fields
    let payload: DefaultBackend;
    if (backendKind === 'kubernetes') {
      payload = {
        service: backend.service,
        namespace: backend.namespace,
        port: backend.port,
      };
    } else {
      payload = {
        address: backend.address,
        port: backend.port,
      };
    }

    try {
      const response = await openapiImportApi.parse(projectId, domainId, {
        spec: specText,
        defaultBackend: payload,
      });
      setParsed(response);
      setStep('review');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Parse failed. Check your spec and try again.');
    } finally {
      setParsing(false);
    }
  };

  const parseEnabled =
    specText.trim().length > 0 && isBackendValid(backendKind, backend);

  // ── Review step handlers ──────────────────────────────────────

  const handleRouteNameChange = useCallback((idx: number, name: string) => {
    setRouteNames((prev) => ({ ...prev, [idx]: name }));
  }, []);

  const handleRouteEditChange = useCallback((idx: number, patch: Partial<RouteEdit>) => {
    setRouteEdits((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? {}), ...patch },
    }));
  }, []);

  const handleToggleExpandedEdit = useCallback((idx: number) => {
    setExpandedEdits((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleToggleExpandedTag = useCallback((tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleToggleSelectRoute = useCallback((idx: number) => {
    setSelectedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (!parsed) return;
    setSelectedRoutes(new Set(parsed.routes.map((_, i) => i)));
  };

  const handleSelectNone = () => {
    setSelectedRoutes(new Set());
  };

  const handleReparse = () => {
    setStep('input');
  };

  const handleImport = async () => {
    if (!parsed) return;
    const indices = Array.from(selectedRoutes).sort((a, b) => a - b);
    if (indices.length === 0) return;

    setImportProgress({ current: 0, total: indices.length });
    setImportResults({});

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const route = parsed.routes[idx];
      const edit = routeEdits[idx] ?? {};
      const config = applyEditsToConfig(route, edit);

      const input: CreateRouteInput = {
        name: routeNames[idx] ?? route.name,
        description: edit.description ?? route.description,
        protocol: route.protocol,
        securityMode: route.securityMode,
        teamId,
        config,
      };

      try {
        await routesApi.create(projectId, domainId, input);
        setImportResults((prev) => ({ ...prev, [idx]: { success: true } }));
      } catch (err) {
        setImportResults((prev) => ({
          ...prev,
          [idx]: {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          },
        }));
      }

      setImportProgress({ current: i + 1, total: indices.length });
    }
  };

  // ── Render ────────────────────────────────────────────────────

  if (step === 'review' && parsed) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
          </Button>
          <h2 className="text-lg font-semibold">Import from OpenAPI</h2>
        </div>

        <ReviewStep
          parsed={parsed}
          projectId={projectId}
          domainId={domainId}
          teamId={teamId}
          routeNames={routeNames}
          onRouteNameChange={handleRouteNameChange}
          routeEdits={routeEdits}
          onRouteEditChange={handleRouteEditChange}
          expandedEdits={expandedEdits}
          onToggleExpandedEdit={handleToggleExpandedEdit}
          expandedTags={expandedTags}
          onToggleExpandedTag={handleToggleExpandedTag}
          selectedRoutes={selectedRoutes}
          onToggleSelectRoute={handleToggleSelectRoute}
          onSelectAll={handleSelectAll}
          onSelectNone={handleSelectNone}
          routeConflicts={routeConflicts}
          warningsExpanded={warningsExpanded}
          onToggleWarnings={() => setWarningsExpanded((v) => !v)}
          importProgress={importProgress}
          importResults={importResults}
          onReparse={handleReparse}
          onImport={handleImport}
          namespaces={namespaces}
          servicesByNs={servicesByNs}
          loadServicesForNs={loadServicesForNs}
          onMarkEditKey={handleMarkEditKey}
          submittedFromEdit={submittedFromEdit}
        />
      </div>
    );
  }

  // ── Input step ────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
        </Button>
        <h2 className="text-lg font-semibold">Import from OpenAPI</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left — spec input */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">OpenAPI Spec</p>
            <textarea
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              placeholder="Paste your OpenAPI 3.x spec (YAML or JSON)..."
              className="w-full h-80 p-3 border border-gray-300 dark:border-gray-700 rounded-lg font-mono text-xs bg-white dark:bg-gray-800 resize-none"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Upload spec file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Right — default backend */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-medium">Default Backend</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="backendKind"
                  value="kubernetes"
                  checked={backendKind === 'kubernetes'}
                  onChange={() => {
                    setBackendKind('kubernetes');
                    setBackend((prev) => ({ port: prev.port }));
                  }}
                />
                Kubernetes Service
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="backendKind"
                  value="external"
                  checked={backendKind === 'external'}
                  onChange={() => {
                    setBackendKind('external');
                    setBackend((prev) => ({ port: prev.port }));
                  }}
                />
                External address
              </label>
            </div>

            {backendKind === 'kubernetes' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Namespace</label>
                  <select
                    value={backend.namespace ?? ''}
                    onChange={(e) =>
                      setBackend((prev) => ({
                        ...prev,
                        namespace: e.target.value || undefined,
                        service: undefined,
                      }))
                    }
                    className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-800"
                  >
                    <option value="">Select namespace…</option>
                    {namespaces.map((ns) => (
                      <option key={ns.name} value={ns.name}>
                        {ns.name}
                      </option>
                    ))}
                  </select>
                  {namespaces.length === 0 && !k8sError && (
                    <p className="text-xs text-gray-500 mt-1">
                      No managed namespaces. Add one in Project Settings → Namespaces.
                    </p>
                  )}
                  {k8sError && (
                    <p className="text-xs text-red-500 mt-1">{k8sError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Service</label>
                  <select
                    value={backend.service ?? ''}
                    onChange={(e) =>
                      setBackend((prev) => ({
                        ...prev,
                        service: e.target.value || undefined,
                      }))
                    }
                    disabled={!backend.namespace}
                    className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-800 disabled:opacity-50"
                  >
                    <option value="">Select service…</option>
                    {(servicesByNs[backend.namespace ?? ''] ?? []).map((svc) => (
                      <option key={svc.name} value={svc.name}>
                        {svc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Port</label>
                  {(() => {
                    const svc = (servicesByNs[backend.namespace ?? ''] ?? []).find(
                      (s) => s.name === backend.service
                    );
                    if (svc && svc.ports.length > 0) {
                      return (
                        <select
                          value={backend.port}
                          onChange={(e) =>
                            setBackend((prev) => ({
                              ...prev,
                              port: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-800"
                        >
                          {svc.ports.map((p) => (
                            <option key={p.port} value={p.port}>
                              {p.port}
                              {p.name ? ` (${p.name})` : ''}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="number"
                        placeholder="Port"
                        value={backend.port}
                        onChange={(e) =>
                          setBackend((prev) => ({
                            ...prev,
                            port: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-800"
                      />
                    );
                  })()}
                </div>
              </div>
            )}

            {backendKind === 'external' && (
              <>
                <input
                  type="text"
                  placeholder="FQDN or IP address"
                  value={backend.address ?? ''}
                  onChange={(e) =>
                    setBackend((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-800"
                />
                <input
                  type="number"
                  placeholder="Port"
                  value={backend.port}
                  onChange={(e) =>
                    setBackend((prev) => ({
                      ...prev,
                      port: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-800"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleParse}
          disabled={!parseEnabled || parsing}
        >
          {parsing ? 'Parsing…' : 'Parse'}
        </Button>
      </div>
    </div>
  );
}
