'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Upload,
  FileText,
  Globe,
  MessageSquare,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { routesApi } from '@/lib/api/routes';
import {
  subscribeToImportEvents,
  type RouteCreatedFromPrefillMessage,
} from '@/lib/utils/importBroadcast';
import type {
  AIGeneratedRoute,
  ConflictResult,
  CreateRouteInput,
  RoutePrefillData,
} from '@/types';

export type ImportMode = 'ingress' | 'istio' | 'kong' | 'natural_language';

interface AIImportWizardProps {
  projectId: string;
  domainId: string;
  mode: ImportMode;
  teamId: string;
  onBack: () => void;
}

type Step = 'input' | 'review';

const MODE_OPTIONS: {
  key: ImportMode;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    key: 'ingress',
    label: 'Import Kubernetes Ingress',
    description: 'Convert Kubernetes Ingress resources to FastGateway routes',
    icon: FileText,
  },
  {
    key: 'istio',
    label: 'Import Istio Configuration',
    description: 'Convert Istio VirtualService and Gateway resources',
    icon: Globe,
  },
  {
    key: 'kong',
    label: 'Import Kong Configuration',
    description: 'Convert Kong declarative configuration to routes',
    icon: FileText,
  },
  {
    key: 'natural_language',
    label: 'Create with Natural Language',
    description: 'Describe routes in plain English and let AI generate them',
    icon: MessageSquare,
  },
];

const PLACEHOLDERS: Record<ImportMode, string> = {
  ingress: 'Paste your Kubernetes Ingress YAML here...',
  istio: 'Paste your Istio configuration YAML here...',
  kong: 'Paste your Kong declarative config YAML here...',
  natural_language: 'Describe the route you want to create...',
};

const NAME_REGEX = /^[a-z]([a-z0-9-]*[a-z0-9])?$/;

export function AIImportWizard({ projectId, domainId, mode, teamId, onBack }: AIImportWizardProps) {
  // Step state
  const [step, setStep] = useState<Step>('input');

  // Input state
  const [input, setInput] = useState('');

  // Review state
  const [routeNames, setRouteNames] = useState<Record<number, string>>({});
  const [selectedRoutes, setSelectedRoutes] = useState<Set<number>>(new Set());
  const [expandedRoutes, setExpandedRoutes] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [importResults, setImportResults] = useState<
    Record<number, { success: boolean; error?: string }>
  >({});
  const [routeConflicts, setRouteConflicts] = useState<Record<number, ConflictResult[]>>({});
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [editKeysByIndex, setEditKeysByIndex] = useState<Record<number, string>>({});
  const [submittedFromEdit, setSubmittedFromEdit] = useState<
    Map<number, { routeId: string; routeName: string }>
  >(new Map());

  const { routes, warnings, isStreaming, error, generate, cancel } =
    useAIGenerate({ projectId, domainId });

  // Check conflicts and auto-select non-conflicting routes when streaming completes
  useEffect(() => {
    if (!isStreaming && routes.length > 0) {
      const checkConflicts = async () => {
        setIsCheckingConflicts(true);
        const conflictMap: Record<number, ConflictResult[]> = {};

        try {
          const results = await Promise.all(
            routes.map((route) => {
              const match = route.config?.matches?.[0];
              if (!match) return Promise.resolve([]);
              return routesApi.checkConflicts(projectId, domainId, match).catch(() => []);
            })
          );

          results.forEach((conflicts, index) => {
            if (conflicts.length > 0) {
              conflictMap[index] = conflicts;
            }
          });
        } catch {
          // Silently fail — backend validation is the safety net
        }

        setRouteConflicts(conflictMap);
        // Auto-select all routes EXCEPT those with conflicts
        const selected = new Set<number>();
        routes.forEach((_, i) => {
          if (!conflictMap[i]) {
            selected.add(i);
          }
        });
        setSelectedRoutes(selected);
        setIsCheckingConflicts(false);
      };

      checkConflicts();
    }
  }, [isStreaming, routes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for route-created-from-prefill broadcasts emitted by the create page
  // when the user finishes editing in a separate tab. Match the event's prefill
  // key against the recorded edit keys to mark the corresponding row submitted.
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

  const getRouteName = (index: number): string =>
    routeNames[index] ?? routes[index]?.name ?? '';

  const isValidName = (name: string): boolean =>
    NAME_REGEX.test(name) && name.length > 0;

  const toggleRoute = useCallback((index: number) => {
    setSelectedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((index: number) => {
    setExpandedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = () => {
    setSelectedRoutes(new Set(routes.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelectedRoutes(new Set());
  };

  const getRouteSummary = (route: AIGeneratedRoute) => {
    const primaryPath = route.config.matches?.[0]?.path?.value || '/';
    const primaryBackend = route.config.backends?.[0];
    const backendStr = primaryBackend
      ? `${primaryBackend.service || primaryBackend.address}:${primaryBackend.port}`
      : route.config.redirect
        ? `Redirect to ${route.config.redirect.hostname || route.config.redirect.scheme}`
        : 'Direct Response';
    return { path: primaryPath, backend: backendStr };
  };

  const handleAnalyze = () => {
    if (!input.trim()) return;
    const generateMode = mode === 'natural_language' ? 'natural_language' : 'manifest_import';
    const formatHint =
      mode !== 'natural_language' ? mode : undefined;
    generate(generateMode, input, formatHint);
    setStep('review');
    setSelectedRoutes(new Set());
    setRouteNames({});
    setExpandedRoutes(new Set());
    setImportProgress(null);
    setImportResults({});
    setRouteConflicts({});
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setInput(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleEditInCreatePage = (index: number) => {
    const route = routes[index];
    if (!route) return;

    const prefill: RoutePrefillData = {
      name: getRouteName(index),
      description: route.description,
      protocol: route.protocol,
      securityMode: route.securityMode,
      teamId: teamId,
      config: route.config,
      securityPolicy: route.securityPolicy,
      backendTrafficPolicy: route.backendTrafficPolicy,
      extensionPolicy: route.extensionPolicy,
      wafPolicy: route.wafPolicy,
    };

    const key = `ai-prefill-${crypto.randomUUID()}`;
    try {
      sessionStorage.setItem(key, JSON.stringify(prefill));
    } catch {
      alert('Failed to store route data. Please use Import Selected instead.');
      return;
    }
    setEditKeysByIndex((prev) => ({ ...prev, [index]: key }));
    const url = `/projects/${projectId}/domains/${domainId}/routes/create?prefill=${key}`;
    window.open(url, '_blank');
  };

  const handleImportSelected = async () => {
    const indices = Array.from(selectedRoutes).sort((a, b) => a - b);
    if (indices.length === 0) return;

    setImportProgress({ current: 0, total: indices.length });
    setImportResults({});
    setRouteConflicts({});

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const route = routes[idx];
      try {
        const createInput: CreateRouteInput = {
          name: getRouteName(idx),
          description: route.description,
          protocol: route.protocol || 'http',
          securityMode: route.securityMode || 'general',
          teamId: teamId,
          config: route.config,
          securityPolicy: route.securityPolicy,
          backendTrafficPolicy: route.backendTrafficPolicy,
          extensionPolicy: route.extensionPolicy,
          wafPolicy: route.wafPolicy,
        };
        await routesApi.create(projectId, domainId, createInput);
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

  const isImporting = importProgress !== null && importProgress.current < importProgress.total;
  const isImportComplete =
    importProgress !== null && importProgress.current === importProgress.total;

  // ─── INPUT STEP ──────────────────────────────────────────────
  if (step === 'input') {
    const isNL = mode === 'natural_language';
    const modeLabel = MODE_OPTIONS.find((m) => m.key === mode)?.label;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">{modeLabel}</h2>
        </div>

        <div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDERS[mode]}
            className="w-full h-64 p-4 border border-gray-300 dark:border-gray-700 rounded-lg font-mono text-sm bg-white dark:bg-gray-800"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            {!isNL && (
              <label className="cursor-pointer inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm">
                <Upload className="h-4 w-4" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept=".yaml,.yml,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <Button
            variant="primary"
            onClick={handleAnalyze}
            disabled={!input.trim()}
          >
            {isNL ? 'Generate' : 'Analyze'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── REVIEW STEP ─────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Review Generated Routes</h2>
          <p className="text-gray-500 text-sm">
            {routes.length > 0
              ? `${selectedRoutes.size} of ${routes.length} selected`
              : isStreaming
                ? 'Analyzing...'
                : 'No routes generated'}
          </p>
        </div>
        {routes.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={selectAll}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Select None
            </button>
          </div>
        )}
      </div>

      {isStreaming && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <span className="animate-pulse">●</span>
            <span className="text-sm">Generating routes...</span>
          </div>
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}

      {isCheckingConflicts && (
        <p className="text-sm text-gray-500 mb-3">Checking for conflicts...</p>
      )}

      {error && (
        <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!isStreaming && routes.length === 0 && !error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 mb-4">
              No routes could be generated from this input.
            </p>
            <Button
              variant="secondary"
              onClick={() => setStep('input')}
            >
              Go Back and Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Route cards */}
      <div className="space-y-3">
        {routes.map((route, index) => {
          const summary = getRouteSummary(route);
          const name = getRouteName(index);
          const nameValid = isValidName(name);
          const isExpanded = expandedRoutes.has(index);
          const result = importResults[index];
          const submittedInfo = submittedFromEdit.get(index);
          const isSubmitted = submittedInfo !== undefined;

          return (
            <Card
              key={index}
              className={`${
                selectedRoutes.has(index) ? 'border-primary-500' : ''
              } ${isSubmitted ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSubmitted ? false : selectedRoutes.has(index)}
                    onChange={() => toggleRoute(index)}
                    className="h-4 w-4 mt-1"
                    disabled={isImporting || isSubmitted}
                  />
                  <div className="flex-1 min-w-0">
                    {/* Editable name */}
                    <input
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setRouteNames((prev) => ({
                          ...prev,
                          [index]: e.target.value.toLowerCase(),
                        }))
                      }
                      className={`w-full text-sm font-medium px-2 py-1 border rounded ${
                        !nameValid && name.length > 0
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="route-name"
                      disabled={isImporting}
                    />
                    {!nameValid && name.length > 0 && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Must be lowercase DNS name (a-z, 0-9, hyphens)
                      </p>
                    )}

                    {/* Route summary */}
                    <div className="text-sm text-gray-500 mt-1">
                      {summary.path} → {summary.backend}
                    </div>

                    {/* Protocol badge */}
                    <div className="mt-1.5 flex gap-2">
                      <Badge variant="default">
                        {route.protocol || 'http'}
                      </Badge>
                      {route.config.routeType &&
                        route.config.routeType !== 'backend' && (
                          <Badge variant="info">{route.config.routeType}</Badge>
                        )}
                    </div>

                    {/* Conflict warning */}
                    {routeConflicts[index] && routeConflicts[index].length > 0 && (
                      <div className="mt-1.5">
                        <Badge variant="warning">
                          Conflicts with &quot;{routeConflicts[index][0].routeName}&quot;
                          {routeConflicts[index].length > 1 && ` +${routeConflicts[index].length - 1} more`}
                        </Badge>
                      </div>
                    )}

                    {/* Warnings */}
                    {route.warnings && route.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {route.warnings.map((w, wi) => (
                          <div
                            key={wi}
                            className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>{w.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Import result */}
                    {result && (
                      <div
                        className={`mt-2 flex items-center gap-1.5 text-xs ${
                          result.success
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}
                      >
                        {result.success ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Imported successfully</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5" />
                            <span>Failed: {result.error}</span>
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
                        onClick={() => handleEditInCreatePage(index)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                        title="Edit in Create Page"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpanded(index)}
                      className="text-gray-400 hover:text-gray-600"
                      title={isExpanded ? 'Hide config' : 'Show config'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded config JSON */}
                {isExpanded && (
                  <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(route.config, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Import progress */}
      {importProgress && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>
              {isImporting ? 'Importing...' : 'Import complete'}
            </span>
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

      {/* Footer actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          onClick={() => {
            setStep('input');
            setImportProgress(null);
            setImportResults({});
            setRouteConflicts({});
          }}
          disabled={isImporting}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {!isImportComplete && (
          <Button
            variant="primary"
            onClick={handleImportSelected}
            disabled={
              selectedRoutes.size === 0 ||
              isStreaming ||
              isImporting ||
              Array.from(selectedRoutes).some(
                (i) => !isValidName(getRouteName(i))
              )
            }
          >
            Import {selectedRoutes.size} Route
            {selectedRoutes.size !== 1 ? 's' : ''}
          </Button>
        )}
      </div>
    </div>
  );
}
