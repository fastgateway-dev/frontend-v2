'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Plus, X, ChevronRight, ChevronLeft, Shield, Sparkles, MessageSquare, AlertTriangle } from 'lucide-react';
import {
  Button, Card, CardContent, Input, Select,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  InfoTooltip
} from '@/components/ui';
import { Badge } from '@/components/ui';
import { domainsApi, routesApi, projectTeamsApi, kubernetesApi, projectNamespacesApi, clientAttachmentsApi, clientsApi } from '@/lib/api';
import type { Domain, ProjectTeamRole, K8sNamespace, K8sService, CreateRouteInput, PathMatch, HeaderValue, RouteType, SecurityPolicyInput, BackendTrafficPolicyInput, CompressionType, RetryConfig, RetryOn, PerRetryPolicy, BackOffPolicy, LoadBalancerType, ConsistentHashType, CircuitBreakerConfig, HealthCheckConfig, ActiveHealthCheckConfig, TCPActiveHealthCheckConfig, PassiveHealthCheckConfig, Client, FaultInjectionConfig, FaultInjectionDelayConfig, FaultInjectionAbortConfig, SecurityMode, RateLimitConfig, ProjectCapabilities, RequestBufferConfig, ResponseOverrideRule, LuaExtensionConfig, WasmExtensionConfig, ExtProcExtensionConfig, EnvoyExtensionPolicyConfig, WafPolicyConfig, BTPTimeoutConfig, RouteMatch } from '@/types';
import { projectsApi } from '@/lib/api';
import RateLimitForm from '@/components/RateLimitForm';
import RequestBufferForm from '@/components/RequestBufferForm';
import ResponseOverrideForm from '@/components/ResponseOverrideForm';
import LuaExtensionForm from '@/components/LuaExtensionForm';
import WasmExtensionForm from '@/components/WasmExtensionForm';
import ExtProcExtensionForm from '@/components/ExtProcExtensionForm';
import WafPolicyForm from '@/components/WafPolicyForm';
import { useForm } from 'react-hook-form';
import { YamlDiffViewer } from '@/components/features/yaml-diff-viewer';
import { AIChatPanel } from '@/components/AIChatPanel';
import { AIReviewCard } from '@/components/features/ai-review-card';
import { LabelsEditor } from '@/components/ui/labels-editor';
import { readPrefillData, extractPrefillFormData } from '@/lib/utils/hydrate-prefill';
import { aiApi } from '@/lib/api/ai';
import type { AIReviewResult, AIChatContext } from '@/types';
import { useMatcherConflictCheck } from '@/hooks/useMatcherConflictCheck';
import { AIImportWizard } from '@/components/AIImportWizard';
import { shouldRenderNLWizard } from './mode';
import { signalCreatedFromPrefill } from './onSubmit';

interface HeaderMatchInput {
  name: string;
  type: 'Exact' | 'RegularExpression';
  value: string;
}

interface QueryParamMatchInput {
  name: string;
  type: 'Exact' | 'RegularExpression';
  value: string;
}

type HeaderModifierAction = 'set' | 'add' | 'remove';

interface HeaderModifierInput {
  action: HeaderModifierAction;
  name: string;
  value: string;
}

interface BackendInput {
  type: 'kubernetes' | 'external';
  namespace: string;
  service: string;
  port: number;
  weight: number;
  fallback: boolean;
  services: K8sService[];
  addressType: 'fqdn' | 'ip';
  address: string;
  // TLS configuration for backends (both kubernetes and external)
  tlsEnabled: boolean;
  tlsMode: 'simple' | 'mtls';
  insecureSkipVerify: boolean;
  sni: string;
  caCertificateRefs: Array<{ kind: 'Secret' | 'ConfigMap'; name: string; namespace: string }>;
  clientCertificateRef: { name: string; namespace: string };
}

interface MirrorInput {
  namespace: string;
  service: string;
  port: number;
  services: K8sService[];
}

interface RouteFormData {
  name: string;
  description?: string;
  protocol: 'http' | 'grpc';
  teamId: string;
  pathType: PathMatch['type'];
  pathValue: string;
  method: string;
  grpcServiceType: 'Exact' | 'RegularExpression';
  grpcServiceValue: string;
  grpcMethodType: 'Exact' | 'RegularExpression';
  grpcMethodValue: string;
}

type TabValue = 'basic' | 'traffic' | 'extensions' | 'security' | 'clients' | 'preview';

const grpcStatusOptions = [
  { value: '0', label: 'OK (0)' },
  { value: '1', label: 'Cancelled (1)' },
  { value: '2', label: 'Unknown (2)' },
  { value: '3', label: 'Invalid Argument (3)' },
  { value: '4', label: 'Deadline Exceeded (4)' },
  { value: '5', label: 'Not Found (5)' },
  { value: '6', label: 'Already Exists (6)' },
  { value: '7', label: 'Permission Denied (7)' },
  { value: '8', label: 'Resource Exhausted (8)' },
  { value: '9', label: 'Failed Precondition (9)' },
  { value: '10', label: 'Aborted (10)' },
  { value: '11', label: 'Out of Range (11)' },
  { value: '12', label: 'Unimplemented (12)' },
  { value: '13', label: 'Internal (13)' },
  { value: '14', label: 'Unavailable (14)' },
  { value: '15', label: 'Data Loss (15)' },
  { value: '16', label: 'Unauthenticated (16)' },
];

export default function CreateRoutePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const domainId = params.domainId as string;
  const renderNL = shouldRenderNLWizard(searchParams.get('mode'));

  const [domain, setDomain] = useState<Domain | null>(null);
  const [teams, setTeams] = useState<ProjectTeamRole[]>([]);
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<TabValue>('basic');
  const [tabErrors, setTabErrors] = useState<Record<TabValue, string | null>>({
    basic: null,
    traffic: null,
    extensions: null,
    security: null,
    clients: null,
    preview: null,
  });

  // Multiple backends state for traffic splitting
  const [backends, setBackends] = useState<BackendInput[]>([
    {
      type: 'kubernetes',
      namespace: '',
      service: '',
      port: 80,
      weight: 100,
      fallback: false,
      services: [],
      addressType: 'fqdn',
      address: '',
      tlsEnabled: false,
      tlsMode: 'simple',
      insecureSkipVerify: false,
      sni: '',
      caCertificateRefs: [{ kind: 'ConfigMap', name: '', namespace: '' }],
      clientCertificateRef: { name: '', namespace: '' },
    }
  ]);

  // Request mirroring state
  const [mirrors, setMirrors] = useState<MirrorInput[]>([]);

  // Enhanced matching state
  const [headers, setHeaders] = useState<HeaderMatchInput[]>([]);
  const [queryParams, setQueryParams] = useState<QueryParamMatchInput[]>([]);

  // Header modifier state
  const [requestHeaderModifiers, setRequestHeaderModifiers] = useState<HeaderModifierInput[]>([]);
  const [responseHeaderModifiers, setResponseHeaderModifiers] = useState<HeaderModifierInput[]>([]);

  // URL Rewrite state
  const [rewriteHostname, setRewriteHostname] = useState<string>('');
  const [rewriteHostnameEnabled, setRewriteHostnameEnabled] = useState(false);
  const [rewritePathEnabled, setRewritePathEnabled] = useState(false);
  const [rewritePathType, setRewritePathType] = useState<'ReplacePrefixMatch' | 'ReplaceFullPath'>('ReplacePrefixMatch');
  const [rewritePathValue, setRewritePathValue] = useState<string>('');

  // BTP Timeout state
  const [btpTimeoutEnabled, setBtpTimeoutEnabled] = useState(false);
  const [tcpConnectTimeout, setTcpConnectTimeout] = useState('');
  const [httpRequestTimeout, setHttpRequestTimeout] = useState('');
  const [httpConnectionIdleTimeout, setHttpConnectionIdleTimeout] = useState('');
  const [httpMaxConnectionDuration, setHttpMaxConnectionDuration] = useState('');
  const [httpMaxStreamDuration, setHttpMaxStreamDuration] = useState('');

  // CORS state
  const [corsEnabled, setCorsEnabled] = useState(false);
  const [corsAllowOrigins, setCorsAllowOrigins] = useState<string[]>([]);
  const [corsAllowMethods, setCorsAllowMethods] = useState<string[]>([]);
  const [corsAllowHeaders, setCorsAllowHeaders] = useState<string[]>([]);
  const [corsExposeHeaders, setCorsExposeHeaders] = useState<string[]>([]);
  const [corsMaxAge, setCorsMaxAge] = useState<string>('');
  const [corsAllowCredentials, setCorsAllowCredentials] = useState(false);

  const [securityMode, setSecurityMode] = useState<SecurityMode>('general');

  // IP Allowlisting (general mode)
  const [ipAllowlistEnabled, setIpAllowlistEnabled] = useState(false);
  const [ipAllowlistCidrs, setIpAllowlistCidrs] = useState<string[]>([]);
  const [ipCidrInput, setIpCidrInput] = useState('');

  // Header & Method Authorization (general mode)
  const [headerMethodAuthEnabled, setHeaderMethodAuthEnabled] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Array<{ name: string; values: string }>>([]);
  const [authMethods, setAuthMethods] = useState<string[]>([]);

  // API Key Auth (general mode)
  const [apiKeyAuthEnabled, setApiKeyAuthEnabled] = useState(false);
  const [apiKeySecretName, setApiKeySecretName] = useState('');
  const [apiKeyHeaderName, setApiKeyHeaderName] = useState('x-api-key');

  // JWT Auth (general mode)
  const [jwtAuthEnabled, setJwtAuthEnabled] = useState(false);
  const [jwtIssuer, setJwtIssuer] = useState('');
  const [jwtJwksUrl, setJwtJwksUrl] = useState('');
  const [jwtAudiences, setJwtAudiences] = useState<string[]>([]);
  const [jwtAudienceInput, setJwtAudienceInput] = useState('');
  const [jwtClaimToHeaders, setJwtClaimToHeaders] = useState<Array<{claim: string; header: string}>>([]);

  // OIDC (general mode)
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcIssuer, setOidcIssuer] = useState('');
  const [oidcClientId, setOidcClientId] = useState('');
  const [oidcClientSecretName, setOidcClientSecretName] = useState('');
  const [oidcRedirectUrl, setOidcRedirectUrl] = useState('');
  const [oidcLogoutPath, setOidcLogoutPath] = useState('/logout');
  const [oidcScopes, setOidcScopes] = useState<string[]>(['openid']);
  const [oidcScopeInput, setOidcScopeInput] = useState('');
  const [oidcCookieDomain, setOidcCookieDomain] = useState('');

  // External Authorization state (both modes)
  const [extAuthEnabled, setExtAuthEnabled] = useState(false);
  const [extAuthType, setExtAuthType] = useState<'http' | 'grpc'>('http');
  const [extAuthServiceName, setExtAuthServiceName] = useState('');
  const [extAuthServiceNamespace, setExtAuthServiceNamespace] = useState('');
  const [extAuthServicePort, setExtAuthServicePort] = useState<number>(8080);
  const [extAuthPath, setExtAuthPath] = useState('/auth');
  const [extAuthHeadersToBackend, setExtAuthHeadersToBackend] = useState<string[]>([]);
  const [extAuthHeaderToBackendInput, setExtAuthHeaderToBackendInput] = useState('');
  const [extAuthFailOpen, setExtAuthFailOpen] = useState(false);
  const [extAuthHeadersToDownstreamOnDeny, setExtAuthHeadersToDownstreamOnDeny] = useState<string[]>([]);
  const [extAuthHeaderToDownstreamOnDenyInput, setExtAuthHeaderToDownstreamOnDenyInput] = useState('');
  const [extAuthHeadersToDownstreamOnAllow, setExtAuthHeadersToDownstreamOnAllow] = useState<string[]>([]);
  const [extAuthHeaderToDownstreamOnAllowInput, setExtAuthHeaderToDownstreamOnAllowInput] = useState('');
  const [extAuthHeadersToUpstreamOnAllow, setExtAuthHeadersToUpstreamOnAllow] = useState<string[]>([]);
  const [extAuthHeaderToUpstreamOnAllowInput, setExtAuthHeaderToUpstreamOnAllowInput] = useState('');
  const [extAuthHeadersToExtAuth, setExtAuthHeadersToExtAuth] = useState<string[]>([]);
  const [extAuthHeaderToExtAuthInput, setExtAuthHeaderToExtAuthInput] = useState('');
  const [extAuthIncludeBody, setExtAuthIncludeBody] = useState(false);
  const [extAuthMaxBodyBytes, setExtAuthMaxBodyBytes] = useState<number>(1024);

  // Default Traffic Policy state
  const [defaultTrafficPolicy, setDefaultTrafficPolicy] = useState<'allow_all' | 'deny' | 'require_ip_allowlist'>('allow_all');
  const [defaultAllowedCIDRs, setDefaultAllowedCIDRs] = useState<string[]>([]);
  const [defaultCidrInput, setDefaultCidrInput] = useState('');

  // Compression state
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionTypes, setCompressionTypes] = useState<CompressionType[]>([]);

  // Retry state
  const [retryEnabled, setRetryEnabled] = useState(false);
  const [retryNumRetries, setRetryNumRetries] = useState<string>('');
  const [retryHttpStatusCodes, setRetryHttpStatusCodes] = useState<number[]>([]);
  const [retryStatusCodeInput, setRetryStatusCodeInput] = useState<string>('');
  const [retryTriggers, setRetryTriggers] = useState<string[]>([]);
  const [retryTimeout, setRetryTimeout] = useState('');
  const [retryBackOffBaseInterval, setRetryBackOffBaseInterval] = useState('');
  const [retryBackOffMaxInterval, setRetryBackOffMaxInterval] = useState('');

  // Load Balancer state
  const [lbEnabled, setLbEnabled] = useState(false);
  const [lbType, setLbType] = useState<LoadBalancerType>('RoundRobin');
  const [lbConsistentHashType, setLbConsistentHashType] = useState<ConsistentHashType>('SourceIP');
  const [lbHeaderName, setLbHeaderName] = useState('');
  const [lbCookieName, setLbCookieName] = useState('');
  const [lbCookieTTL, setLbCookieTTL] = useState('');
  const [lbCookieAttributes, setLbCookieAttributes] = useState<Array<{key: string; value: string}>>([]);
  const [lbCookieAttrKeyInput, setLbCookieAttrKeyInput] = useState('');
  const [lbCookieAttrValueInput, setLbCookieAttrValueInput] = useState('');

  // Circuit Breaker state
  const [cbEnabled, setCbEnabled] = useState(false);
  const [cbMaxConnections, setCbMaxConnections] = useState('');
  const [cbMaxPendingRequests, setCbMaxPendingRequests] = useState('');
  const [cbMaxParallelRequests, setCbMaxParallelRequests] = useState('');
  const [cbMaxParallelRetries, setCbMaxParallelRetries] = useState('');
  const [cbMaxRequestsPerConnection, setCbMaxRequestsPerConnection] = useState('');

  // Health Check state
  const [hcEnabled, setHcEnabled] = useState(false);
  const [hcPanicThreshold, setHcPanicThreshold] = useState('');
  // Active
  const [hcActiveEnabled, setHcActiveEnabled] = useState(false);
  const [hcActiveType, setHcActiveType] = useState<'HTTP' | 'TCP' | 'GRPC'>('HTTP');
  const [hcActiveTimeout, setHcActiveTimeout] = useState('');
  const [hcActiveInterval, setHcActiveInterval] = useState('');
  const [hcActiveUnhealthyThreshold, setHcActiveUnhealthyThreshold] = useState('');
  const [hcActiveHealthyThreshold, setHcActiveHealthyThreshold] = useState('');
  // HTTP
  const [hcHttpPath, setHcHttpPath] = useState('/healthz');
  const [hcHttpMethod, setHcHttpMethod] = useState('GET');
  const [hcHttpExpectedStatuses, setHcHttpExpectedStatuses] = useState<number[]>([]);
  const [hcHttpStatusInput, setHcHttpStatusInput] = useState('');
  // TCP
  const [hcTcpSendText, setHcTcpSendText] = useState('');
  const [hcTcpReceiveText, setHcTcpReceiveText] = useState('');
  // GRPC
  const [hcGrpcService, setHcGrpcService] = useState('');
  // Passive
  const [hcPassiveEnabled, setHcPassiveEnabled] = useState(false);
  const [hcPassiveConsecutiveGatewayErrors, setHcPassiveConsecutiveGatewayErrors] = useState('');
  const [hcPassiveConsecutive5xxErrors, setHcPassiveConsecutive5xxErrors] = useState('');
  const [hcPassiveInterval, setHcPassiveInterval] = useState('');
  const [hcPassiveBaseEjectionTime, setHcPassiveBaseEjectionTime] = useState('');

  // Fault Injection state
  const [fiEnabled, setFiEnabled] = useState(false);
  // Delay
  const [fiDelayEnabled, setFiDelayEnabled] = useState(false);
  const [fiDelayFixedDelay, setFiDelayFixedDelay] = useState('');
  const [fiDelayPercentage, setFiDelayPercentage] = useState('');
  // Abort
  const [fiAbortEnabled, setFiAbortEnabled] = useState(false);
  const [fiAbortType, setFiAbortType] = useState<'http' | 'grpc'>('http');
  const [fiAbortHttpStatus, setFiAbortHttpStatus] = useState('');
  const [fiAbortGrpcStatus, setFiAbortGrpcStatus] = useState('');
  const [fiAbortPercentage, setFiAbortPercentage] = useState('');

  // Rate Limit state
  const [rateLimit, setRateLimit] = useState<RateLimitConfig | undefined>(undefined);
  const [capabilities, setCapabilities] = useState<ProjectCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState(false);

  // Request Buffer state
  const [requestBuffer, setRequestBuffer] = useState<RequestBufferConfig | undefined>(undefined);

  // Response Override state
  const [responseOverride, setResponseOverride] = useState<ResponseOverrideRule[]>([]);

  // Extension state
  const [luaExtension, setLuaExtension] = useState<LuaExtensionConfig | undefined>(undefined);
  const [wasmExtension, setWasmExtension] = useState<WasmExtensionConfig | undefined>(undefined);
  const [extProcExtension, setExtProcExtension] = useState<ExtProcExtensionConfig | undefined>(undefined);

  // WAF Policy state
  const [wafPolicy, setWafPolicy] = useState<WafPolicyConfig | undefined>(undefined);

  // Client attachment state
  const [pendingAttachments, setPendingAttachments] = useState<Array<{
    clientId: string;
    clientName: string;
    teamName: string;
    apiKeyEnabled: boolean;
    jwtEnabled: boolean;
    enableIpAllowlist: boolean;
    enableApiKey: boolean;
    enableJwt: boolean;
    enableBasicAuth: boolean;
    enableMtls: boolean;
    enableHeaderAuth: boolean;
    rateLimitConfig?: RateLimitConfig;
  }>>([]);
  const [showAttachClientModal, setShowAttachClientModal] = useState(false);
  const [attachClientForm, setAttachClientForm] = useState({
    clientId: '',
    enableIpAllowlist: true,
    enableApiKey: false,
    enableJwt: false,
    enableBasicAuth: false,
    enableMtls: false,
    enableHeaderAuth: false,
  });
  const [attachRateLimitConfig, setAttachRateLimitConfig] = useState<RateLimitConfig | undefined>(undefined);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Route Type state (backend or redirect)
  const [routeType, setRouteType] = useState<RouteType>('backend');

  // Redirect state
  const [redirectScheme, setRedirectScheme] = useState<string>('https');
  const [redirectHostname, setRedirectHostname] = useState<string>('');
  const [redirectPort, setRedirectPort] = useState<string>('');
  const [redirectStatusCode, setRedirectStatusCode] = useState<number>(301);
  const [redirectPathEnabled, setRedirectPathEnabled] = useState(false);
  const [redirectPathType, setRedirectPathType] = useState<'ReplacePrefixMatch' | 'ReplaceFullPath'>('ReplaceFullPath');
  const [redirectPathValue, setRedirectPathValue] = useState<string>('');

  // Direct Response state
  const [drStatusCode, setDrStatusCode] = useState<string>('200');
  const [drContentType, setDrContentType] = useState<string>('text/plain');
  const [drBody, setDrBody] = useState<string>('');

  // Preview state
  const [previewYaml, setPreviewYaml] = useState<string>('');
  const [previewSecurityPolicyYaml, setPreviewSecurityPolicyYaml] = useState<string>('');
  const [previewBackendTrafficPolicyYaml, setPreviewBackendTrafficPolicyYaml] = useState<string>('');
  const [previewEnvoyExtensionPolicyYaml, setPreviewEnvoyExtensionPolicyYaml] = useState<string>('');
  const [previewBackendYaml, setPreviewBackendYaml] = useState<string>('');
  const [previewHttpRouteFilterYaml, setPreviewHttpRouteFilterYaml] = useState<string>('');
  const [previewConfigMapYaml, setPreviewConfigMapYaml] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // AI Assistant state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  // AI Review state
  const [changeDescription, setChangeDescription] = useState('');
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResult | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<RouteFormData>({
    defaultValues: {
      protocol: 'http',
      pathType: 'Prefix',
      pathValue: '/',
      method: '',
      teamId: '',
      grpcServiceType: 'Exact',
      grpcServiceValue: '',
      grpcMethodType: 'Exact',
      grpcMethodValue: '',
    },
  });

  const watchPathType = watch('pathType');
  const watchName = watch('name');
  const watchTeamId = watch('teamId');
  const watchProtocol = watch('protocol');
  const watchPathValue = watch('pathValue');
  const watchMethod = watch('method');
  const watchGrpcServiceType = watch('grpcServiceType');
  const watchGrpcServiceValue = watch('grpcServiceValue');
  const watchGrpcMethodType = watch('grpcMethodType');
  const watchGrpcMethodValue = watch('grpcMethodValue');

  const conflictCheckMatch: RouteMatch | null = (() => {
    const hasPath = watchPathValue && watchPathValue.length > 0;
    const hasGrpc = (watchGrpcServiceValue && watchGrpcServiceValue.length > 0) ||
                    (watchGrpcMethodValue && watchGrpcMethodValue.length > 0);
    if (!hasPath && !hasGrpc) return null;
    return {
      path: hasPath ? { type: watchPathType, value: watchPathValue } : undefined,
      method: watchMethod || undefined,
      headers: headers.length > 0 ? headers.map(h => ({ name: h.name, type: h.type, value: h.value })) : undefined,
      queryParams: queryParams.length > 0 ? queryParams.map(q => ({ name: q.name, type: q.type, value: q.value })) : undefined,
      grpcService: watchGrpcServiceValue ? { type: watchGrpcServiceType, value: watchGrpcServiceValue } : undefined,
      grpcMethod: watchGrpcMethodValue ? { type: watchGrpcMethodType, value: watchGrpcMethodValue } : undefined,
    };
  })();

  const { conflicts: matcherConflicts } = useMatcherConflictCheck({
    projectId,
    domainId,
    match: conflictCheckMatch,
  });

  // Auto-set routeType to 'backend' when protocol changes to gRPC
  useEffect(() => {
    if (watchProtocol === 'grpc' && routeType !== 'backend') {
      setRouteType('backend');
    }
  }, [watchProtocol]);

  useEffect(() => {
    loadData();
  }, [projectId, domainId]);

  // Prefill from AI import (runs after initial load)
  useEffect(() => {
    if (isLoading) return; // wait for loadData to finish
    const prefillKey = searchParams.get('prefill');
    if (!prefillKey) return;

    const prefillData = readPrefillData(prefillKey);
    if (!prefillData) return;

    const prefill = extractPrefillFormData(prefillData);

    // Set form values via react-hook-form setValue
    setValue('name', prefill.formData.name);
    if (prefill.formData.description) setValue('description', prefill.formData.description);
    setValue('protocol', prefill.formData.protocol as any);
    setValue('teamId', prefill.formData.teamId);
    setValue('pathType', prefill.formData.pathType as any);
    setValue('pathValue', prefill.formData.pathValue);
    if (prefill.formData.method) setValue('method', prefill.formData.method);
    if (prefill.formData.grpcServiceValue) {
      setValue('grpcServiceType', prefill.formData.grpcServiceType as any);
      setValue('grpcServiceValue', prefill.formData.grpcServiceValue);
    }
    if (prefill.formData.grpcMethodValue) {
      setValue('grpcMethodType', prefill.formData.grpcMethodType as any);
      setValue('grpcMethodValue', prefill.formData.grpcMethodValue);
    }

    setSecurityMode(prefill.securityMode as any);
    setRouteType(prefill.routeType as any);
    if (prefill.backends.length > 0) {
      // Set backends first, then fetch services for each namespace to populate dropdowns
      const prefillBackends = prefill.backends as any[];
      setBackends(prefillBackends);
      // Fetch services for each unique namespace to populate service dropdowns
      const namespacesToFetch = [...new Set(prefillBackends.map((b: any) => b.namespace).filter(Boolean))];
      Promise.all(namespacesToFetch.map((ns: string) => kubernetesApi.listServices(projectId, ns).catch(() => []))).then((results) => {
        const servicesByNamespace: Record<string, any[]> = {};
        namespacesToFetch.forEach((ns: string, i: number) => {
          servicesByNamespace[ns] = results[i] || [];
        });
        setBackends(prev => prev.map((b) => {
          if (b.namespace && servicesByNamespace[b.namespace]) {
            return { ...b, services: servicesByNamespace[b.namespace] };
          }
          return b;
        }));
      });
    }
    if (prefill.headerMatches.length > 0) setHeaders(prefill.headerMatches as any);
    if (prefill.queryParamMatches.length > 0) setQueryParams(prefill.queryParamMatches as any);
    if (prefill.requestHeaderModifiers.length > 0) setRequestHeaderModifiers(prefill.requestHeaderModifiers as any);
    if (prefill.responseHeaderModifiers.length > 0) setResponseHeaderModifiers(prefill.responseHeaderModifiers as any);

    // Apply security policy fields
    if (prefill.securityPolicy?.cors) {
      setCorsEnabled(true);
      setCorsAllowOrigins(prefill.securityPolicy.cors.allowOrigins || []);
      setCorsAllowMethods(prefill.securityPolicy.cors.allowMethods || []);
      setCorsAllowHeaders(prefill.securityPolicy.cors.allowHeaders || []);
      setCorsExposeHeaders(prefill.securityPolicy.cors.exposeHeaders || []);
      setCorsMaxAge(prefill.securityPolicy.cors.maxAge != null ? String(prefill.securityPolicy.cors.maxAge) : '');
      setCorsAllowCredentials(prefill.securityPolicy.cors.allowCredentials || false);
    }
    if (prefill.securityPolicy?.jwt) {
      setJwtAuthEnabled(true);
      setJwtIssuer(prefill.securityPolicy.jwt.issuer || '');
      setJwtJwksUrl(prefill.securityPolicy.jwt.jwksUrl || '');
      setJwtAudiences(prefill.securityPolicy.jwt.audiences || []);
      setJwtClaimToHeaders(prefill.securityPolicy.jwt.claimToHeaders || []);
    }
    if (prefill.securityPolicy?.authorization?.allowedCIDRs && prefill.securityPolicy.authorization.allowedCIDRs.length > 0) {
      setIpAllowlistEnabled(true);
      setIpAllowlistCidrs(prefill.securityPolicy.authorization.allowedCIDRs);
    }

    // Apply BTP fields
    if (prefill.backendTrafficPolicy?.retry) {
      setRetryEnabled(true);
      const r = prefill.backendTrafficPolicy.retry;
      if (r.numRetries) setRetryNumRetries(String(r.numRetries));
      if (r.retryOn?.httpStatusCodes) setRetryHttpStatusCodes(r.retryOn.httpStatusCodes);
      if (r.retryOn?.triggers) setRetryTriggers(r.retryOn.triggers);
    }
    if (prefill.backendTrafficPolicy?.timeout) {
      setBtpTimeoutEnabled(true);
      const t = prefill.backendTrafficPolicy.timeout;
      if (t.tcp?.connectTimeout) setTcpConnectTimeout(t.tcp.connectTimeout);
      if (t.http?.requestTimeout) setHttpRequestTimeout(t.http.requestTimeout);
      if (t.http?.connectionIdleTimeout) setHttpConnectionIdleTimeout(t.http.connectionIdleTimeout);
      if (t.http?.maxConnectionDuration) setHttpMaxConnectionDuration(t.http.maxConnectionDuration);
      if (t.http?.maxStreamDuration) setHttpMaxStreamDuration(t.http.maxStreamDuration);
    }

    // Apply redirect fields
    if (prefill.redirect) {
      if (prefill.redirect.scheme) setRedirectScheme(prefill.redirect.scheme);
      if (prefill.redirect.hostname) setRedirectHostname(prefill.redirect.hostname);
      if (prefill.redirect.port) setRedirectPort(String(prefill.redirect.port));
      if (prefill.redirect.statusCode) setRedirectStatusCode(prefill.redirect.statusCode);
    }

    // Apply URL rewrite fields
    if (prefill.urlRewrite) {
      if (prefill.urlRewrite.hostname) {
        setRewriteHostnameEnabled(true);
        setRewriteHostname(prefill.urlRewrite.hostname);
      }
      if (prefill.urlRewrite.path) {
        setRewritePathEnabled(true);
        setRewritePathType(prefill.urlRewrite.path.type);
        setRewritePathValue(prefill.urlRewrite.path.replacePrefixMatch || prefill.urlRewrite.path.replaceFullPath || '');
      }
    }

    // Apply mirrors
    if (prefill.mirrors && prefill.mirrors.length > 0) {
      setMirrors(prefill.mirrors.map((m: any) => ({
        namespace: m.namespace || '',
        service: m.service || '',
        port: m.port || 80,
        services: [],
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, searchParams]);

  // Fetch project capabilities (e.g., rate limit availability)
  useEffect(() => {
    projectsApi.getCapabilities(projectId)
      .then(setCapabilities)
      .catch(() => {
        setCapabilitiesError(true);
        console.warn('Failed to fetch project capabilities - rate limit availability unknown');
      });
  }, [projectId]);

  // Check if AI is enabled
  useEffect(() => {
    aiApi.getStatus().then(status => setAiEnabled(status.enabled)).catch(() => {});
  }, []);

  // Load preview when entering preview tab
  useEffect(() => {
    if (activeTab === 'preview') {
      loadPreview();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoadError(null);
      const [domainData, teamsData, projectNamespacesData] = await Promise.all([
        domainsApi.get(projectId, domainId),
        projectTeamsApi.listMyTeams(projectId),
        projectNamespacesApi.list(projectId),
      ]);
      setDomain(domainData);
      setTeams(teamsData || []);
      // Map ProjectNamespace to K8sNamespace format, only include namespaces with ReferenceGrant
      const namespacesData = (projectNamespacesData || [])
        .filter(ns => ns.referenceGrantCreated)
        .map(ns => ({ name: ns.namespace, status: 'Active' }));
      setNamespaces(namespacesData);

      if (teamsData && teamsData.length > 0) {
        setValue('teamId', teamsData[0].team.id);
      }

      if (namespacesData && namespacesData.length > 0) {
        const firstNamespace = namespacesData[0].name;
        const servicesData = await kubernetesApi.listServices(projectId, firstNamespace);
        setBackends([{
          type: 'kubernetes',
          namespace: firstNamespace,
          service: servicesData && servicesData.length > 0 ? servicesData[0].name : '',
          port: servicesData && servicesData.length > 0 && servicesData[0].ports.length > 0
            ? servicesData[0].ports[0].port : 80,
          weight: 100,
          fallback: false,
          services: servicesData || [],
          addressType: 'fqdn',
          address: '',
          tlsEnabled: false,
          tlsMode: 'simple',
          insecureSkipVerify: false,
          sni: '',
          caCertificateRefs: [{ kind: 'ConfigMap', name: '', namespace: '' }],
          clientCertificateRef: { name: '', namespace: '' },
        }]);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setLoadError(error.response?.data?.error || 'Failed to load data. Please check the project connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Backend management functions
  const loadServicesForBackend = async (index: number, namespace: string) => {
    try {
      const servicesData = await kubernetesApi.listServices(projectId, namespace);
      setBackends(prev => prev.map((b, i) => i === index ? {
        ...b,
        namespace,
        services: servicesData || [],
        service: servicesData && servicesData.length > 0 ? servicesData[0].name : '',
        port: servicesData && servicesData.length > 0 && servicesData[0].ports.length > 0
          ? servicesData[0].ports[0].port : 80,
      } : b));
    } catch (error) {
      console.error('Failed to load services:', error);
      setBackends(prev => prev.map((b, i) => i === index ? {
        ...b,
        namespace,
        services: [],
        service: '',
      } : b));
    }
  };

  const addBackend = async () => {
    const defaultNamespace = namespaces.length > 0 ? namespaces[0].name : '';
    let services: K8sService[] = [];
    if (defaultNamespace) {
      try {
        services = await kubernetesApi.listServices(projectId, defaultNamespace) || [];
      } catch (error) {
        console.error('Failed to load services:', error);
      }
    }
    setBackends(prev => [...prev, {
      type: 'kubernetes',
      namespace: defaultNamespace,
      service: services.length > 0 ? services[0].name : '',
      port: services.length > 0 && services[0].ports.length > 0 ? services[0].ports[0].port : 80,
      weight: 100,
      fallback: false,
      services,
      addressType: 'fqdn',
      address: '',
      tlsEnabled: false,
      tlsMode: 'simple',
      insecureSkipVerify: false,
      sni: '',
      caCertificateRefs: [{ kind: 'ConfigMap', name: '', namespace: '' }],
      clientCertificateRef: { name: '', namespace: '' },
    }]);
  };

  const removeBackend = (index: number) => {
    if (backends.length > 1) {
      setBackends(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateBackend = (index: number, field: keyof Omit<BackendInput, 'services'>, value: string | number | boolean | Array<{ kind: 'Secret' | 'ConfigMap'; name: string; namespace: string }> | { name: string; namespace: string }) => {
    setBackends(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const updateBackendService = (index: number, serviceName: string) => {
    const backend = backends[index];
    const serviceData = backend.services.find(s => s.name === serviceName);
    setBackends(prev => prev.map((b, i) => i === index ? {
      ...b,
      service: serviceName,
      port: serviceData && serviceData.ports.length > 0 ? serviceData.ports[0].port : b.port,
    } : b));
  };

  const totalWeight = backends.reduce((sum, b) => sum + (b.weight || 0), 0);

  // Mirror management functions
  const loadServicesForMirror = async (index: number, namespace: string) => {
    try {
      const servicesData = await kubernetesApi.listServices(projectId, namespace);
      setMirrors(prev => prev.map((m, i) => i === index ? {
        ...m,
        namespace,
        services: servicesData || [],
        service: servicesData && servicesData.length > 0 ? servicesData[0].name : '',
        port: servicesData && servicesData.length > 0 && servicesData[0].ports.length > 0
          ? servicesData[0].ports[0].port : 80,
      } : m));
    } catch (error) {
      console.error('Failed to load services for mirror:', error);
      setMirrors(prev => prev.map((m, i) => i === index ? {
        ...m,
        namespace,
        services: [],
        service: '',
      } : m));
    }
  };

  const addMirror = async () => {
    const defaultNamespace = namespaces.length > 0 ? namespaces[0].name : '';
    let services: K8sService[] = [];
    if (defaultNamespace) {
      try {
        services = await kubernetesApi.listServices(projectId, defaultNamespace) || [];
      } catch (error) {
        console.error('Failed to load services:', error);
      }
    }
    setMirrors(prev => [...prev, {
      namespace: defaultNamespace,
      service: services.length > 0 ? services[0].name : '',
      port: services.length > 0 && services[0].ports.length > 0 ? services[0].ports[0].port : 80,
      services,
    }]);
  };

  const removeMirror = (index: number) => {
    setMirrors(prev => prev.filter((_, i) => i !== index));
  };

  const updateMirror = (index: number, field: keyof Omit<MirrorInput, 'services'>, value: string | number) => {
    setMirrors(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const updateMirrorService = (index: number, serviceName: string) => {
    const mirror = mirrors[index];
    const serviceData = mirror.services.find(s => s.name === serviceName);
    setMirrors(prev => prev.map((m, i) => i === index ? {
      ...m,
      service: serviceName,
      port: serviceData && serviceData.ports.length > 0 ? serviceData.ports[0].port : m.port,
    } : m));
  };

  // Header matching functions
  const addHeader = () => {
    setHeaders([...headers, { name: '', type: 'Exact', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: keyof HeaderMatchInput, value: string) => {
    const updated = [...headers];
    updated[index] = { ...updated[index], [field]: value };
    setHeaders(updated);
  };

  // Query param matching functions
  const addQueryParam = () => {
    setQueryParams([...queryParams, { name: '', type: 'Exact', value: '' }]);
  };

  const removeQueryParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const updateQueryParam = (index: number, field: keyof QueryParamMatchInput, value: string) => {
    const updated = [...queryParams];
    updated[index] = { ...updated[index], [field]: value };
    setQueryParams(updated);
  };

  // Request header modifier functions
  const addRequestHeaderModifier = () => {
    setRequestHeaderModifiers([...requestHeaderModifiers, { action: 'set', name: '', value: '' }]);
  };

  const removeRequestHeaderModifier = (index: number) => {
    setRequestHeaderModifiers(requestHeaderModifiers.filter((_, i) => i !== index));
  };

  const updateRequestHeaderModifier = (index: number, field: keyof HeaderModifierInput, value: string) => {
    const updated = [...requestHeaderModifiers];
    updated[index] = { ...updated[index], [field]: value };
    setRequestHeaderModifiers(updated);
  };

  // Response header modifier functions
  const addResponseHeaderModifier = () => {
    setResponseHeaderModifiers([...responseHeaderModifiers, { action: 'set', name: '', value: '' }]);
  };

  const removeResponseHeaderModifier = (index: number) => {
    setResponseHeaderModifiers(responseHeaderModifiers.filter((_, i) => i !== index));
  };

  const updateResponseHeaderModifier = (index: number, field: keyof HeaderModifierInput, value: string) => {
    const updated = [...responseHeaderModifiers];
    updated[index] = { ...updated[index], [field]: value };
    setResponseHeaderModifiers(updated);
  };

  // Build header modifier object from array
  const buildHeaderModifier = (modifiers: HeaderModifierInput[]) => {
    const validModifiers = modifiers.filter(m => m.name);
    if (validModifiers.length === 0) return undefined;

    const result: { set?: HeaderValue[]; add?: HeaderValue[]; remove?: string[] } = {};

    const setHeaders = validModifiers.filter(m => m.action === 'set' && m.value);
    const addHeaders = validModifiers.filter(m => m.action === 'add' && m.value);
    const removeHeaders = validModifiers.filter(m => m.action === 'remove');

    if (setHeaders.length > 0) {
      result.set = setHeaders.map(h => ({ name: h.name, value: h.value }));
    }
    if (addHeaders.length > 0) {
      result.add = addHeaders.map(h => ({ name: h.name, value: h.value }));
    }
    if (removeHeaders.length > 0) {
      result.remove = removeHeaders.map(h => h.name);
    }

    return Object.keys(result).length > 0 ? result : undefined;
  };

  // Build URL rewrite object
  const buildURLRewrite = (): { hostname?: string; path?: { type: 'ReplacePrefixMatch' | 'ReplaceFullPath'; replacePrefixMatch?: string; replaceFullPath?: string } } | undefined => {
    if (!rewriteHostnameEnabled && !rewritePathEnabled) return undefined;

    const result: { hostname?: string; path?: { type: 'ReplacePrefixMatch' | 'ReplaceFullPath'; replacePrefixMatch?: string; replaceFullPath?: string } } = {};

    if (rewriteHostnameEnabled && rewriteHostname) {
      result.hostname = rewriteHostname;
    }

    if (rewritePathEnabled && rewritePathValue) {
      result.path = {
        type: rewritePathType,
        ...(rewritePathType === 'ReplacePrefixMatch'
          ? { replacePrefixMatch: rewritePathValue }
          : { replaceFullPath: rewritePathValue }),
      };
    }

    return Object.keys(result).length > 0 ? result : undefined;
  };

  // Build CORS object
  const buildCORS = () => {
    if (!corsEnabled) return undefined;

    const cors: {
      allowOrigins?: string[];
      allowMethods?: string[];
      allowHeaders?: string[];
      exposeHeaders?: string[];
      maxAge?: number;
      allowCredentials?: boolean;
    } = {};

    if (corsAllowOrigins.length > 0) {
      cors.allowOrigins = corsAllowOrigins;
    }
    if (corsAllowMethods.length > 0) {
      cors.allowMethods = corsAllowMethods;
    }
    if (corsAllowHeaders.length > 0) {
      cors.allowHeaders = corsAllowHeaders;
    }
    if (corsExposeHeaders.length > 0) {
      cors.exposeHeaders = corsExposeHeaders;
    }
    if (corsMaxAge) {
      cors.maxAge = parseInt(corsMaxAge, 10);
    }
    if (corsAllowCredentials) {
      cors.allowCredentials = true;
    }

    return Object.keys(cors).length > 0 ? cors : undefined;
  };

  // Build backend traffic policy (compression + retry)
  const buildBackendTrafficPolicy = (): BackendTrafficPolicyInput | undefined => {
    const compression = (compressionEnabled && compressionTypes.length > 0)
      ? compressionTypes.map(type => ({
          type,
          ...(type === 'Gzip' ? { gzip: {} } : {}),
          ...(type === 'Brotli' ? { brotli: {} } : {}),
          ...(type === 'Zstd' ? { zstd: {} } : {}),
        }))
      : undefined;

    const retry = retryEnabled ? (() => {
      const r: RetryConfig = {};
      if (retryNumRetries) r.numRetries = parseInt(retryNumRetries, 10);

      const retryOn: RetryOn = {};
      if (retryHttpStatusCodes.length > 0) retryOn.httpStatusCodes = retryHttpStatusCodes;
      if (retryTriggers.length > 0) retryOn.triggers = retryTriggers;
      if (Object.keys(retryOn).length > 0) r.retryOn = retryOn;

      const perRetryPolicy: PerRetryPolicy = {};
      if (retryTimeout) perRetryPolicy.timeout = retryTimeout;
      const backOff: BackOffPolicy = {};
      if (retryBackOffBaseInterval) backOff.baseInterval = retryBackOffBaseInterval;
      if (retryBackOffMaxInterval) backOff.maxInterval = retryBackOffMaxInterval;
      if (Object.keys(backOff).length > 0) perRetryPolicy.backOff = backOff;
      if (Object.keys(perRetryPolicy).length > 0) r.perRetryPolicy = perRetryPolicy;

      return Object.keys(r).length > 0 ? r : undefined;
    })() : undefined;

    const loadBalancer = lbEnabled ? (() => {
      const lb: { type: LoadBalancerType; consistentHash?: { type: ConsistentHashType; header?: { name: string }; cookie?: { name: string; ttl?: string; attributes?: Record<string, string> } } } = {
        type: lbType,
      };
      if (lbType === 'ConsistentHash') {
        lb.consistentHash = { type: lbConsistentHashType };
        if (lbConsistentHashType === 'Header' && lbHeaderName) {
          lb.consistentHash.header = { name: lbHeaderName };
        }
        if (lbConsistentHashType === 'Cookie' && lbCookieName) {
          lb.consistentHash.cookie = { name: lbCookieName };
          if (lbCookieTTL) lb.consistentHash.cookie.ttl = lbCookieTTL;
          if (lbCookieAttributes.length > 0) {
            lb.consistentHash.cookie.attributes = Object.fromEntries(
              lbCookieAttributes.map(a => [a.key, a.value])
            );
          }
        }
      }
      return lb;
    })() : undefined;

    const circuitBreaker = cbEnabled ? (() => {
      const cb: CircuitBreakerConfig = {};
      if (cbMaxConnections) cb.maxConnections = parseInt(cbMaxConnections, 10);
      if (cbMaxPendingRequests) cb.maxPendingRequests = parseInt(cbMaxPendingRequests, 10);
      if (cbMaxParallelRequests) cb.maxParallelRequests = parseInt(cbMaxParallelRequests, 10);
      if (cbMaxParallelRetries) cb.maxParallelRetries = parseInt(cbMaxParallelRetries, 10);
      if (cbMaxRequestsPerConnection) cb.maxRequestsPerConnection = parseInt(cbMaxRequestsPerConnection, 10);
      return Object.keys(cb).length > 0 ? cb : undefined;
    })() : undefined;

    const healthCheck = hcEnabled ? (() => {
      const hc: HealthCheckConfig = {};

      if (hcActiveEnabled) {
        const active: ActiveHealthCheckConfig = { type: hcActiveType };
        if (hcActiveTimeout) active.timeout = hcActiveTimeout;
        if (hcActiveInterval) active.interval = hcActiveInterval;
        if (hcActiveUnhealthyThreshold) active.unhealthyThreshold = parseInt(hcActiveUnhealthyThreshold, 10);
        if (hcActiveHealthyThreshold) active.healthyThreshold = parseInt(hcActiveHealthyThreshold, 10);

        if (hcActiveType === 'HTTP') {
          active.http = { path: hcHttpPath || '/healthz' };
          if (hcHttpMethod && hcHttpMethod !== 'GET') active.http.method = hcHttpMethod;
          if (hcHttpExpectedStatuses.length > 0) active.http.expectedStatuses = hcHttpExpectedStatuses;
        } else if (hcActiveType === 'TCP') {
          const tcp: TCPActiveHealthCheckConfig = {};
          if (hcTcpSendText) tcp.send = { type: 'Text', text: hcTcpSendText };
          if (hcTcpReceiveText) tcp.receive = { type: 'Text', text: hcTcpReceiveText };
          active.tcp = tcp;
        } else if (hcActiveType === 'GRPC') {
          active.grpc = hcGrpcService ? { service: hcGrpcService } : {};
        }
        hc.active = active;
      }

      if (hcPassiveEnabled) {
        const passive: PassiveHealthCheckConfig = {};
        if (hcPassiveConsecutiveGatewayErrors) passive.consecutiveGatewayErrors = parseInt(hcPassiveConsecutiveGatewayErrors, 10);
        if (hcPassiveConsecutive5xxErrors) passive.consecutive5xxErrors = parseInt(hcPassiveConsecutive5xxErrors, 10);
        if (hcPassiveInterval) passive.interval = hcPassiveInterval;
        if (hcPassiveBaseEjectionTime) passive.baseEjectionTime = hcPassiveBaseEjectionTime;
        if (Object.keys(passive).length > 0) hc.passive = passive;
      }

      if (hcPanicThreshold) hc.panicThreshold = parseInt(hcPanicThreshold, 10);
      return Object.keys(hc).length > 0 ? hc : undefined;
    })() : undefined;

    const faultInjection = fiEnabled ? (() => {
      const fi: FaultInjectionConfig = {};

      if (fiDelayEnabled && fiDelayFixedDelay) {
        const delay: FaultInjectionDelayConfig = { fixedDelay: fiDelayFixedDelay };
        if (fiDelayPercentage) delay.percentage = parseFloat(fiDelayPercentage);
        fi.delay = delay;
      }

      if (fiAbortEnabled) {
        const abort: FaultInjectionAbortConfig = {};
        if (fiAbortType === 'http' && fiAbortHttpStatus) {
          abort.httpStatus = parseInt(fiAbortHttpStatus, 10);
        } else if (fiAbortType === 'grpc' && fiAbortGrpcStatus) {
          abort.grpcStatus = parseInt(fiAbortGrpcStatus, 10);
        }
        if (fiAbortPercentage) abort.percentage = parseFloat(fiAbortPercentage);
        if (abort.httpStatus != null || abort.grpcStatus != null) {
          fi.abort = abort;
        }
      }

      return (fi.delay || fi.abort) ? fi : undefined;
    })() : undefined;

    const timeout = btpTimeoutEnabled ? (() => {
      const t: BTPTimeoutConfig = {};
      if (tcpConnectTimeout) {
        t.tcp = { connectTimeout: tcpConnectTimeout };
      }
      const http: BTPTimeoutConfig['http'] = {};
      if (httpRequestTimeout) http.requestTimeout = httpRequestTimeout;
      if (httpConnectionIdleTimeout) http.connectionIdleTimeout = httpConnectionIdleTimeout;
      if (httpMaxConnectionDuration) http.maxConnectionDuration = httpMaxConnectionDuration;
      if (httpMaxStreamDuration) http.maxStreamDuration = httpMaxStreamDuration;
      if (Object.keys(http).length > 0) t.http = http;
      return Object.keys(t).length > 0 ? t : undefined;
    })() : undefined;

    if (!compression && !retry && !loadBalancer && !circuitBreaker && !healthCheck && !faultInjection && !rateLimit && !requestBuffer && responseOverride.length === 0 && !timeout) return undefined;
    return {
      ...(compression && { compression }),
      ...(retry && { retry }),
      ...(loadBalancer && { loadBalancer }),
      ...(circuitBreaker && { circuitBreaker }),
      ...(healthCheck && { healthCheck }),
      ...(faultInjection && { faultInjection }),
      ...(rateLimit && { rateLimit }),
      ...(requestBuffer && { requestBuffer }),
      ...(responseOverride.length > 0 && { responseOverride }),
      ...(timeout && { timeout }),
    };
  };

  // Client attachment helpers
  const openAttachClientModal = async () => {
    setShowAttachClientModal(true);
    setLoadingClients(true);
    try {
      const data = await clientsApi.list(1, 100);
      setClientsList(data.data);
    } catch {
      setClientsList([]);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleAddAttachmentLocally = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClient = clientsList.find(c => c.id === attachClientForm.clientId);
    if (!selectedClient) return;

    setPendingAttachments([...pendingAttachments, {
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      teamName: selectedClient.team?.name || 'Unknown',
      apiKeyEnabled: selectedClient.apiKeyEnabled,
      jwtEnabled: selectedClient.jwtEnabled,
      enableIpAllowlist: attachClientForm.enableIpAllowlist,
      enableApiKey: attachClientForm.enableApiKey,
      enableJwt: attachClientForm.enableJwt,
      enableBasicAuth: attachClientForm.enableBasicAuth,
      enableMtls: attachClientForm.enableMtls,
      enableHeaderAuth: attachClientForm.enableHeaderAuth,
      rateLimitConfig: attachRateLimitConfig,
    }]);

    setShowAttachClientModal(false);
    setAttachClientForm({
      clientId: '',
      enableIpAllowlist: true,
      enableApiKey: false,
      enableJwt: false,
      enableBasicAuth: false,
      enableMtls: false,
      enableHeaderAuth: false,
    });
    setAttachRateLimitConfig(undefined);
    setClientsList([]);
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments(pendingAttachments.filter((_, i) => i !== index));
  };

  const parseArrayInput = (value: string): string[] => {
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  // Build redirect configuration
  const buildRedirect = () => {
    if (routeType !== 'redirect') return undefined;

    const redirect: {
      scheme?: string;
      hostname?: string;
      port?: number;
      statusCode?: number;
      path?: { type: 'ReplacePrefixMatch' | 'ReplaceFullPath'; replacePrefixMatch?: string; replaceFullPath?: string };
    } = {};

    if (redirectScheme) {
      redirect.scheme = redirectScheme;
    }
    if (redirectHostname) {
      redirect.hostname = redirectHostname;
    }
    if (redirectPort) {
      redirect.port = parseInt(redirectPort, 10);
    }
    if (redirectStatusCode) {
      redirect.statusCode = redirectStatusCode;
    }
    if (redirectPathEnabled && redirectPathValue) {
      redirect.path = {
        type: redirectPathType,
        ...(redirectPathType === 'ReplacePrefixMatch'
          ? { replacePrefixMatch: redirectPathValue }
          : { replaceFullPath: redirectPathValue }),
      };
    }

    return Object.keys(redirect).length > 0 ? redirect : undefined;
  };

  // Build direct response configuration
  const buildDirectResponse = () => {
    if (routeType !== 'directResponse') return undefined;

    const statusCode = parseInt(drStatusCode, 10);
    if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) return undefined;

    const directResponse: {
      statusCode: number;
      contentType?: string;
      body?: { type: 'Inline'; inline: string };
    } = {
      statusCode,
    };

    if (drContentType) {
      directResponse.contentType = drContentType;
    }
    if (drBody) {
      directResponse.body = {
        type: 'Inline',
        inline: drBody,
      };
    }

    return directResponse;
  };

  const buildSecurityPolicy = (): SecurityPolicyInput | undefined => {
    const policy: SecurityPolicyInput = {};

    // CORS (both modes)
    const cors = buildCORS();
    if (cors) policy.cors = cors;

    // General mode fields
    if (securityMode === 'general') {
      if (ipAllowlistEnabled || headerMethodAuthEnabled) {
        const authorization: any = {};
        if (ipAllowlistEnabled && ipAllowlistCidrs.length > 0) {
          authorization.allowedCIDRs = ipAllowlistCidrs;
        }
        if (headerMethodAuthEnabled) {
          if (authHeaders.length > 0) {
            authorization.headers = authHeaders
              .filter(h => h.name.trim())
              .map(h => ({
                name: h.name.trim(),
                values: h.values.split(',').map((v: string) => v.trim()).filter(Boolean),
              }));
          }
          if (authMethods.length > 0) {
            authorization.methods = authMethods;
          }
        }
        if (Object.keys(authorization).length > 0) {
          policy.authorization = authorization;
        }
      }
      if (apiKeyAuthEnabled && apiKeySecretName) {
        policy.apiKeyAuth = { secretName: apiKeySecretName, headerName: apiKeyHeaderName || 'x-api-key' };
      }
      if (jwtAuthEnabled && jwtIssuer) {
        policy.jwt = {
          issuer: jwtIssuer,
          jwksUrl: jwtJwksUrl,
          audiences: jwtAudiences.length > 0 ? jwtAudiences : undefined,
          claimToHeaders: jwtClaimToHeaders.length > 0 ? jwtClaimToHeaders : undefined,
        };
      }
      if (oidcEnabled && oidcIssuer) {
        policy.oidc = {
          issuer: oidcIssuer,
          clientId: oidcClientId,
          clientSecretName: oidcClientSecretName,
          redirectURL: oidcRedirectUrl,
          logoutPath: oidcLogoutPath,
          scopes: oidcScopes.length > 0 ? oidcScopes : undefined,
          cookieDomain: oidcCookieDomain || undefined,
        };
      }
    }

    // External Authorization (both modes)
    if (extAuthEnabled && extAuthServiceName) {
      const backendRef = {
        name: extAuthServiceName,
        ...(extAuthServiceNamespace && { namespace: extAuthServiceNamespace }),
        port: extAuthServicePort,
      };

      policy.extAuth = {
        type: extAuthType,
        ...(extAuthType === 'http' && {
          http: {
            backendRef,
            path: extAuthPath,
            ...(extAuthHeadersToBackend.length > 0 && { headersToBackend: extAuthHeadersToBackend }),
          },
        }),
        ...(extAuthType === 'grpc' && {
          grpc: { backendRef },
        }),
        ...(extAuthFailOpen && { failOpen: true }),
        ...(extAuthHeadersToExtAuth.length > 0 && { headersToExtAuth: extAuthHeadersToExtAuth }),
        ...(extAuthHeadersToDownstreamOnDeny.length > 0 && { headersToDownstreamOnDeny: extAuthHeadersToDownstreamOnDeny }),
        ...(extAuthHeadersToDownstreamOnAllow.length > 0 && { headersToDownstreamOnAllow: extAuthHeadersToDownstreamOnAllow }),
        ...(extAuthHeadersToUpstreamOnAllow.length > 0 && { headersToUpstreamOnAllow: extAuthHeadersToUpstreamOnAllow }),
        ...(extAuthIncludeBody && { withRequestBody: { maxBytes: extAuthMaxBodyBytes } }),
      };
    }

    return Object.keys(policy).length > 0 ? policy : undefined;
  };

  // Build extension policy
  const buildExtensionPolicy = (): EnvoyExtensionPolicyConfig | undefined => {
    if (!luaExtension && !wasmExtension && !extProcExtension) return undefined;
    return {
      ...(luaExtension && { lua: luaExtension }),
      ...(wasmExtension && { wasm: wasmExtension }),
      ...(extProcExtension && { extProc: extProcExtension }),
    };
  };

  // Build route data from form values
  const buildRouteData = (data: RouteFormData): CreateRouteInput => {
    const matchObj: any = {};

    if (data.protocol === 'grpc') {
      // gRPC-specific matching
      if (data.grpcServiceValue) {
        matchObj.grpcService = {
          type: data.grpcServiceType || 'Exact',
          value: data.grpcServiceValue,
        };
      }
      if (data.grpcMethodValue) {
        matchObj.grpcMethod = {
          type: data.grpcMethodType || 'Exact',
          value: data.grpcMethodValue,
        };
      }
    } else {
      // HTTP-specific matching
      matchObj.path = {
        type: data.pathType,
        value: data.pathValue,
      };
      if (data.method) {
        matchObj.method = data.method;
      }
      const validQueryParams = queryParams.filter(qp => qp.name && qp.value);
      if (validQueryParams.length > 0) {
        matchObj.queryParams = validQueryParams;
      }
    }

    // Headers are shared between HTTP and gRPC
    const validHeaders = headers.filter(h => h.name && h.value);
    if (validHeaders.length > 0) {
      matchObj.headers = validHeaders;
    }

    // Request header modifier is only for backend routes (not direct response or redirect)
    const requestHeaderModifier = routeType === 'backend' ? buildHeaderModifier(requestHeaderModifiers) : undefined;
    // Response header modifier is for backend and direct response routes
    const responseHeaderModifier = routeType !== 'redirect' ? buildHeaderModifier(responseHeaderModifiers) : undefined;
    const urlRewrite = routeType === 'backend' && data.protocol !== 'grpc' ? buildURLRewrite() : undefined;
    const securityPolicy = buildSecurityPolicy();
    // Backend traffic policy is only for backend routes
    const backendTrafficPolicy = routeType === 'backend' ? buildBackendTrafficPolicy() : undefined;
    // Extension policy is only for backend routes
    const extensionPolicy = routeType === 'backend' ? buildExtensionPolicy() : undefined;
    const redirect = buildRedirect();
    const directResponse = buildDirectResponse();

    // Build TLS config for any backend type
    const buildTlsConfig = (b: BackendInput) => {
      if (!b.tlsEnabled) return undefined;
      return {
        mode: b.tlsMode,
        insecureSkipVerify: b.insecureSkipVerify === true ? true : undefined,
        sni: b.sni.trim() || undefined,
        caCertificateRefs: !b.insecureSkipVerify ? b.caCertificateRefs
          .filter(ref => ref.name.trim() !== '')
          .map(ref => ({
            kind: ref.kind,
            name: ref.name,
            namespace: ref.namespace || undefined,
          })) : undefined,
        clientCertificateRef: b.tlsMode === 'mtls' && b.clientCertificateRef.name.trim() !== '' ? {
          name: b.clientCertificateRef.name,
          namespace: b.clientCertificateRef.namespace || undefined,
        } : undefined,
      };
    };

    const routeBackends = routeType === 'backend' ? backends.map(b => {
      if (b.type === 'external') {
        return {
          type: 'external' as const,
          port: b.port,
          weight: b.fallback ? 0 : b.weight,
          fallback: b.fallback || undefined,
          addressType: b.addressType,
          address: b.address,
          tls: buildTlsConfig(b),
        };
      }
      return {
        type: 'kubernetes' as const,
        service: b.service,
        namespace: b.namespace,
        port: b.port,
        weight: b.fallback ? 0 : b.weight,
        fallback: b.fallback || undefined,
        tls: buildTlsConfig(b),
      };
    }) : [];

    // Build mirrors (only for backend routes)
    const routeMirrors = routeType === 'backend' && mirrors.length > 0 ? mirrors.map(m => ({
      type: 'kubernetes' as const,
      service: m.service,
      namespace: m.namespace,
      port: m.port,
    })) : undefined;

    return {
      name: data.name,
      description: data.description,
      protocol: data.protocol,
      securityMode: securityMode,
      teamId: data.teamId,
      config: {
        routeType,
        matches: [matchObj],
        backends: routeBackends,
        ...(routeMirrors && { mirrors: routeMirrors }),
        ...(redirect && { redirect }),
        ...(directResponse && { directResponse }),
        ...(requestHeaderModifier && { requestHeaderModifier }),
        ...(responseHeaderModifier && { responseHeaderModifier }),
        ...(urlRewrite && { urlRewrite }),
        ...(defaultTrafficPolicy !== 'allow_all' && { defaultTrafficPolicy }),
        ...(defaultTrafficPolicy === 'require_ip_allowlist' && defaultAllowedCIDRs.length > 0 && { defaultAllowedCIDRs }),
      },
      ...(securityPolicy && { securityPolicy }),
      ...(backendTrafficPolicy && { backendTrafficPolicy }),
      ...(extensionPolicy && { extensionPolicy }),
      ...(wafPolicy && { wafPolicy }),
      ...(Object.keys(labels).length > 0 && { labels }),
    };
  };

  // Tab validation
  const validateBasicTab = async (): Promise<boolean> => {
    const result = await trigger(['name', 'teamId']);
    if (!result) {
      setTabErrors(prev => ({ ...prev, basic: 'Please fill in all required fields' }));
      return false;
    }
    setTabErrors(prev => ({ ...prev, basic: null }));
    return true;
  };

  const validateTrafficTab = (): boolean => {
    if (routeType === 'backend') {
      if (backends.length === 0) {
        setTabErrors(prev => ({ ...prev, traffic: 'At least one backend is required' }));
        return false;
      }
      const invalidBackend = backends.find(b => {
        if (b.type === 'external') {
          return !b.address || !b.port;
        }
        return !b.namespace || !b.service;
      });
      if (invalidBackend) {
        const errorMsg = invalidBackend.type === 'external'
          ? 'Please provide address and port for all external backends'
          : 'Please select a namespace and service for all Kubernetes backends';
        setTabErrors(prev => ({ ...prev, traffic: errorMsg }));
        return false;
      }
    } else if (routeType === 'directResponse') {
      const statusCode = parseInt(drStatusCode, 10);
      if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
        setTabErrors(prev => ({ ...prev, traffic: 'Status code must be between 100 and 599' }));
        return false;
      }
      if (drBody && drBody.length > 4096) {
        setTabErrors(prev => ({ ...prev, traffic: 'Response body cannot exceed 4096 bytes' }));
        return false;
      }
    }

    // Backend and redirect routes: require path matching (HTTP only, not gRPC)
    if (routeType !== 'directResponse' && watchProtocol !== 'grpc') {
      const pathValue = watch('pathValue');
      if (!pathValue || pathValue.trim() === '') {
        setTabErrors(prev => ({ ...prev, traffic: 'Path matching is required' }));
        return false;
      }
    }

    setTabErrors(prev => ({ ...prev, traffic: null }));
    return true;
  };

  const validateSecurityTab = (): boolean => {
    // Security tab is optional, no validation needed
    setTabErrors(prev => ({ ...prev, security: null }));
    return true;
  };

  // Tab navigation
  const tabs: TabValue[] = ['basic', 'traffic', 'security', 'clients', 'preview'];

  const goToNextTab = async () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      let isValid = true;

      if (activeTab === 'basic') {
        isValid = await validateBasicTab();
      } else if (activeTab === 'traffic') {
        isValid = validateTrafficTab();
      } else if (activeTab === 'security') {
        isValid = validateSecurityTab();
      }

      if (isValid) {
        setActiveTab(tabs[currentIndex + 1]);
      }
    }
  };

  const goToPrevTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  // Load preview YAML
  const loadPreview = async () => {
    const formValues = watch();

    if (!formValues.name || !formValues.teamId) {
      setPreviewError('Please fill in required fields (name, team)');
      return;
    }

    if (routeType === 'backend') {
      const invalidBackend = backends.find(b => {
        if (b.type === 'external') {
          return !b.address || !b.port;
        }
        return !b.namespace || !b.service;
      });
      if (invalidBackend) {
        setPreviewError('Please configure all backends properly (namespace and service are required)');
        return;
      }
    } else if (routeType === 'directResponse') {
      const statusCode = parseInt(drStatusCode, 10);
      if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
        setPreviewError('Status code must be between 100 and 599');
        return;
      }
    }

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const routeData = buildRouteData(formValues);
      const result = await routesApi.previewCreate(projectId, domainId, routeData);
      setPreviewYaml(result.proposedYaml);
      setPreviewSecurityPolicyYaml(result.proposedSecurityPolicyYaml || '');
      setPreviewBackendTrafficPolicyYaml(result.proposedBackendTrafficPolicyYaml || '');
      setPreviewEnvoyExtensionPolicyYaml(result.proposedEnvoyExtensionPolicyYaml || '');
      setPreviewBackendYaml(result.proposedBackendYaml || '');
      setPreviewHttpRouteFilterYaml(result.proposedHttpRouteFilterYaml || '');
      setPreviewConfigMapYaml(result.proposedConfigMapYaml || '');
    } catch (error: any) {
      console.error('Failed to generate preview:', error);
      setPreviewError(error.response?.data?.error || 'Failed to generate preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getRouteContext = useCallback(async (): Promise<AIChatContext> => {
    try {
      const formValues = watch();
      const routeData = buildRouteData(formValues);
      const result = await routesApi.previewCreate(projectId, domainId, routeData);
      return {
        type: 'route' as const,
        route: {
          httpRoute: result.proposedYaml || '',
          securityPolicy: result.proposedSecurityPolicyYaml || '',
          backendTrafficPolicy: result.proposedBackendTrafficPolicyYaml || '',
          envoyExtensionPolicy: result.proposedEnvoyExtensionPolicyYaml || '',
          backend: result.proposedBackendYaml || '',
          httpRouteFilter: result.proposedHttpRouteFilterYaml || '',
          configMap: result.proposedConfigMapYaml || '',
        },
      };
    } catch {
      return { type: 'route' };
    }
  }, [watch, buildRouteData, projectId, domainId]);

  const handleAIReview = async () => {
    setIsLoadingReview(true);
    setReviewError(null);
    try {
      const result = await aiApi.review(projectId, domainId, {
        action: 'create',
        description: changeDescription || undefined,
        proposedYaml: {
          httpRoute: previewYaml || undefined,
          securityPolicy: previewSecurityPolicyYaml || undefined,
          backendTrafficPolicy: previewBackendTrafficPolicyYaml || undefined,
          envoyExtensionPolicy: previewEnvoyExtensionPolicyYaml || undefined,
        },
      });
      setAiReviewResult(result);
    } catch (error: any) {
      setReviewError(error.message || 'Failed to get AI review');
    } finally {
      setIsLoadingReview(false);
    }
  };

  // Generate rewrite preview
  const getRewritePreview = () => {
    const pathMatch = watchPathType;
    const pathValue = watch('pathValue') || '/api';
    const originalHost = domain?.hostname || 'example.com';

    let previewPath = pathValue + '/users';
    let previewHost = originalHost;

    if (rewriteHostnameEnabled && rewriteHostname) {
      previewHost = rewriteHostname;
    }

    if (rewritePathEnabled && rewritePathValue) {
      if (rewritePathType === 'ReplacePrefixMatch' && pathMatch === 'Prefix') {
        previewPath = rewritePathValue + '/users';
      } else if (rewritePathType === 'ReplaceFullPath') {
        previewPath = rewritePathValue;
      }
    }

    return {
      original: { host: originalHost, path: pathValue + '/users' },
      rewritten: { host: previewHost, path: previewPath },
    };
  };

  const onSubmit = async (data: RouteFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitWarnings([]);

    try {
      const routeData = buildRouteData(data);
      routeData.changeDescription = changeDescription || undefined;
      routeData.aiReview = aiReviewResult || undefined;
      const createdRoute = await routesApi.create(projectId, domainId, routeData);
      signalCreatedFromPrefill(searchParams.get('prefill'), createdRoute.id, createdRoute.name);

      // Auto-submit client attachments
      const attachErrors: string[] = [];
      for (const att of pendingAttachments) {
        try {
          await clientAttachmentsApi.attachFromRoute(projectId, domainId, createdRoute.id, {
            clientId: att.clientId,
            enableIpAllowlist: att.enableIpAllowlist,
            enableApiKey: att.enableApiKey,
            enableJwt: att.enableJwt,
            enableBasicAuth: att.enableBasicAuth,
            enableMtls: att.enableMtls,
            enableHeaderAuth: att.enableHeaderAuth,
            rateLimitConfig: att.rateLimitConfig,
          });
        } catch (err: any) {
          attachErrors.push(`Failed to attach ${att.clientName}: ${err.response?.data?.error || err.message}`);
        }
      }

      const warnings = createdRoute.warnings ?? [];
      if (warnings.length > 0) {
        setSubmitWarnings(warnings);
      }

      if (attachErrors.length > 0) {
        setSubmitError(`Route created but some client attachments failed:\n${attachErrors.join('\n')}`);
      }

      // Delay redirect when there is anything for the user to read.
      if (attachErrors.length > 0 || warnings.length > 0) {
        setTimeout(() => router.push(`/projects/${projectId}/domains/${domainId}`), 3000);
      } else {
        router.push(`/projects/${projectId}/domains/${domainId}`);
      }
    } catch (error: any) {
      console.error('Failed to create route:', error);
      setSubmitError(error.response?.data?.error || 'Failed to create route');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pathTypeOptions = [
    { value: 'Prefix', label: 'Prefix - Matches paths starting with this value' },
    { value: 'Exact', label: 'Exact - Matches this exact path only' },
    { value: 'RegularExpression', label: 'Regex - Matches using regular expression' },
  ];

  const protocolOptions = [
    { value: 'http', label: 'HTTP' },
    { value: 'grpc', label: 'gRPC' },
  ];

  const methodOptions = [
    { value: '', label: 'Any method' },
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'PATCH', label: 'PATCH' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'HEAD', label: 'HEAD' },
    { value: 'OPTIONS', label: 'OPTIONS' },
  ];

  const matchTypeOptions = [
    { value: 'Exact', label: 'Exact' },
    { value: 'RegularExpression', label: 'Regex' },
  ];

  const getPathPlaceholder = () => {
    switch (watchPathType) {
      case 'Exact':
        return '/api/v1/users';
      case 'RegularExpression':
        return '^/api/v[0-9]+/.*';
      default:
        return '/api';
    }
  };

  const getPathHelperText = () => {
    switch (watchPathType) {
      case 'Exact':
        return 'Enter the exact path that should be matched';
      case 'RegularExpression':
        return 'Enter a valid regular expression pattern';
      default:
        return 'Enter the path prefix to match (e.g., /api will match /api, /api/users, etc.)';
    }
  };

  // Count configured items for badges
  const getTrafficBadgeCount = () => {
    let count = 0;
    if (routeType === 'backend' && backends.some(b => b.service || b.address)) count++;
    if (routeType === 'redirect') count++;
    if (headers.length > 0 || queryParams.length > 0) count++;
    if (requestHeaderModifiers.length > 0 || responseHeaderModifiers.length > 0) count++;
    if (rewriteHostnameEnabled || rewritePathEnabled) count++;
    if (btpTimeoutEnabled && (tcpConnectTimeout || httpRequestTimeout || httpConnectionIdleTimeout || httpMaxConnectionDuration || httpMaxStreamDuration)) count++;
    if (compressionEnabled && compressionTypes.length > 0) count++;
    if (retryEnabled) count++;
    if (lbEnabled) count++;
    if (cbEnabled) count++;
    if (hcEnabled) count++;
    if (fiEnabled) count++;
    if (rateLimit) count++;
    if (requestBuffer) count++;
    if (responseOverride.length > 0) count++;
    return count;
  };

  const getSecurityBadgeCount = () => {
    let count = corsEnabled ? 1 : 0;
    if (securityMode === 'general') {
      if (ipAllowlistEnabled) count++;
      if (headerMethodAuthEnabled) count++;
      if (apiKeyAuthEnabled) count++;
      if (jwtAuthEnabled) count++;
      if (oidcEnabled) count++;
    }
    // ExtAuth applies to both modes
    if (extAuthEnabled) count++;
    return count;
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href={`/projects/${projectId}/domains/${domainId}`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {domain?.hostname}
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Route</h1>
          <p className="text-gray-600 mt-1">
            Configure a new route for {domain?.hostname}
          </p>
        </div>
        {aiEnabled && (
          <Button variant="secondary" onClick={() => setChatPanelOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            AI Help
          </Button>
        )}
      </div>

      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {submitError}
        </div>
      )}

      {submitWarnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Route created with warnings</p>
            <ul className="text-sm mt-1 list-disc list-inside space-y-1">
              {submitWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loadError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading data</p>
            <p className="text-sm mt-1">{loadError}</p>
          </div>
        </div>
      )}

      {teams.length === 0 && !loadError && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">You are not a member of any team in this project</p>
            <p className="text-sm mt-1">
              You need to be a member of at least one team assigned to this project to create routes.
              Contact a project admin to add you to a team.
            </p>
          </div>
        </div>
      )}

      {renderNL ? (
        watchTeamId ? (
          <AIImportWizard
            projectId={projectId}
            domainId={domainId}
            mode="natural_language"
            teamId={watchTeamId}
            onBack={() => router.push(`/projects/${projectId}/domains/${domainId}`)}
          />
        ) : (
          <p className="text-sm text-gray-500">Select a team to continue.</p>
        )
      ) : (
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} defaultValue="basic">
              <TabsList className="mb-6">
                <TabsTrigger value="basic">
                  Basic Info
                  {tabErrors.basic && <span className="ml-1 text-red-500">*</span>}
                </TabsTrigger>
                <TabsTrigger value="traffic">
                  Traffic
                  {getTrafficBadgeCount() > 0 && (
                    <Badge variant="default" className="ml-2 text-xs">{getTrafficBadgeCount()}</Badge>
                  )}
                  {tabErrors.traffic && <span className="ml-1 text-red-500">*</span>}
                </TabsTrigger>
                <TabsTrigger value="extensions">
                  Extensions
                  {(luaExtension || wasmExtension || extProcExtension) && (
                    <Badge variant="default" className="ml-2 text-xs">{(luaExtension ? 1 : 0) + (wasmExtension ? 1 : 0) + (extProcExtension ? 1 : 0)}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="security">
                  Security
                  {getSecurityBadgeCount() > 0 && (
                    <Badge variant="default" className="ml-2 text-xs">{getSecurityBadgeCount()}</Badge>
                  )}
                </TabsTrigger>
                {securityMode === 'client' && (
                <TabsTrigger value="clients">
                  Clients
                  {pendingAttachments.length > 0 && (
                    <Badge variant="default" className="ml-2 text-xs">{pendingAttachments.length}</Badge>
                  )}
                </TabsTrigger>
                )}
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic">
                <div className="space-y-6">
                  <div>
                    <Input
                      id="name"
                      label="Route Name"
                      placeholder="e.g., user-api"
                      {...register('name', {
                        required: 'Name is required',
                        maxLength: { value: 63, message: 'Name must be 63 characters or less' },
                        pattern: {
                          value: /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/,
                          message: 'Must be lowercase, start with a letter, contain only letters, numbers, and dashes',
                        },
                        validate: {
                          noSpaces: (v) => !v.includes(' ') || 'Name cannot contain spaces',
                          noConsecutiveDashes: (v) => !v.includes('--') || 'Name cannot contain consecutive dashes',
                        },
                      })}
                      error={errors.name?.message}
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Lowercase letters, numbers, and dashes only. Must start with a letter.
                    </p>
                  </div>

                  <Input
                    id="description"
                    label="Description"
                    placeholder="Optional description for this route"
                    {...register('description')}
                  />

                  <LabelsEditor labels={labels} onChange={setLabels} />

                  <div className="w-full">
                    <label htmlFor="teamId" className="block text-sm font-medium text-gray-700 mb-1">
                      Owner Team<InfoTooltip text="The team responsible for this route. Affects which team members can edit it and the approval workflow." />
                    </label>
                  </div>
                  <Select
                    id="teamId"
                    options={[
                      { value: '', label: teams.length === 0 ? 'No teams available' : 'Select a team...' },
                      ...teams.map((ptr) => ({ value: ptr.team.id, label: ptr.team.name }))
                    ]}
                    {...register('teamId', {
                      required: 'Team is required',
                      validate: (v) => v !== '' || 'Please select a team'
                    })}
                    error={errors.teamId?.message}
                  />

                  <div className="w-full">
                    <label htmlFor="protocol" className="block text-sm font-medium text-gray-700 mb-1">
                      Protocol<InfoTooltip text="gRPC routes use GRPCRoute CRD. Some features are not available: redirect, direct response, URL rewrite, path matching, and route-level timeouts." />
                    </label>
                  </div>
                  <Select
                    id="protocol"
                    options={protocolOptions}
                    {...register('protocol')}
                  />

                  {tabErrors.basic && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {tabErrors.basic}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Traffic Tab */}
              <TabsContent value="traffic">
                <Accordion type="multiple" defaultValue={['route-backend']}>
                  {/* Route Type & Backend Section */}
                  <AccordionItem value="route-backend">
                    <AccordionTrigger
                      value="route-backend"
                      badge={
                        <Badge variant={routeType === 'backend' ? 'success' : routeType === 'directResponse' ? 'default' : 'warning'}>
                          {routeType === 'backend' ? 'Backend' : routeType === 'directResponse' ? 'Direct Response' : 'Redirect'}
                        </Badge>
                      }
                    >
                      Route Type & Backend
                    </AccordionTrigger>
                    <AccordionContent value="route-backend">
                      <div className="space-y-4">
                        {/* Route Type Selector */}
                        <div className={`grid ${watch('protocol') === 'grpc' ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                          <label
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              routeType === 'backend'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="routeType"
                              value="backend"
                              checked={routeType === 'backend'}
                              onChange={() => setRouteType('backend')}
                              className="sr-only"
                            />
                            <div className="font-medium text-gray-900 mb-1">Forward to Backend</div>
                            <div className="text-sm text-gray-500">
                              {watch('protocol') === 'grpc' ? 'Route gRPC traffic to a backend service' : 'Route traffic to a Kubernetes service'}
                            </div>
                          </label>

                          {watch('protocol') !== 'grpc' && (
                          <label
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              routeType === 'redirect'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="routeType"
                              value="redirect"
                              checked={routeType === 'redirect'}
                              onChange={() => setRouteType('redirect')}
                              className="sr-only"
                            />
                            <div className="font-medium text-gray-900 mb-1">HTTP Redirect</div>
                            <div className="text-sm text-gray-500">
                              Redirect to a different URL
                            </div>
                          </label>
                          )}

                          {watch('protocol') !== 'grpc' && (
                          <label
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              routeType === 'directResponse'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="routeType"
                              value="directResponse"
                              checked={routeType === 'directResponse'}
                              onChange={() => setRouteType('directResponse')}
                              className="sr-only"
                            />
                            <div className="font-medium text-gray-900 mb-1">Direct Response</div>
                            <div className="text-sm text-gray-500">
                              Return a static response
                            </div>
                          </label>
                          )}
                        </div>

                        {/* Backend Configuration */}
                        {routeType === 'backend' && (
                          <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-sm font-medium text-gray-700">Backend Services</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                  {backends.length > 1
                                    ? `Traffic will be split across ${backends.length} backends based on weights`
                                    : 'Add more backends to enable traffic splitting (e.g. canary deployments with 90/10 weight)'}
                                </p>
                              </div>
                              <Button type="button" size="sm" variant="secondary" onClick={addBackend}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Backend
                              </Button>
                            </div>

                            {backends.length > 1 && (
                              <div className={`p-3 rounded-lg text-sm ${totalWeight === 100 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                <span className={totalWeight === 100 ? 'text-green-700' : 'text-yellow-700'}>
                                  Total weight: {totalWeight}%
                                  {totalWeight !== 100 && ' (should be 100%)'}
                                </span>
                              </div>
                            )}

                            <div className="space-y-4">
                              {backends.map((backend, index) => (
                                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-gray-700">
                                      Backend {index + 1}
                                      {backends.length > 1 && (
                                        <span className="ml-2 text-xs font-normal text-gray-500">
                                          ({backend.weight}% of traffic)
                                        </span>
                                      )}
                                    </span>
                                    {backends.length > 1 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeBackend(index)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>

                                  <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Backend Type</label>
                                    <div className="flex gap-4">
                                      <label className="flex items-center">
                                        <input
                                          type="radio"
                                          name={`backend-type-${index}`}
                                          value="kubernetes"
                                          checked={backend.type === 'kubernetes'}
                                          onChange={() => updateBackend(index, 'type', 'kubernetes')}
                                          className="mr-2"
                                        />
                                        <span className="text-sm">Kubernetes Service</span>
                                      </label>
                                      <label className="flex items-center">
                                        <input
                                          type="radio"
                                          name={`backend-type-${index}`}
                                          value="external"
                                          checked={backend.type === 'external'}
                                          onChange={() => updateBackend(index, 'type', 'external')}
                                          className="mr-2"
                                        />
                                        <span className="text-sm">External Service<InfoTooltip text="A service outside your Kubernetes cluster, reachable via hostname (FQDN) or IP address." /></span>
                                      </label>
                                    </div>
                                  </div>

                                  {backend.type === 'kubernetes' && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-4">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Namespace</label>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                            value={backend.namespace}
                                            onChange={(e) => loadServicesForBackend(index, e.target.value)}
                                          >
                                            <option value="">Select...</option>
                                            {namespaces.map((ns) => (
                                              <option key={ns.name} value={ns.name}>{ns.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="col-span-5">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Service</label>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                            value={backend.service}
                                            onChange={(e) => updateBackendService(index, e.target.value)}
                                            disabled={!backend.namespace}
                                          >
                                            <option value="">Select...</option>
                                            {backend.services.map((svc) => (
                                              <option key={svc.name} value={svc.name}>{svc.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="col-span-3">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                            value={backend.port}
                                            onChange={(e) => updateBackend(index, 'port', parseInt(e.target.value, 10))}
                                            disabled={!backend.service}
                                          >
                                            {(() => {
                                              const svc = backend.services.find(s => s.name === backend.service);
                                              if (!svc || svc.ports.length === 0) {
                                                return <option value={80}>80</option>;
                                              }
                                              return svc.ports.map(p => (
                                                <option key={p.port} value={p.port}>
                                                  {p.port}{p.name ? ` (${p.name})` : ''}
                                                </option>
                                              ));
                                            })()}
                                          </select>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-4">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              className={`px-3 py-2 text-xs rounded-md border ${
                                                !backend.fallback
                                                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                              }`}
                                              onClick={() => updateBackend(index, 'fallback', false)}
                                            >
                                              Primary
                                            </button>
                                            <button
                                              type="button"
                                              className={`px-3 py-2 text-xs rounded-md border ${
                                                backend.fallback
                                                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                              }`}
                                              onClick={() => updateBackend(index, 'fallback', true)}
                                            >
                                              Fallback<InfoTooltip text="Receives traffic only when all primary backends are unhealthy. Requires passive health check to be enabled. Weight is automatically set to 0." />
                                            </button>
                                          </div>
                                        </div>

                                        {!backend.fallback && (
                                          <div className="w-24">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                              Weight {backends.filter(b => !b.fallback).length > 1 ? '(%)' : ''}
                                            </label>
                                            <input
                                              type="number"
                                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                              min={0}
                                              max={100}
                                              value={backend.weight}
                                              onChange={(e) => updateBackend(index, 'weight', parseInt(e.target.value, 10) || 0)}
                                              disabled={backends.filter(b => !b.fallback).length === 1}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {backend.type === 'external' && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-3">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Address Type<InfoTooltip text="FQDN for hostnames (e.g., api.partner.com), IP for direct IP addresses." /></label>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                            value={backend.addressType}
                                            onChange={(e) => updateBackend(index, 'addressType', e.target.value)}
                                          >
                                            <option value="fqdn">FQDN</option>
                                            <option value="ip">IP Address</option>
                                          </select>
                                        </div>

                                        <div className="col-span-6">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">
                                            {backend.addressType === 'fqdn' ? 'Hostname' : 'IP Address'}
                                          </label>
                                          <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            placeholder={backend.addressType === 'fqdn' ? 'api.example.com' : '10.0.0.100'}
                                            value={backend.address}
                                            onChange={(e) => updateBackend(index, 'address', e.target.value)}
                                          />
                                        </div>

                                        <div className="col-span-3">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                                          <input
                                            type="number"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            min={1}
                                            max={65535}
                                            value={backend.port}
                                            onChange={(e) => updateBackend(index, 'port', parseInt(e.target.value, 10) || 80)}
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-4">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              className={`px-3 py-2 text-xs rounded-md border ${
                                                !backend.fallback
                                                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                              }`}
                                              onClick={() => updateBackend(index, 'fallback', false)}
                                            >
                                              Primary
                                            </button>
                                            <button
                                              type="button"
                                              className={`px-3 py-2 text-xs rounded-md border ${
                                                backend.fallback
                                                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                              }`}
                                              onClick={() => updateBackend(index, 'fallback', true)}
                                            >
                                              Fallback<InfoTooltip text="Receives traffic only when all primary backends are unhealthy. Requires passive health check to be enabled. Weight is automatically set to 0." />
                                            </button>
                                          </div>
                                        </div>

                                        {!backend.fallback && (
                                          <div className="w-24">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                              Weight {backends.filter(b => !b.fallback).length > 1 ? '(%)' : ''}
                                            </label>
                                            <input
                                              type="number"
                                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                              min={0}
                                              max={100}
                                              value={backend.weight}
                                              onChange={(e) => updateBackend(index, 'weight', parseInt(e.target.value, 10) || 0)}
                                              disabled={backends.filter(b => !b.fallback).length === 1}
                                            />
                                          </div>
                                        )}
                                      </div>

                                    </div>
                                  )}

                                  {/* TLS Settings - available for both kubernetes and external backends */}
                                  <div className="border-t border-gray-200 pt-3 mt-3">
                                    <div className="space-y-3">
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={backend.tlsEnabled}
                                          onChange={(e) => updateBackend(index, 'tlsEnabled', e.target.checked)}
                                          className="rounded border-gray-300"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Enable TLS<InfoTooltip text="Encrypt traffic between the gateway and this backend using TLS. Enable when the backend expects HTTPS connections." /></span>
                                      </label>

                                      {backend.tlsEnabled && (
                                        <div className="pl-6 space-y-4">
                                          {/* TLS Mode */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">TLS Mode</label>
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                className={`px-3 py-1.5 text-xs rounded-md border ${
                                                  backend.tlsMode === 'simple'
                                                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                                }`}
                                                onClick={() => updateBackend(index, 'tlsMode', 'simple')}
                                              >
                                                Simple TLS<InfoTooltip text="The gateway verifies the backend's TLS certificate. Use CA certificates to verify self-signed or private CA certs." />
                                              </button>
                                              <button
                                                type="button"
                                                className={`px-3 py-1.5 text-xs rounded-md border ${
                                                  backend.tlsMode === 'mtls'
                                                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                                }`}
                                                onClick={() => updateBackend(index, 'tlsMode', 'mtls')}
                                              >
                                                Mutual TLS (mTLS)<InfoTooltip text="The gateway verifies the backend's certificate AND presents a client certificate. Required when the backend verifies client identity." />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Insecure Skip Verify */}
                                          <div>
                                            <label className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                checked={backend.insecureSkipVerify}
                                                onChange={(e) => updateBackend(index, 'insecureSkipVerify', e.target.checked)}
                                                className="rounded border-gray-300"
                                              />
                                              <span className="text-sm text-gray-700">Skip certificate verification<InfoTooltip text="Skip verification of the backend's TLS certificate. Use only for development/testing or when you trust the network." /></span>
                                            </label>
                                            {backend.insecureSkipVerify && (
                                              <div className="mt-1 ml-6 flex items-center gap-1.5 text-xs text-amber-600">
                                                <AlertCircle className="h-3.5 w-3.5" />
                                                <span>Warning: Skipping certificate verification is insecure. Use only for development/testing.</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* SNI Override */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                              SNI Override (optional)<InfoTooltip text="Server Name Indication override. Auto-derived from the backend address if not set. Set this when the backend certificate uses a different hostname." />
                                            </label>
                                            <input
                                              type="text"
                                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                              placeholder="Auto-derived from address"
                                              value={backend.sni}
                                              onChange={(e) => updateBackend(index, 'sni', e.target.value)}
                                            />
                                          </div>

                                          {/* CA Certificate References - hidden when insecureSkipVerify */}
                                          {!backend.insecureSkipVerify && (
                                            <div>
                                              <label className="block text-xs font-medium text-gray-500 mb-2">
                                                CA Certificate References (required)<InfoTooltip text="Kubernetes ConfigMap or Secret containing the CA certificate to verify the backend's TLS certificate. Required for self-signed or private CA certificates." />
                                              </label>
                                              <div className="space-y-2">
                                                {backend.caCertificateRefs.map((caRef, caIndex) => (
                                                  <div key={caIndex} className="flex gap-2 items-start">
                                                    <select
                                                      className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                                                      value={caRef.kind}
                                                      onChange={(e) => {
                                                        const newRefs = [...backend.caCertificateRefs];
                                                        newRefs[caIndex] = { ...newRefs[caIndex], kind: e.target.value as 'Secret' | 'ConfigMap' };
                                                        updateBackend(index, 'caCertificateRefs', newRefs);
                                                      }}
                                                    >
                                                      <option value="ConfigMap">ConfigMap</option>
                                                      <option value="Secret">Secret</option>
                                                    </select>
                                                    <input
                                                      type="text"
                                                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                                      placeholder="Name"
                                                      value={caRef.name}
                                                      onChange={(e) => {
                                                        const newRefs = [...backend.caCertificateRefs];
                                                        newRefs[caIndex] = { ...newRefs[caIndex], name: e.target.value };
                                                        updateBackend(index, 'caCertificateRefs', newRefs);
                                                      }}
                                                    />
                                                    <input
                                                      type="text"
                                                      className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                                      placeholder="Namespace (optional)"
                                                      value={caRef.namespace}
                                                      onChange={(e) => {
                                                        const newRefs = [...backend.caCertificateRefs];
                                                        newRefs[caIndex] = { ...newRefs[caIndex], namespace: e.target.value };
                                                        updateBackend(index, 'caCertificateRefs', newRefs);
                                                      }}
                                                    />
                                                    {backend.caCertificateRefs.length > 1 && (
                                                      <button
                                                        type="button"
                                                        className="p-1.5 text-gray-400 hover:text-red-500"
                                                        onClick={() => {
                                                          const newRefs = backend.caCertificateRefs.filter((_, i) => i !== caIndex);
                                                          updateBackend(index, 'caCertificateRefs', newRefs);
                                                        }}
                                                      >
                                                        <X className="h-4 w-4" />
                                                      </button>
                                                    )}
                                                  </div>
                                                ))}
                                                <button
                                                  type="button"
                                                  className="text-xs text-primary-600 hover:text-primary-700"
                                                  onClick={() => {
                                                    updateBackend(index, 'caCertificateRefs', [
                                                      ...backend.caCertificateRefs,
                                                      { kind: 'ConfigMap', name: '', namespace: '' }
                                                    ]);
                                                  }}
                                                >
                                                  + Add CA Reference
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Client Certificate - only for mTLS mode */}
                                          {backend.tlsMode === 'mtls' && (
                                            <div>
                                              <label className="block text-xs font-medium text-gray-500 mb-2">Client Certificate Secret (required for mTLS)<InfoTooltip text="Kubernetes Secret containing the client certificate and private key (tls.crt and tls.key) for mutual TLS authentication." /></label>
                                              <div className="flex gap-2">
                                                <input
                                                  type="text"
                                                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                                  placeholder="Secret name"
                                                  value={backend.clientCertificateRef.name}
                                                  onChange={(e) => updateBackend(index, 'clientCertificateRef', {
                                                    ...backend.clientCertificateRef,
                                                    name: e.target.value
                                                  })}
                                                />
                                                <input
                                                  type="text"
                                                  className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                                  placeholder="Namespace (optional)"
                                                  value={backend.clientCertificateRef.namespace}
                                                  onChange={(e) => updateBackend(index, 'clientCertificateRef', {
                                                    ...backend.clientCertificateRef,
                                                    namespace: e.target.value
                                                  })}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Failover Warning */}
                            {backends.some(b => b.fallback) && !hcPassiveEnabled && (
                              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-amber-800">Passive health check recommended</p>
                                  <p className="text-xs text-amber-600">
                                    Failover requires passive health check to detect backend failures.
                                    Configure it in the Resilience tab under Health Check.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Request Mirroring Section */}
                            <div className="space-y-4 pt-4 border-t">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="text-sm font-medium text-gray-700">Request Mirroring</h3>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Mirror requests to additional services for testing or monitoring. Responses are discarded.
                                  </p>
                                </div>
                                <Button type="button" size="sm" variant="secondary" onClick={addMirror}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Mirror
                                </Button>
                              </div>

                              {mirrors.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No mirrors configured</p>
                              ) : (
                                <div className="space-y-4">
                                  {mirrors.map((mirror, index) => (
                                    <div key={index} className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-primary-700">
                                          Mirror {index + 1}
                                        </span>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => removeMirror(index)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>

                                      <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-4">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Namespace</label>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                            value={mirror.namespace}
                                            onChange={(e) => loadServicesForMirror(index, e.target.value)}
                                          >
                                            <option value="">Select...</option>
                                            {namespaces.map((ns) => (
                                              <option key={ns.name} value={ns.name}>{ns.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="col-span-5">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Service</label>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                            value={mirror.service}
                                            onChange={(e) => updateMirrorService(index, e.target.value)}
                                            disabled={!mirror.namespace}
                                          >
                                            <option value="">Select...</option>
                                            {mirror.services.map((svc) => (
                                              <option key={svc.name} value={svc.name}>{svc.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="col-span-3">
                                          <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                                          <select
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                            value={mirror.port}
                                            onChange={(e) => updateMirror(index, 'port', parseInt(e.target.value, 10))}
                                            disabled={!mirror.service}
                                          >
                                            {(() => {
                                              const svc = mirror.services.find(s => s.name === mirror.service);
                                              if (!svc || svc.ports.length === 0) {
                                                return <option value={80}>80</option>;
                                              }
                                              return svc.ports.map(p => (
                                                <option key={p.port} value={p.port}>
                                                  {p.port}{p.name ? ` (${p.name})` : ''}
                                                </option>
                                              ));
                                            })()}
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Redirect Configuration */}
                        {routeType === 'redirect' && (
                          <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-sm font-medium text-gray-700">Redirect Configuration</h3>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Scheme</label>
                                <select
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                  value={redirectScheme}
                                  onChange={(e) => setRedirectScheme(e.target.value)}
                                >
                                  <option value="">No change</option>
                                  <option value="https">HTTPS</option>
                                  <option value="http">HTTP</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status Code</label>
                                <select
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                  value={redirectStatusCode}
                                  onChange={(e) => setRedirectStatusCode(parseInt(e.target.value, 10))}
                                >
                                  <option value={301}>301 - Permanent Redirect</option>
                                  <option value={302}>302 - Temporary Redirect</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="e.g., www.example.com"
                                value={redirectHostname}
                                onChange={(e) => setRedirectHostname(e.target.value)}
                              />
                              <p className="mt-1 text-xs text-gray-500">Leave empty to keep the original hostname</p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                              <input
                                type="number"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="e.g., 443"
                                value={redirectPort}
                                onChange={(e) => setRedirectPort(e.target.value)}
                              />
                              <p className="mt-1 text-xs text-gray-500">Leave empty to use the default port for the scheme</p>
                            </div>

                            <div className="pt-4 border-t">
                              <div className="flex items-center gap-3 mb-3">
                                <input
                                  type="checkbox"
                                  id="redirectPathEnabled"
                                  checked={redirectPathEnabled}
                                  onChange={(e) => setRedirectPathEnabled(e.target.checked)}
                                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                />
                                <label htmlFor="redirectPathEnabled" className="text-sm font-medium text-gray-700">
                                  Modify Path
                                </label>
                              </div>

                              {redirectPathEnabled && (
                                <div className="ml-7 space-y-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Rewrite Type</label>
                                    <select
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                      value={redirectPathType}
                                      onChange={(e) => setRedirectPathType(e.target.value as 'ReplacePrefixMatch' | 'ReplaceFullPath')}
                                    >
                                      <option value="ReplacePrefixMatch">Replace Prefix Match</option>
                                      <option value="ReplaceFullPath">Replace Full Path</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      {redirectPathType === 'ReplacePrefixMatch' ? 'New Prefix' : 'New Path'}
                                    </label>
                                    <input
                                      type="text"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                      placeholder={redirectPathType === 'ReplacePrefixMatch' ? 'e.g., /new-prefix' : 'e.g., /new/path'}
                                      value={redirectPathValue}
                                      onChange={(e) => setRedirectPathValue(e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono">
                              <p className="text-gray-400 mb-2">Redirect Preview:</p>
                              <div className="text-gray-300">
                                <span className="text-gray-500">Request: </span>
                                <span className="text-yellow-400">{domain?.hostname || 'example.com'}</span>
                                <span className="text-primary-400">{watch('pathValue') || '/api'}/users</span>
                              </div>
                              <div className="text-gray-300 mt-1">
                                <span className="text-gray-500">Redirects to: </span>
                                <span className="text-green-400">
                                  {redirectScheme || 'https'}://
                                  {redirectHostname || domain?.hostname || 'example.com'}
                                  {redirectPort ? `:${redirectPort}` : ''}
                                  {redirectPathEnabled && redirectPathValue
                                    ? (redirectPathType === 'ReplaceFullPath' ? redirectPathValue : `${redirectPathValue}/users`)
                                    : `${watch('pathValue') || '/api'}/users`
                                  }
                                </span>
                                <span className="text-purple-400 ml-2">({redirectStatusCode})</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Direct Response Configuration */}
                        {routeType === 'directResponse' && (
                          <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-sm font-medium text-gray-700">Direct Response Configuration</h3>
                            <p className="text-xs text-gray-500">
                              Return a static response without forwarding to a backend service.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Status Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min={100}
                                  max={599}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  placeholder="e.g., 200, 404, 503"
                                  value={drStatusCode}
                                  onChange={(e) => setDrStatusCode(e.target.value)}
                                />
                                <p className="mt-1 text-xs text-gray-500">HTTP status code (100-599)</p>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                                <select
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                  value={drContentType}
                                  onChange={(e) => setDrContentType(e.target.value)}
                                >
                                  <option value="text/plain">text/plain</option>
                                  <option value="text/html">text/html</option>
                                  <option value="application/json">application/json</option>
                                  <option value="application/xml">application/xml</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Response Body
                              </label>
                              <textarea
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                                placeholder={drContentType === 'application/json' ? '{"message": "OK"}' : 'Response body content'}
                                rows={5}
                                value={drBody}
                                onChange={(e) => setDrBody(e.target.value)}
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Optional response body (max 4096 bytes). Current: {drBody.length} bytes
                              </p>
                              {drBody.length > 4096 && (
                                <p className="mt-1 text-xs text-red-500">
                                  Response body exceeds 4096 bytes limit
                                </p>
                              )}
                            </div>

                            <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono">
                              <p className="text-gray-400 mb-2">Response Preview:</p>
                              <div className="text-gray-300">
                                <span className="text-gray-500">HTTP/1.1 </span>
                                <span className="text-yellow-400">{drStatusCode || '200'}</span>
                              </div>
                              <div className="text-gray-300 mt-1">
                                <span className="text-gray-500">Content-Type: </span>
                                <span className="text-primary-400">{drContentType || 'text/plain'}</span>
                              </div>
                              {drBody && (
                                <div className="text-gray-300 mt-2 pt-2 border-t border-gray-700">
                                  <span className="text-green-400 whitespace-pre-wrap">{drBody.length > 200 ? drBody.substring(0, 200) + '...' : drBody}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Health Check Section - only for backend routes */}
                  {routeType === 'backend' && (
                    <AccordionItem value="health-check">
                      <AccordionTrigger
                        value="health-check"
                        badge={hcEnabled && (
                          <Badge variant="success">
                            {hcActiveEnabled && hcPassiveEnabled ? 'Active + Passive' : hcActiveEnabled ? 'Active' : hcPassiveEnabled ? 'Passive' : 'Enabled'}
                          </Badge>
                        )}
                      >
                        Health Check
                      </AccordionTrigger>
                      <AccordionContent value="health-check">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hcEnabled}
                                onChange={(e) => setHcEnabled(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-sm font-medium">Enable Health Check</span>
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">
                            Monitor backend health using active probes and/or passive error tracking.
                          </p>

                          {hcEnabled && (
                            <div className="space-y-6">
                              <div>
                                <label className="block text-sm font-medium mb-1">Panic Threshold <InfoTooltip text="When the percentage of healthy backends drops below this value, Envoy ignores health status and routes to all backends. Prevents total outage." example="50" /></label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="Not set"
                                  value={hcPanicThreshold}
                                  onChange={(e) => setHcPanicThreshold(e.target.value)}
                                />
                                <p className="mt-1 text-xs text-gray-500">Percentage of healthy hosts below which Envoy ignores health status and routes to all hosts.</p>
                              </div>

                              {/* Active Health Check */}
                              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={hcActiveEnabled}
                                      onChange={(e) => setHcActiveEnabled(e.target.checked)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium">Enable Active Health Check</span>
                                  </label>
                                </div>
                                <p className="text-xs text-gray-500">Actively probe backends at regular intervals.</p>

                                {hcActiveEnabled && (
                                  <div className="space-y-4">
                                    <div>
                                      <Select
                                        label="Type"
                                        value={hcActiveType}
                                        onChange={(e) => setHcActiveType(e.target.value as 'HTTP' | 'TCP' | 'GRPC')}
                                        options={[
                                          { value: 'HTTP', label: 'HTTP' },
                                          { value: 'TCP', label: 'TCP' },
                                          { value: 'GRPC', label: 'GRPC' },
                                        ]}
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-medium mb-1">Timeout <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." /></label>
                                        <Input
                                          placeholder="1s (default)"
                                          value={hcActiveTimeout}
                                          onChange={(e) => setHcActiveTimeout(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium mb-1">Interval <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." /></label>
                                        <Input
                                          placeholder="3s (default)"
                                          value={hcActiveInterval}
                                          onChange={(e) => setHcActiveInterval(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium mb-1">Unhealthy Threshold</label>
                                        <Input
                                          type="number"
                                          min="1"
                                          placeholder="3 (default)"
                                          value={hcActiveUnhealthyThreshold}
                                          onChange={(e) => setHcActiveUnhealthyThreshold(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium mb-1">Healthy Threshold</label>
                                        <Input
                                          type="number"
                                          min="1"
                                          placeholder="1 (default)"
                                          value={hcActiveHealthyThreshold}
                                          onChange={(e) => setHcActiveHealthyThreshold(e.target.value)}
                                        />
                                      </div>
                                    </div>

                                    {hcActiveType === 'HTTP' && (
                                      <div className="space-y-4 border-t pt-4">
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Path <span className="text-red-500">*</span></label>
                                          <Input
                                            placeholder="/healthz"
                                            value={hcHttpPath}
                                            onChange={(e) => setHcHttpPath(e.target.value)}
                                          />
                                        </div>
                                        <div>
                                          <Select
                                            label="Method"
                                            value={hcHttpMethod}
                                            onChange={(e) => setHcHttpMethod(e.target.value)}
                                            options={[
                                              { value: 'GET', label: 'GET' },
                                              { value: 'HEAD', label: 'HEAD' },
                                              { value: 'POST', label: 'POST' },
                                              { value: 'PUT', label: 'PUT' },
                                              { value: 'DELETE', label: 'DELETE' },
                                              { value: 'OPTIONS', label: 'OPTIONS' },
                                              { value: 'PATCH', label: 'PATCH' },
                                            ]}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Expected Status Codes</label>
                                          <div className="flex flex-wrap gap-2 mb-2">
                                            {hcHttpExpectedStatuses.map((code, idx) => (
                                              <Badge key={idx} variant="default" className="flex items-center gap-1">
                                                {code}
                                                <button
                                                  type="button"
                                                  onClick={() => setHcHttpExpectedStatuses(hcHttpExpectedStatuses.filter((_, i) => i !== idx))}
                                                  className="ml-1 hover:text-red-500"
                                                >
                                                  <X className="h-3 w-3" />
                                                </button>
                                              </Badge>
                                            ))}
                                          </div>
                                          <div className="flex gap-2">
                                            <Input
                                              type="number"
                                              min="100"
                                              max="599"
                                              placeholder="e.g. 200"
                                              value={hcHttpStatusInput}
                                              onChange={(e) => setHcHttpStatusInput(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  const code = parseInt(hcHttpStatusInput, 10);
                                                  if (code >= 100 && code <= 599 && !hcHttpExpectedStatuses.includes(code)) {
                                                    setHcHttpExpectedStatuses([...hcHttpExpectedStatuses, code]);
                                                    setHcHttpStatusInput('');
                                                  }
                                                }
                                              }}
                                            />
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              size="sm"
                                              onClick={() => {
                                                const code = parseInt(hcHttpStatusInput, 10);
                                                if (code >= 100 && code <= 599 && !hcHttpExpectedStatuses.includes(code)) {
                                                  setHcHttpExpectedStatuses([...hcHttpExpectedStatuses, code]);
                                                  setHcHttpStatusInput('');
                                                }
                                              }}
                                            >
                                              Add
                                            </Button>
                                          </div>
                                          <p className="mt-1 text-xs text-gray-500">Defaults to 200 if none specified</p>
                                        </div>
                                      </div>
                                    )}

                                    {hcActiveType === 'TCP' && (
                                      <div className="space-y-4 border-t pt-4">
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Send Payload</label>
                                          <Input
                                            placeholder="Optional text to send"
                                            value={hcTcpSendText}
                                            onChange={(e) => setHcTcpSendText(e.target.value)}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Expected Response</label>
                                          <Input
                                            placeholder="Expected response text"
                                            value={hcTcpReceiveText}
                                            onChange={(e) => setHcTcpReceiveText(e.target.value)}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {hcActiveType === 'GRPC' && (
                                      <div className="space-y-4 border-t pt-4">
                                        <div>
                                          <label className="block text-sm font-medium mb-1">Service Name <InfoTooltip text="The gRPC health checking service name. The backend must implement the gRPC Health Checking Protocol." example="grpc.health.v1.Health" /></label>
                                          <Input
                                            placeholder="Optional service name"
                                            value={hcGrpcService}
                                            onChange={(e) => setHcGrpcService(e.target.value)}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Passive Health Check */}
                              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={hcPassiveEnabled}
                                      onChange={(e) => setHcPassiveEnabled(e.target.checked)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium">Enable Passive Health Check</span>
                                  </label>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Detect unhealthy backends by monitoring traffic errors. Ejects backends that exceed error thresholds.
                                </p>

                                {hcPassiveEnabled && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Consecutive Gateway Errors <InfoTooltip text="Errors like connection timeouts, TCP resets, and HTTP 502/503/504. After this many consecutive errors, the backend is temporarily removed from the pool." /></label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="e.g. 5"
                                        value={hcPassiveConsecutiveGatewayErrors}
                                        onChange={(e) => setHcPassiveConsecutiveGatewayErrors(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Consecutive 5xx Errors <InfoTooltip text="Any HTTP 5xx response (500, 502, 503, etc.). After this many consecutive 5xx errors, the backend is temporarily removed from the pool." /></label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="e.g. 5"
                                        value={hcPassiveConsecutive5xxErrors}
                                        onChange={(e) => setHcPassiveConsecutive5xxErrors(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Check Interval <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." /></label>
                                      <Input
                                        placeholder="e.g. 30s"
                                        value={hcPassiveInterval}
                                        onChange={(e) => setHcPassiveInterval(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Base Ejection Time <InfoTooltip text="How long an unhealthy backend is removed from the pool. Increases with each consecutive ejection." example="30s → 60s → 90s" /></label>
                                      <Input
                                        placeholder="e.g. 30s"
                                        value={hcPassiveBaseEjectionTime}
                                        onChange={(e) => setHcPassiveBaseEjectionTime(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Fault Injection Section - only for backend routes */}
                  {routeType === 'backend' && (
                    <AccordionItem value="fault-injection">
                      <AccordionTrigger
                        value="fault-injection"
                        badge={fiEnabled && (
                          <Badge variant="success">
                            {fiDelayEnabled && fiAbortEnabled ? 'Delay + Abort' : fiDelayEnabled ? 'Delay' : fiAbortEnabled ? 'Abort' : 'Enabled'}
                          </Badge>
                        )}
                      >
                        Fault Injection
                      </AccordionTrigger>
                      <AccordionContent value="fault-injection">
                        <div className="space-y-4">
                          {/* Master toggle */}
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="fiEnabled"
                              checked={fiEnabled}
                              onChange={(e) => {
                                setFiEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setFiDelayEnabled(false);
                                  setFiAbortEnabled(false);
                                }
                              }}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="fiEnabled" className="text-sm font-medium text-gray-700">
                              Enable Fault Injection
                            </label>
                          </div>

                          <p className="text-xs text-gray-500">
                            Inject faults (delays or errors) to test application resilience.
                          </p>

                          {fiEnabled && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                              <p className="text-sm text-yellow-700 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Use with caution in production environments.
                              </p>
                            </div>
                          )}

                          {fiEnabled && (
                            <div className="space-y-4 pt-4">
                              {/* Delay Injection */}
                              <div className="p-4 bg-gray-50 border rounded-md space-y-4">
                                <div>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={fiDelayEnabled}
                                      onChange={(e) => setFiDelayEnabled(e.target.checked)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium">Enable Delay Injection</span>
                                  </label>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Add artificial latency to requests.
                                </p>

                                {fiDelayEnabled && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Fixed Delay * <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." /></label>
                                      <Input
                                        placeholder="e.g. 2s, 500ms"
                                        value={fiDelayFixedDelay}
                                        onChange={(e) => setFiDelayFixedDelay(e.target.value)}
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Percentage</label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        placeholder="100 (default)"
                                        value={fiDelayPercentage}
                                        onChange={(e) => setFiDelayPercentage(e.target.value)}
                                      />
                                      <p className="text-xs text-gray-500 mt-1">0-100 percent of requests to delay</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Abort Injection */}
                              <div className="p-4 bg-gray-50 border rounded-md space-y-4">
                                <div>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={fiAbortEnabled}
                                      onChange={(e) => setFiAbortEnabled(e.target.checked)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium">Enable Abort Injection</span>
                                  </label>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Return error responses without forwarding to backend.
                                </p>

                                {fiAbortEnabled && (
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-medium mb-1">Error Type</label>
                                      <Select
                                        value={fiAbortType}
                                        options={[
                                          { value: 'http', label: 'HTTP' },
                                          { value: 'grpc', label: 'gRPC' },
                                        ]}
                                        onChange={(e) => {
                                          const value = e.target.value as 'http' | 'grpc';
                                          setFiAbortType(value);
                                          setFiAbortHttpStatus('');
                                          setFiAbortGrpcStatus('');
                                        }}
                                      />
                                    </div>

                                    {fiAbortType === 'http' && (
                                      <div>
                                        <label className="block text-sm font-medium mb-1">HTTP Status Code *</label>
                                        <Input
                                          type="number"
                                          min="100"
                                          max="599"
                                          placeholder="e.g. 503, 500"
                                          value={fiAbortHttpStatus}
                                          onChange={(e) => setFiAbortHttpStatus(e.target.value)}
                                        />
                                      </div>
                                    )}

                                    {fiAbortType === 'grpc' && (
                                      <div>
                                        <label className="block text-sm font-medium mb-1">gRPC Status Code *</label>
                                        <Select
                                          value={fiAbortGrpcStatus}
                                          options={[
                                            { value: '', label: 'Select status code' },
                                            ...grpcStatusOptions,
                                          ]}
                                          onChange={(e) => setFiAbortGrpcStatus(e.target.value)}
                                        />
                                      </div>
                                    )}

                                    <div>
                                      <label className="block text-sm font-medium mb-1">Percentage</label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        placeholder="100 (default)"
                                        value={fiAbortPercentage}
                                        onChange={(e) => setFiAbortPercentage(e.target.value)}
                                      />
                                      <p className="text-xs text-gray-500 mt-1">0-100 percent of requests to abort</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Rate Limiting Section - only for backend routes */}
                  {routeType === 'backend' && (
                    <AccordionItem value="rate-limiting">
                      <AccordionTrigger
                        value="rate-limiting"
                        badge={rateLimit && (
                          <Badge variant="success">
                            {rateLimit.global?.rules?.[0]?.limit.requests}/{rateLimit.global?.rules?.[0]?.limit.unit}
                          </Badge>
                        )}
                      >
                        Rate Limiting
                      </AccordionTrigger>
                      <AccordionContent value="rate-limiting">
                        <div className="space-y-4">
                          {capabilitiesError && (
                            <div className="p-3 bg-primary-50 border border-primary-200 rounded-md">
                              <p className="text-sm text-primary-700">
                                Could not verify rate limit availability. You can still configure rate limiting,
                                but it may not work if the Envoy Gateway rate limit service is not configured.
                              </p>
                            </div>
                          )}
                          {capabilities?.rateLimitAvailable === false ? (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                              <p className="text-sm text-yellow-700">
                                Rate limiting requires Redis and the Envoy Gateway rate limit service.
                                Configure it in your Envoy Gateway Helm values.
                              </p>
                            </div>
                          ) : (
                            <>
                              <RateLimitForm
                                value={rateLimit}
                                onChange={setRateLimit}
                              />
                            </>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Request Buffer Section - only for backend routes */}
                  {routeType === 'backend' && (
                    <AccordionItem value="request-buffer">
                      <AccordionTrigger
                        value="request-buffer"
                        badge={requestBuffer && (
                          <Badge variant="success">{requestBuffer.limit}</Badge>
                        )}
                      >
                        Request Buffering
                      </AccordionTrigger>
                      <AccordionContent value="request-buffer">
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">
                            Buffer incoming requests before forwarding to backends. Useful for protecting backends from slow clients.
                          </p>
                          <RequestBufferForm
                            value={requestBuffer}
                            onChange={setRequestBuffer}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Response Override Section - only for backend routes */}
                  {routeType === 'backend' && (
                    <AccordionItem value="response-override">
                      <AccordionTrigger
                        value="response-override"
                        badge={responseOverride.length > 0 && (
                          <Badge variant="success">{responseOverride.length} rule{responseOverride.length > 1 ? 's' : ''}</Badge>
                        )}
                      >
                        Response Override
                      </AccordionTrigger>
                      <AccordionContent value="response-override">
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">
                            Override backend responses based on status codes. Replace error pages with custom content.
                          </p>
                          <ResponseOverrideForm
                            value={responseOverride}
                            onChange={(v) => setResponseOverride(v ?? [])}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Timeout Section */}
                  <AccordionItem value="timeouts">
                    <AccordionTrigger
                      value="timeouts"
                      badge={
                        btpTimeoutEnabled && (tcpConnectTimeout || httpRequestTimeout || httpConnectionIdleTimeout || httpMaxConnectionDuration || httpMaxStreamDuration) ? (
                          <Badge variant="success">Configured</Badge>
                        ) : undefined
                      }
                    >
                      Timeout
                    </AccordionTrigger>
                    <AccordionContent value="timeouts">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="btpTimeoutEnabled"
                            checked={btpTimeoutEnabled}
                            onChange={(e) => {
                              setBtpTimeoutEnabled(e.target.checked);
                              if (!e.target.checked) {
                                setTcpConnectTimeout('');
                                setHttpRequestTimeout('');
                                setHttpConnectionIdleTimeout('');
                                setHttpMaxConnectionDuration('');
                                setHttpMaxStreamDuration('');
                              }
                            }}
                            className="h-4 w-4 text-primary-600 rounded border-gray-300"
                          />
                          <label htmlFor="btpTimeoutEnabled" className="text-sm font-medium text-gray-700">
                            Enable Timeout
                          </label>
                        </div>

                        <p className="text-xs text-gray-500">
                          Configure timeout durations for connections and requests. Works for both HTTP and gRPC routes.
                        </p>

                        {btpTimeoutEnabled && (
                          <div className="space-y-6 pt-4 border-t">
                            {/* TCP Timeouts */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 mb-3">TCP</h4>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Connect Timeout <InfoTooltip text="Timeout for establishing a TCP connection to the backend. Duration format: 500ms, 5s, 1m." />
                                </label>
                                <input
                                  type="text"
                                  value={tcpConnectTimeout}
                                  onChange={(e) => setTcpConnectTimeout(e.target.value)}
                                  placeholder="e.g. 10s"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                              </div>
                            </div>

                            {/* HTTP Timeouts */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 mb-3">HTTP</h4>
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Request Timeout <InfoTooltip text="Total time for the gateway to process the request and return a response. Duration format: 500ms, 5s, 1m." />
                                  </label>
                                  <input
                                    type="text"
                                    value={httpRequestTimeout}
                                    onChange={(e) => setHttpRequestTimeout(e.target.value)}
                                    placeholder="e.g. 15s"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Connection Idle Timeout <InfoTooltip text="Time a connection can be idle before being closed. Duration format: 1m, 1h." />
                                  </label>
                                  <input
                                    type="text"
                                    value={httpConnectionIdleTimeout}
                                    onChange={(e) => setHttpConnectionIdleTimeout(e.target.value)}
                                    placeholder="e.g. 1h"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Connection Duration <InfoTooltip text="Maximum lifetime of a connection regardless of activity. Duration format: 1h, 24h." />
                                  </label>
                                  <input
                                    type="text"
                                    value={httpMaxConnectionDuration}
                                    onChange={(e) => setHttpMaxConnectionDuration(e.target.value)}
                                    placeholder="e.g. 0s (unlimited)"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Stream Duration <InfoTooltip text="Maximum duration for a single HTTP/2 or gRPC stream. Duration format: 1m, 1h." />
                                  </label>
                                  <input
                                    type="text"
                                    value={httpMaxStreamDuration}
                                    onChange={(e) => setHttpMaxStreamDuration(e.target.value)}
                                    placeholder="e.g. 0s (unlimited)"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Request Matching Section */}
                  <AccordionItem value="request-matching">
                    <AccordionTrigger
                      value="request-matching"
                      badge={
                        (headers.length > 0 || queryParams.length > 0) && (
                          <Badge variant="default">{headers.length + queryParams.length} rules</Badge>
                        )
                      }
                    >
                      Request Matching
                    </AccordionTrigger>
                    <AccordionContent value="request-matching">
                      <div className="space-y-6">
                        {watch('protocol') === 'grpc' ? (
                          <>
                            {/* gRPC Service Match */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-gray-700">gRPC Service</h3>
                              <div className="grid grid-cols-3 gap-4">
                                <select
                                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  {...register('grpcServiceType')}
                                >
                                  <option value="Exact">Exact</option>
                                  <option value="RegularExpression">RegularExpression</option>
                                </select>
                                <div className="col-span-2">
                                  <Input
                                    id="grpcServiceValue"
                                    label="Service Name"
                                    placeholder="e.g., helloworld.Greeter"
                                    {...register('grpcServiceValue', {
                                      validate: (value) => {
                                        if (value && watch('grpcServiceType') === 'RegularExpression') {
                                          try { new RegExp(value); return true; } catch { return 'Invalid regular expression'; }
                                        }
                                        return true;
                                      },
                                    })}
                                    error={errors.grpcServiceValue?.message}
                                  />
                                </div>
                              </div>
                              <p className="text-sm text-gray-500">Match the gRPC service name (package.ServiceName)</p>
                            </div>

                            {/* gRPC Method Match */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-gray-700">gRPC Method</h3>
                              <div className="grid grid-cols-3 gap-4">
                                <select
                                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  {...register('grpcMethodType')}
                                >
                                  <option value="Exact">Exact</option>
                                  <option value="RegularExpression">RegularExpression</option>
                                </select>
                                <div className="col-span-2">
                                  <Input
                                    id="grpcMethodValue"
                                    label="Method Name"
                                    placeholder="e.g., SayHello"
                                    {...register('grpcMethodValue', {
                                      validate: (value) => {
                                        if (value && watch('grpcMethodType') === 'RegularExpression') {
                                          try { new RegExp(value); return true; } catch { return 'Invalid regular expression'; }
                                        }
                                        return true;
                                      },
                                    })}
                                    error={errors.grpcMethodValue?.message}
                                  />
                                </div>
                              </div>
                              <p className="text-sm text-gray-500">Match the gRPC method name</p>
                            </div>

                            {/* Path hint (read-only) */}
                            {(watch('grpcServiceValue') || watch('grpcMethodValue')) && (
                              <div className="p-3 bg-gray-50 border rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Equivalent gRPC path:</p>
                                <code className="text-sm font-mono text-gray-700">
                                  /{watch('grpcServiceValue') || '*'}/{watch('grpcMethodValue') || '*'}
                                </code>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Path Matching */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-gray-700">Path</h3>
                              <div className="grid grid-cols-3 gap-4">
                                <Select
                                  id="pathType"
                                  label="Match Type"
                                  options={pathTypeOptions}
                                  {...register('pathType')}
                                />
                                <div className="col-span-2">
                                  <Input
                                    id="pathValue"
                                    label="Path Value"
                                    placeholder={getPathPlaceholder()}
                                    {...register('pathValue', {
                                      required: watch('protocol') !== 'grpc' ? 'Path is required' : false,
                                      validate: (value) => {
                                        if (watch('protocol') === 'grpc') return true;
                                        if (watchPathType === 'RegularExpression') {
                                          try {
                                            new RegExp(value);
                                            return true;
                                          } catch {
                                            return 'Invalid regular expression';
                                          }
                                        }
                                        if (!value.startsWith('/')) {
                                          return 'Path must start with /';
                                        }
                                        return true;
                                      },
                                    })}
                                    error={errors.pathValue?.message}
                                  />
                                </div>
                              </div>
                              <p className="text-sm text-gray-500">{getPathHelperText()}</p>
                            </div>

                            {/* Method Matching */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-gray-700">HTTP Method</h3>
                              <Select
                                id="method"
                                label="Method"
                                options={methodOptions}
                                {...register('method')}
                              />
                            </div>
                          </>
                        )}

                        {/* Header Matching */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700">Headers<InfoTooltip text="Only route requests that contain specific HTTP headers. Useful for A/B testing or canary deployments." example="x-version: v2" /></h3>
                            <Button type="button" size="sm" variant="secondary" onClick={addHeader}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Header
                            </Button>
                          </div>
                          {headers.length === 0 ? (
                            <p className="text-sm text-gray-500">No header matching rules</p>
                          ) : (
                            <div className="space-y-3">
                              {headers.map((header, index) => (
                                <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1 grid grid-cols-3 gap-2">
                                    <Input
                                      placeholder="Header name"
                                      value={header.name}
                                      onChange={(e) => updateHeader(index, 'name', e.target.value)}
                                    />
                                    <select
                                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                      value={header.type}
                                      onChange={(e) => updateHeader(index, 'type', e.target.value as any)}
                                    >
                                      {matchTypeOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                    <Input
                                      placeholder="Value"
                                      value={header.value}
                                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                                    />
                                  </div>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => removeHeader(index)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Query Param Matching - HTTP only */}
                        {watch('protocol') !== 'grpc' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700">Query Parameters<InfoTooltip text="Only route requests with specific query parameters." example="?debug=true" /></h3>
                            <Button type="button" size="sm" variant="secondary" onClick={addQueryParam}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Query Param
                            </Button>
                          </div>
                          {queryParams.length === 0 ? (
                            <p className="text-sm text-gray-500">No query parameter matching rules</p>
                          ) : (
                            <div className="space-y-3">
                              {queryParams.map((qp, index) => (
                                <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1 grid grid-cols-3 gap-2">
                                    <Input
                                      placeholder="Param name"
                                      value={qp.name}
                                      onChange={(e) => updateQueryParam(index, 'name', e.target.value)}
                                    />
                                    <select
                                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                      value={qp.type}
                                      onChange={(e) => updateQueryParam(index, 'type', e.target.value as any)}
                                    >
                                      {matchTypeOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                    <Input
                                      placeholder="Value"
                                      value={qp.value}
                                      onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                                    />
                                  </div>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => removeQueryParam(index)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        )}
                        {/* Matcher conflict warning */}
                        {matcherConflicts.length > 0 && (
                          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mt-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-amber-800">
                                <p className="font-medium">Matcher conflict detected</p>
                                <p className="mt-1">
                                  This matcher conflicts with existing route{matcherConflicts.length > 1 ? 's' : ''}:{' '}
                                  {matcherConflicts.map(c => `"${c.routeName}"`).join(', ')}.
                                  Submission may be rejected.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Header Modifiers Section */}
                  <AccordionItem value="header-modifiers">
                    <AccordionTrigger
                      value="header-modifiers"
                      badge={
                        (requestHeaderModifiers.length > 0 || responseHeaderModifiers.length > 0) && (
                          <Badge variant="default">
                            {requestHeaderModifiers.length + responseHeaderModifiers.length} modifiers
                          </Badge>
                        )
                      }
                    >
                      Header Modifiers
                    </AccordionTrigger>
                    <AccordionContent value="header-modifiers">
                      <div className="space-y-6">
                        {/* Request Headers */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Request Headers</h3>
                            <Button type="button" size="sm" variant="secondary" onClick={addRequestHeaderModifier}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>

                          {requestHeaderModifiers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
                              No request header modifications
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {requestHeaderModifiers.map((mod, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-lg">
                                  <div className="col-span-2">
                                    <select
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                                      value={mod.action}
                                      onChange={(e) => updateRequestHeaderModifier(index, 'action', e.target.value)}
                                    >
                                      <option value="set">Set</option>
                                      <option value="add">Add</option>
                                      <option value="remove">Remove</option>
                                    </select>
                                  </div>
                                  <div className="col-span-4">
                                    <input
                                      type="text"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      placeholder="X-Custom-Header"
                                      value={mod.name}
                                      onChange={(e) => updateRequestHeaderModifier(index, 'name', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-5">
                                    {mod.action !== 'remove' ? (
                                      <input
                                        type="text"
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                        placeholder="value"
                                        value={mod.value}
                                        onChange={(e) => updateRequestHeaderModifier(index, 'value', e.target.value)}
                                      />
                                    ) : (
                                      <div className="px-2 py-1.5 text-sm text-gray-400 italic bg-gray-100 rounded-md">
                                        Will be removed
                                      </div>
                                    )}
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                    <Button type="button" size="sm" variant="ghost" onClick={() => removeRequestHeaderModifier(index)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Response Headers */}
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Response Headers</h3>
                            <Button type="button" size="sm" variant="secondary" onClick={addResponseHeaderModifier}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>

                          {responseHeaderModifiers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
                              No response header modifications
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {responseHeaderModifiers.map((mod, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-lg">
                                  <div className="col-span-2">
                                    <select
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                                      value={mod.action}
                                      onChange={(e) => updateResponseHeaderModifier(index, 'action', e.target.value)}
                                    >
                                      <option value="set">Set</option>
                                      <option value="add">Add</option>
                                      <option value="remove">Remove</option>
                                    </select>
                                  </div>
                                  <div className="col-span-4">
                                    <input
                                      type="text"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      placeholder="Cache-Control"
                                      value={mod.name}
                                      onChange={(e) => updateResponseHeaderModifier(index, 'name', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-5">
                                    {mod.action !== 'remove' ? (
                                      <input
                                        type="text"
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                        placeholder="value"
                                        value={mod.value}
                                        onChange={(e) => updateResponseHeaderModifier(index, 'value', e.target.value)}
                                      />
                                    ) : (
                                      <div className="px-2 py-1.5 text-sm text-gray-400 italic bg-gray-100 rounded-md">
                                        Will be removed
                                      </div>
                                    )}
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                    <Button type="button" size="sm" variant="ghost" onClick={() => removeResponseHeaderModifier(index)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 space-y-1 pt-4 border-t">
                          <p><strong>Set:</strong> Set header to value (overwrites if exists)</p>
                          <p><strong>Add:</strong> Add header value (appends if exists)</p>
                          <p><strong>Remove:</strong> Remove header</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* URL Rewrite Section - only for HTTP backend routes */}
                  {routeType === 'backend' && watch('protocol') !== 'grpc' && (
                    <AccordionItem value="url-rewrite">
                      <AccordionTrigger
                        value="url-rewrite"
                        badge={
                          (rewriteHostnameEnabled || rewritePathEnabled) && (
                            <Badge variant="default">Configured</Badge>
                          )
                        }
                      >
                        URL Rewrite
                      </AccordionTrigger>
                      <AccordionContent value="url-rewrite">
                        <div className="space-y-6">
                          {/* Hostname Rewrite */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id="rewriteHostname"
                                checked={rewriteHostnameEnabled}
                                onChange={(e) => setRewriteHostnameEnabled(e.target.checked)}
                                className="h-4 w-4 text-primary-600 rounded border-gray-300"
                              />
                              <label htmlFor="rewriteHostname" className="text-sm font-medium text-gray-700">
                                Rewrite Hostname
                              </label>
                            </div>
                            {rewriteHostnameEnabled && (
                              <div className="ml-7">
                                <label className="block text-xs font-medium text-gray-500 mb-1">New Hostname</label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  placeholder="e.g., api.internal.example.com"
                                  value={rewriteHostname}
                                  onChange={(e) => setRewriteHostname(e.target.value)}
                                />
                              </div>
                            )}
                          </div>

                          {/* Path Rewrite */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id="rewritePath"
                                checked={rewritePathEnabled}
                                onChange={(e) => setRewritePathEnabled(e.target.checked)}
                                className="h-4 w-4 text-primary-600 rounded border-gray-300"
                              />
                              <label htmlFor="rewritePath" className="text-sm font-medium text-gray-700">
                                Rewrite Path
                              </label>
                            </div>
                            {rewritePathEnabled && (
                              <div className="ml-7 space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Rewrite Type
                                    {rewritePathType === 'ReplacePrefixMatch'
                                      ? <InfoTooltip text="Replaces only the matched path prefix. Requires path match type to be Prefix." example="/old-api/* → /new-api/*" />
                                      : <InfoTooltip text="Replaces the entire request path regardless of what follows." example="/old → /new" />
                                    }
                                  </label>
                                  <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                    value={rewritePathType}
                                    onChange={(e) => setRewritePathType(e.target.value as 'ReplacePrefixMatch' | 'ReplaceFullPath')}
                                  >
                                    <option value="ReplacePrefixMatch">Replace Prefix Match</option>
                                    <option value="ReplaceFullPath">Replace Full Path</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    {rewritePathType === 'ReplacePrefixMatch' ? 'New Prefix' : 'New Path'}
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    placeholder={rewritePathType === 'ReplacePrefixMatch' ? 'e.g., /v2' : 'e.g., /new/path'}
                                    value={rewritePathValue}
                                    onChange={(e) => setRewritePathValue(e.target.value)}
                                  />
                                </div>
                                {rewritePathType === 'ReplacePrefixMatch' && watchPathType !== 'Prefix' && (
                                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800">
                                      <strong>Warning:</strong> Replace Prefix Match only works with Prefix path matching.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Live Preview */}
                          {(rewriteHostnameEnabled || rewritePathEnabled) && (
                            <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono">
                              <p className="text-gray-400 mb-2">Live Preview:</p>
                              <div className="space-y-2">
                                <div className="text-gray-300">
                                  <span className="text-gray-500">Before: </span>
                                  <span className="text-red-400">{getRewritePreview().original.host}</span>
                                  <span className="text-yellow-400">{getRewritePreview().original.path}</span>
                                </div>
                                <div className="text-gray-300">
                                  <span className="text-gray-500">After:  </span>
                                  <span className="text-green-400">{getRewritePreview().rewritten.host}</span>
                                  <span className="text-primary-400">{getRewritePreview().rewritten.path}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Compression Section - only for backend routes */}
                  {routeType === 'backend' && (
                    <AccordionItem value="compression">
                      <AccordionTrigger
                        value="compression"
                        badge={
                          compressionEnabled && compressionTypes.length > 0 && (
                            <Badge variant="success">{compressionTypes.length} type{compressionTypes.length > 1 ? 's' : ''}</Badge>
                          )
                        }
                      >
                        Response Compression
                      </AccordionTrigger>
                      <AccordionContent value="compression">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="compressionEnabled"
                              checked={compressionEnabled}
                              onChange={(e) => {
                                setCompressionEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setCompressionTypes([]);
                                }
                              }}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="compressionEnabled" className="text-sm font-medium text-gray-700">
                              Enable Response Compression
                            </label>
                          </div>

                          <p className="text-xs text-gray-500">
                            Compress responses from backend services before sending to clients. This can significantly reduce bandwidth usage.
                          </p>

                          {compressionEnabled && (
                            <div className="space-y-4 pt-4 border-t">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Compression Types
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                  Select one or more compression algorithms. Envoy will negotiate the best option with the client.
                                </p>
                                <div className="space-y-2">
                                  {(['Gzip', 'Brotli', 'Zstd'] as CompressionType[]).map((type) => (
                                    <label key={type} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                      <input
                                        type="checkbox"
                                        checked={compressionTypes.includes(type)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setCompressionTypes([...compressionTypes, type]);
                                          } else {
                                            setCompressionTypes(compressionTypes.filter(t => t !== type));
                                          }
                                        }}
                                        className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                      />
                                      <div>
                                        <span className="text-sm font-medium text-gray-900">{type}</span>
                                        <p className="text-xs text-gray-500">
                                          {type === 'Gzip' && 'Most compatible, widely supported by all browsers'}
                                          {type === 'Brotli' && 'Better compression ratio, supported by modern browsers'}
                                          {type === 'Zstd' && 'Fastest compression, newer standard with growing support'}
                                        </p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {compressionTypes.length === 0 && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                  <p className="text-sm text-yellow-800">
                                    Please select at least one compression type.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Retry Section - only for backend routes */}
                  {routeType === 'backend' && (
                    <AccordionItem value="retry">
                      <AccordionTrigger
                        value="retry"
                        badge={retryEnabled && <Badge variant="success">Enabled</Badge>}
                      >
                        Retry Policy
                      </AccordionTrigger>
                      <AccordionContent value="retry">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="retryEnabled"
                              checked={retryEnabled}
                              onChange={(e) => {
                                setRetryEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setRetryNumRetries('');
                                  setRetryHttpStatusCodes([]);
                                  setRetryStatusCodeInput('');
                                  setRetryTriggers([]);
                                  setRetryTimeout('');
                                  setRetryBackOffBaseInterval('');
                                  setRetryBackOffMaxInterval('');
                                }
                              }}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="retryEnabled" className="text-sm font-medium text-gray-700">
                              Enable Retry
                            </label>
                          </div>
                          <p className="text-sm text-gray-500">
                            Automatically retry failed requests to backend services.
                          </p>

                          {retryEnabled && (
                            <div className="space-y-6 pt-4 border-t">
                              {/* Number of Retries */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Number of Retries
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={retryNumRetries}
                                  onChange={(e) => setRetryNumRetries(e.target.value)}
                                  placeholder="2"
                                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                  Maximum number of retry attempts. Defaults to 2 if not set.
                                </p>
                              </div>

                              {/* HTTP Status Codes */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  HTTP Status Codes
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {retryHttpStatusCodes.map((code) => (
                                    <span
                                      key={code}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                                    >
                                      {code}
                                      <button
                                        type="button"
                                        onClick={() => setRetryHttpStatusCodes(retryHttpStatusCodes.filter(c => c !== code))}
                                        className="text-primary-600 hover:text-primary-800"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    min="100"
                                    max="599"
                                    value={retryStatusCodeInput}
                                    onChange={(e) => setRetryStatusCodeInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const code = parseInt(retryStatusCodeInput, 10);
                                        if (code >= 100 && code <= 599 && !retryHttpStatusCodes.includes(code)) {
                                          setRetryHttpStatusCodes([...retryHttpStatusCodes, code]);
                                          setRetryStatusCodeInput('');
                                        }
                                      }
                                    }}
                                    placeholder="e.g. 500, 502, 503"
                                    className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                  />
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      const code = parseInt(retryStatusCodeInput, 10);
                                      if (code >= 100 && code <= 599 && !retryHttpStatusCodes.includes(code)) {
                                        setRetryHttpStatusCodes([...retryHttpStatusCodes, code]);
                                        setRetryStatusCodeInput('');
                                      }
                                    }}
                                  >
                                    Add
                                  </Button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  Retry when the response matches these HTTP status codes.
                                </p>
                              </div>

                              {/* HTTP Triggers */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  HTTP Triggers
                                </label>
                                <div className="space-y-2">
                                  {[
                                    { value: '5xx', label: '5xx', description: 'Retry on any 5xx response code' },
                                    { value: 'gateway-error', label: 'Gateway Error', description: 'Retry on 502, 503, or 504 response codes' },
                                    { value: 'connect-failure', label: 'Connection Failure', description: 'Retry when the connection to the backend fails' },
                                    { value: 'retriable-status-codes', label: 'Retriable Status Codes', description: 'Retry when the response matches configured HTTP status codes' },
                                    { value: 'reset', label: 'Connection Reset', description: 'Retry when the connection is reset by the backend' },
                                    { value: 'reset-before-request', label: 'Reset Before Request', description: 'Retry when the connection is reset before the request is sent' },
                                    { value: 'retriable-4xx', label: 'Retriable 4xx', description: 'Retry on retriable 4xx response codes (e.g. 409)' },
                                    { value: 'refused-stream', label: 'Refused Stream', description: 'Retry when the backend refuses the stream' },
                                  ].map((trigger) => (
                                    <label key={trigger.value} className="flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={retryTriggers.includes(trigger.value)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setRetryTriggers([...retryTriggers, trigger.value]);
                                          } else {
                                            setRetryTriggers(retryTriggers.filter(t => t !== trigger.value));
                                          }
                                        }}
                                        className="mt-0.5 h-4 w-4 text-primary-600 rounded border-gray-300"
                                      />
                                      <div>
                                        <span className="text-sm font-medium text-gray-700">{trigger.label}</span>
                                        <p className="text-xs text-gray-500">{trigger.description}</p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* gRPC Triggers - only shown when protocol is grpc */}
                              {watch('protocol') === 'grpc' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    gRPC Triggers
                                  </label>
                                  <div className="space-y-2">
                                    {[
                                      { value: 'cancelled', label: 'Cancelled', description: 'Retry when the gRPC request is cancelled' },
                                      { value: 'deadline-exceeded', label: 'Deadline Exceeded', description: 'Retry when the gRPC deadline is exceeded' },
                                      { value: 'internal', label: 'Internal Error', description: 'Retry on gRPC internal errors' },
                                      { value: 'resource-exhausted', label: 'Resource Exhausted', description: 'Retry when gRPC reports resource exhaustion' },
                                      { value: 'unavailable', label: 'Unavailable', description: 'Retry when the gRPC service is unavailable' },
                                    ].map((trigger) => (
                                      <label key={trigger.value} className="flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={retryTriggers.includes(trigger.value)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setRetryTriggers([...retryTriggers, trigger.value]);
                                            } else {
                                              setRetryTriggers(retryTriggers.filter(t => t !== trigger.value));
                                            }
                                          }}
                                          className="mt-0.5 h-4 w-4 text-primary-600 rounded border-gray-300"
                                        />
                                        <div>
                                          <span className="text-sm font-medium text-gray-700">{trigger.label}</span>
                                          <p className="text-xs text-gray-500">{trigger.description}</p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Per-Retry Settings */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                  Per-Retry Settings
                                </label>
                                <div className="space-y-3 pl-1">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Per-Attempt Timeout <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." />
                                    </label>
                                    <input
                                      type="text"
                                      value={retryTimeout}
                                      onChange={(e) => setRetryTimeout(e.target.value)}
                                      placeholder="e.g. 1s"
                                      className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                      Timeout for each retry attempt. Uses Go duration format (e.g. 250ms, 1s, 10s).
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Backoff Base Interval <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." />
                                    </label>
                                    <input
                                      type="text"
                                      value={retryBackOffBaseInterval}
                                      onChange={(e) => setRetryBackOffBaseInterval(e.target.value)}
                                      placeholder="e.g. 25ms"
                                      className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                      Initial wait between retries.
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Backoff Max Interval <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." />
                                    </label>
                                    <input
                                      type="text"
                                      value={retryBackOffMaxInterval}
                                      onChange={(e) => setRetryBackOffMaxInterval(e.target.value)}
                                      placeholder="e.g. 250ms"
                                      className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                      Maximum wait between retries. Must be greater than or equal to base interval.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Load Balancing Section */}
                  {routeType === 'backend' && (
                    <AccordionItem value="load-balancing">
                      <AccordionTrigger
                        value="load-balancing"
                        badge={lbEnabled && <Badge variant="success">{lbType === 'ConsistentHash' ? `ConsistentHash (${lbConsistentHashType})` : lbType}</Badge>}
                      >
                        Load Balancing
                      </AccordionTrigger>
                      <AccordionContent value="load-balancing">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="lb-enabled"
                              checked={lbEnabled}
                              onChange={(e) => {
                                setLbEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setLbType('RoundRobin');
                                  setLbConsistentHashType('SourceIP');
                                  setLbHeaderName('');
                                  setLbCookieName('');
                                  setLbCookieTTL('');
                                  setLbCookieAttributes([]);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="lb-enabled" className="text-sm font-medium text-gray-700">
                              Enable Load Balancing
                            </label>
                          </div>
                          <p className="text-sm text-gray-500 italic">
                            Configure how traffic is distributed across backend endpoints. When not configured, Envoy Gateway defaults to Least Request.
                          </p>

                          {lbEnabled && (
                            <div className="space-y-6 pt-4 border-t">
                              {/* LB Type Selection */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Algorithm</label>
                                <div className="grid grid-cols-2 gap-3">
                                  {([
                                    { value: 'RoundRobin' as LoadBalancerType, label: 'Round Robin', desc: 'Distributes requests evenly across all backends in order' },
                                    { value: 'Random' as LoadBalancerType, label: 'Random', desc: 'Distributes requests randomly across backends' },
                                    { value: 'LeastRequest' as LoadBalancerType, label: 'Least Request', desc: 'Sends requests to the backend with fewest active requests' },
                                    { value: 'ConsistentHash' as LoadBalancerType, label: 'Consistent Hash', desc: 'Routes requests to the same backend based on a hash key' },
                                  ]).map(option => (
                                    <label
                                      key={option.value}
                                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${lbType === option.value ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                                    >
                                      <input
                                        type="radio"
                                        name="lb-type"
                                        value={option.value}
                                        checked={lbType === option.value}
                                        onChange={() => setLbType(option.value)}
                                        className="mt-0.5 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                                      />
                                      <div>
                                        <span className="text-sm font-medium text-gray-900">{option.label}</span>
                                        <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* ConsistentHash Options */}
                              {lbType === 'ConsistentHash' && (
                                <div className="space-y-4 pt-4 border-t">
                                  <label className="block text-sm font-medium text-gray-700 mb-3">Hash Key</label>
                                  <div className="space-y-3">
                                    {([
                                      { value: 'SourceIP' as ConsistentHashType, label: 'Source IP', desc: 'Hash based on client IP address' },
                                      { value: 'Header' as ConsistentHashType, label: 'Header', desc: 'Hash based on a specific HTTP header value' },
                                      { value: 'Cookie' as ConsistentHashType, label: 'Cookie', desc: 'Hash based on a specific cookie value' },
                                    ]).map(option => (
                                      <label
                                        key={option.value}
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${lbConsistentHashType === option.value ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                                      >
                                        <input
                                          type="radio"
                                          name="lb-hash-type"
                                          value={option.value}
                                          checked={lbConsistentHashType === option.value}
                                          onChange={() => setLbConsistentHashType(option.value)}
                                          className="mt-0.5 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <div>
                                          <span className="text-sm font-medium text-gray-900">{option.label}</span>
                                          <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>

                                  {/* Header Name Input */}
                                  {lbConsistentHashType === 'Header' && (
                                    <div className="pt-3">
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Header Name</label>
                                      <input
                                        type="text"
                                        value={lbHeaderName}
                                        onChange={(e) => setLbHeaderName(e.target.value)}
                                        placeholder="e.g. X-User-Id"
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                      />
                                      <p className="mt-1 text-xs text-gray-500">The HTTP header to use for consistent hashing.</p>
                                      {!lbHeaderName && (
                                        <p className="mt-1 text-xs text-amber-600">Header name is required.</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Cookie Configuration */}
                                  {lbConsistentHashType === 'Cookie' && (
                                    <div className="space-y-4 pt-3">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cookie Name</label>
                                        <input
                                          type="text"
                                          value={lbCookieName}
                                          onChange={(e) => setLbCookieName(e.target.value)}
                                          placeholder="e.g. session-cookie"
                                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">The cookie to use for consistent hashing.</p>
                                        {!lbCookieName && (
                                          <p className="mt-1 text-xs text-amber-600">Cookie name is required.</p>
                                        )}
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cookie TTL (optional) <InfoTooltip text="Duration format: number + unit. Examples: 500ms, 5s, 1m, 1h." /></label>
                                        <input
                                          type="text"
                                          value={lbCookieTTL}
                                          onChange={(e) => setLbCookieTTL(e.target.value)}
                                          placeholder="e.g. 60s, 1h"
                                          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Time-to-live for the cookie (Go duration format).</p>
                                      </div>

                                      {/* Cookie Attributes */}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Cookie Attributes (optional)</label>
                                        {lbCookieAttributes.length > 0 && (
                                          <div className="flex flex-wrap gap-2 mb-3">
                                            {lbCookieAttributes.map((attr, idx) => (
                                              <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs">
                                                {attr.key}={attr.value}
                                                <button
                                                  type="button"
                                                  onClick={() => setLbCookieAttributes(prev => prev.filter((_, i) => i !== idx))}
                                                  className="text-primary-400 hover:text-primary-600"
                                                >
                                                  <X className="h-3 w-3" />
                                                </button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            value={lbCookieAttrKeyInput}
                                            onChange={(e) => setLbCookieAttrKeyInput(e.target.value)}
                                            placeholder="Key (e.g. SameSite)"
                                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                          />
                                          <input
                                            type="text"
                                            value={lbCookieAttrValueInput}
                                            onChange={(e) => setLbCookieAttrValueInput(e.target.value)}
                                            placeholder="Value (e.g. Strict)"
                                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                          />
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                              if (lbCookieAttrKeyInput && lbCookieAttrValueInput) {
                                                setLbCookieAttributes(prev => [...prev, { key: lbCookieAttrKeyInput, value: lbCookieAttrValueInput }]);
                                                setLbCookieAttrKeyInput('');
                                                setLbCookieAttrValueInput('');
                                              }
                                            }}
                                            disabled={!lbCookieAttrKeyInput || !lbCookieAttrValueInput}
                                          >
                                            <Plus className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">e.g. SameSite=Strict, HttpOnly=true, Secure=true</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Circuit Breaker Section */}
                  {routeType === 'backend' && (
                    <AccordionItem value="circuit-breaker">
                      <AccordionTrigger
                        value="circuit-breaker"
                        badge={cbEnabled && <Badge variant="success">Enabled</Badge>}
                      >
                        Circuit Breaker
                      </AccordionTrigger>
                      <AccordionContent value="circuit-breaker">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cbEnabled}
                                onChange={(e) => setCbEnabled(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-sm font-medium">Enable Circuit Breaker</span>
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">
                            Protect backend services from being overwhelmed by limiting concurrent connections and requests.
                          </p>

                          {cbEnabled && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Max Connections</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="1024 (default)"
                                    value={cbMaxConnections}
                                    onChange={(e) => setCbMaxConnections(e.target.value)}
                                  />
                                  <p className="mt-1 text-xs text-gray-500">Maximum number of connections to the backend</p>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Max Pending Requests</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="1024 (default)"
                                    value={cbMaxPendingRequests}
                                    onChange={(e) => setCbMaxPendingRequests(e.target.value)}
                                  />
                                  <p className="mt-1 text-xs text-gray-500">Maximum number of requests queued when all connections are busy</p>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Max Parallel Requests</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="1024 (default)"
                                    value={cbMaxParallelRequests}
                                    onChange={(e) => setCbMaxParallelRequests(e.target.value)}
                                  />
                                  <p className="mt-1 text-xs text-gray-500">Maximum number of parallel requests to the backend</p>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Max Parallel Retries</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="1024 (default)"
                                    value={cbMaxParallelRetries}
                                    onChange={(e) => setCbMaxParallelRetries(e.target.value)}
                                  />
                                  <p className="mt-1 text-xs text-gray-500">Maximum number of parallel retries to the backend</p>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Max Requests Per Connection</label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Unlimited (default)"
                                  value={cbMaxRequestsPerConnection}
                                  onChange={(e) => setCbMaxRequestsPerConnection(e.target.value)}
                                />
                                <p className="mt-1 text-xs text-gray-500">Maximum requests per single connection. Set to 1 to disable keep-alive.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                </Accordion>

                {tabErrors.traffic && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {tabErrors.traffic}
                  </div>
                )}
              </TabsContent>

              {/* Extensions Tab */}
              <TabsContent value="extensions">
                <div className="space-y-6">
                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <h4 className="text-sm font-medium text-primary-800 mb-1">Envoy Extensions</h4>
                    <p className="text-xs text-primary-600">
                      Add custom Lua scripts, WebAssembly (Wasm) modules, or external processing (ext-proc) services to extend Envoy&apos;s request/response processing.
                    </p>
                  </div>

                  <Accordion type="multiple" defaultValue={[]}>
                    {/* Lua Extension Section */}
                    <AccordionItem value="lua">
                      <AccordionTrigger
                        value="lua"
                        badge={luaExtension && (
                          <Badge variant="success">
                            {luaExtension.type === 'Inline' ? 'Inline' : 'ConfigMap'}
                          </Badge>
                        )}
                      >
                        Lua Extension
                      </AccordionTrigger>
                      <AccordionContent value="lua">
                        <div className="space-y-4">
                          <LuaExtensionForm
                            value={luaExtension}
                            onChange={setLuaExtension}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Wasm Extension Section */}
                    <AccordionItem value="wasm">
                      <AccordionTrigger
                        value="wasm"
                        badge={wasmExtension && (
                          <Badge variant="success">{wasmExtension.name}</Badge>
                        )}
                      >
                        Wasm Extension
                      </AccordionTrigger>
                      <AccordionContent value="wasm">
                        <div className="space-y-4">
                          <WasmExtensionForm
                            value={wasmExtension}
                            onChange={setWasmExtension}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Ext-Proc Extension Section */}
                    <AccordionItem value="ext-proc">
                      <AccordionTrigger
                        value="ext-proc"
                        badge={extProcExtension && (
                          <Badge variant="success">{extProcExtension.backendRef.name || 'ext-proc'}</Badge>
                        )}
                      >
                        External Processing (ext-proc)
                      </AccordionTrigger>
                      <AccordionContent value="ext-proc">
                        <div className="space-y-4">
                          <ExtProcExtensionForm
                            value={extProcExtension}
                            onChange={setExtProcExtension}
                            disabled={isSubmitting}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security">
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Security Mode</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`px-4 py-2 rounded text-sm ${securityMode === 'general' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                      onClick={() => setSecurityMode('general')}
                    >
                      General (Recommended)
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded text-sm ${securityMode === 'client' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                      onClick={() => setSecurityMode('client')}
                    >
                      Client-Based
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {securityMode === 'general'
                      ? <><span>Configure security features directly on the route (IP, API Key, JWT, OIDC).</span> <InfoTooltip text="Security features (IP, API Key, JWT, OIDC) are configured directly on the route. All requests are subject to the same rules." /></>
                      : <><span>Security is configured per-client via client attachments.</span> <InfoTooltip text="Security is configured per-client via attachments. Each client gets its own credentials and can have individual rate limits. Use the Clients tab to manage." /></>}
                  </p>
                </div>
                <Accordion type="multiple" defaultValue={corsEnabled ? ['cors'] : []}>
                  <AccordionItem value="cors">
                    <AccordionTrigger
                      value="cors"
                      badge={corsEnabled && <Badge variant="success">Enabled</Badge>}
                    >
                      CORS Configuration
                    </AccordionTrigger>
                    <AccordionContent value="cors">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="corsEnabled"
                            checked={corsEnabled}
                            onChange={(e) => setCorsEnabled(e.target.checked)}
                            className="h-4 w-4 text-primary-600 rounded border-gray-300"
                          />
                          <label htmlFor="corsEnabled" className="text-sm font-medium text-gray-700">
                            Enable CORS
                          </label>
                        </div>

                        {corsEnabled && (
                          <div className="space-y-4 pt-4 border-t">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Allowed Origins
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="e.g., https://example.com, http://*.foo.com"
                                value={corsAllowOrigins.join(', ')}
                                onChange={(e) => setCorsAllowOrigins(parseArrayInput(e.target.value))}
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Comma-separated list of origins. Supports wildcards
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Allowed Methods
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((method) => (
                                  <label key={method} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={corsAllowMethods.includes(method)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCorsAllowMethods([...corsAllowMethods, method]);
                                        } else {
                                          setCorsAllowMethods(corsAllowMethods.filter(m => m !== method));
                                        }
                                      }}
                                      className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm text-gray-700">{method}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Allowed Headers
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="e.g., Content-Type, Authorization, X-Custom-Header"
                                value={corsAllowHeaders.join(', ')}
                                onChange={(e) => setCorsAllowHeaders(parseArrayInput(e.target.value))}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Expose Headers <InfoTooltip text="Response headers that JavaScript in the browser is allowed to read. By default, browsers only expose simple headers like Content-Type." />
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="e.g., X-Request-Id, X-Response-Time"
                                value={corsExposeHeaders.join(', ')}
                                onChange={(e) => setCorsExposeHeaders(parseArrayInput(e.target.value))}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Max Age (seconds) <InfoTooltip text="How long (in seconds) browsers cache the preflight (OPTIONS) response. Higher values reduce preflight requests." example="86400 = 24 hours" />
                                </label>
                                <input
                                  type="number"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  placeholder="e.g., 3600"
                                  value={corsMaxAge}
                                  onChange={(e) => setCorsMaxAge(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Allow Credentials
                                </label>
                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={corsAllowCredentials}
                                    onChange={(e) => setCorsAllowCredentials(e.target.checked)}
                                    className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                  />
                                  <span className="text-sm text-gray-600">Allow cookies and credentials</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {!corsEnabled && (
                          <p className="text-sm text-gray-500">
                            Enable CORS to configure cross-origin access for this route.
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {securityMode === 'general' && (
                    <AccordionItem value="ip-allowlist">
                      <AccordionTrigger
                        value="ip-allowlist"
                        badge={ipAllowlistEnabled && <Badge variant="success">Enabled</Badge>}
                      >
                        <div className="flex items-center gap-2">
                          IP Allowlisting
                        </div>
                      </AccordionTrigger>
                      <AccordionContent value="ip-allowlist">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="ipAllowlistEnabled"
                              checked={ipAllowlistEnabled}
                              onChange={(e) => setIpAllowlistEnabled(e.target.checked)}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="ipAllowlistEnabled" className="text-sm font-medium text-gray-700">
                              Enable IP Allowlisting <InfoTooltip text="Only allow requests from these IP ranges. All other requests receive 403 Forbidden." />
                            </label>
                          </div>
                          {ipAllowlistEnabled && (
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">Allowed CIDRs <InfoTooltip text="IP range in CIDR notation. Use /32 for a single IP." example="10.0.0.0/8, 192.168.1.100/32" /></label>
                              <div className="flex gap-2">
                                <Input
                                  value={ipCidrInput}
                                  onChange={(e) => setIpCidrInput(e.target.value)}
                                  placeholder="e.g., 10.0.0.0/8"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (ipCidrInput.trim()) {
                                        setIpAllowlistCidrs([...ipAllowlistCidrs, ipCidrInput.trim()]);
                                        setIpCidrInput('');
                                      }
                                    }
                                  }}
                                />
                                <Button type="button" variant="secondary" onClick={() => {
                                  if (ipCidrInput.trim()) {
                                    setIpAllowlistCidrs([...ipAllowlistCidrs, ipCidrInput.trim()]);
                                    setIpCidrInput('');
                                  }
                                }}>Add</Button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {ipAllowlistCidrs.map((cidr, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                    {cidr}
                                    <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setIpAllowlistCidrs(ipAllowlistCidrs.filter((_, j) => j !== i))}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {securityMode === 'general' && (
                    <AccordionItem value="header-method-auth">
                      <AccordionTrigger
                        value="header-method-auth"
                        badge={headerMethodAuthEnabled && <Badge variant="success">Enabled</Badge>}
                      >
                        <div className="flex items-center gap-2">
                          Header & Method Authorization
                        </div>
                      </AccordionTrigger>
                      <AccordionContent value="header-method-auth">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="headerMethodAuthEnabled"
                              checked={headerMethodAuthEnabled}
                              onChange={(e) => setHeaderMethodAuthEnabled(e.target.checked)}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="headerMethodAuthEnabled" className="text-sm font-medium text-gray-700">
                              Enable Header & Method Authorization <InfoTooltip text="Restrict access based on required HTTP headers and allowed HTTP methods." />
                            </label>
                          </div>

                          {headerMethodAuthEnabled && (
                            <div className="space-y-4 pt-4 border-t">
                              {/* Header Matches */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Header Matches</label>
                                <p className="text-sm text-gray-500 mb-2">Require specific HTTP headers to be present with matching values.</p>
                                {authHeaders.map((header, idx) => (
                                  <div key={idx} className="flex gap-2 items-center mt-2">
                                    <input
                                      type="text"
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                      placeholder="Header name (e.g., x-team)"
                                      value={header.name}
                                      onChange={(e) => {
                                        const updated = [...authHeaders];
                                        updated[idx] = { ...updated[idx], name: e.target.value };
                                        setAuthHeaders(updated);
                                      }}
                                    />
                                    <input
                                      type="text"
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                      placeholder="Values (comma-separated)"
                                      value={header.values}
                                      onChange={(e) => {
                                        const updated = [...authHeaders];
                                        updated[idx] = { ...updated[idx], values: e.target.value };
                                        setAuthHeaders(updated);
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setAuthHeaders(authHeaders.filter((_, i) => i !== idx))}
                                      className="text-gray-400 hover:text-red-500"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => setAuthHeaders([...authHeaders, { name: '', values: '' }])}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add Header Match
                                </Button>
                              </div>

                              {/* HTTP Methods */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Allowed HTTP Methods</label>
                                <p className="text-sm text-gray-500 mb-2">Restrict which HTTP methods are allowed.</p>
                                <div className="flex flex-wrap gap-2">
                                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(method => (
                                    <label key={method} className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={authMethods.includes(method)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setAuthMethods([...authMethods, method]);
                                          } else {
                                            setAuthMethods(authMethods.filter(m => m !== method));
                                          }
                                        }}
                                        className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                      />
                                      <span className="text-sm text-gray-700">{method}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {securityMode === 'general' && (
                    <AccordionItem value="apikey-auth">
                      <AccordionTrigger
                        value="apikey-auth"
                        badge={apiKeyAuthEnabled && <Badge variant="success">Enabled</Badge>}
                      >
                        <div className="flex items-center gap-2">
                          API Key Authentication
                        </div>
                      </AccordionTrigger>
                      <AccordionContent value="apikey-auth">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="apiKeyAuthEnabled"
                              checked={apiKeyAuthEnabled}
                              onChange={(e) => setApiKeyAuthEnabled(e.target.checked)}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="apiKeyAuthEnabled" className="text-sm font-medium text-gray-700">
                              Enable API Key Authentication
                            </label>
                          </div>
                          {apiKeyAuthEnabled && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">K8s Secret Name <InfoTooltip text="A Kubernetes Secret in the fastgateway-system namespace. Each key in the secret is a valid API key." example="kubectl create secret generic my-keys --from-literal=key1=secret-value" /></label>
                                <Input value={apiKeySecretName} onChange={(e) => setApiKeySecretName(e.target.value)} placeholder="e.g., my-api-keys" />
                                <p className="text-xs text-gray-500 mt-1">Name of the pre-created Kubernetes Secret containing API keys</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Header Name <InfoTooltip text="The HTTP header where clients send their API key." example="x-api-key" /></label>
                                <Input value={apiKeyHeaderName} onChange={(e) => setApiKeyHeaderName(e.target.value)} placeholder="x-api-key" />
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {securityMode === 'general' && (
                    <AccordionItem value="jwt-auth">
                      <AccordionTrigger
                        value="jwt-auth"
                        badge={jwtAuthEnabled && <Badge variant="success">Enabled</Badge>}
                      >
                        <div className="flex items-center gap-2">
                          JWT Validation
                        </div>
                      </AccordionTrigger>
                      <AccordionContent value="jwt-auth">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="jwtAuthEnabled"
                              checked={jwtAuthEnabled}
                              onChange={(e) => setJwtAuthEnabled(e.target.checked)}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="jwtAuthEnabled" className="text-sm font-medium text-gray-700">
                              Enable JWT Validation
                            </label>
                          </div>
                          {jwtAuthEnabled && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Issuer <InfoTooltip text="The expected 'iss' claim in the JWT. Must exactly match the issuer URL in tokens from your identity provider." /></label>
                                <Input value={jwtIssuer} onChange={(e) => setJwtIssuer(e.target.value)} placeholder="https://accounts.google.com" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">JWKS URL <InfoTooltip text="JSON Web Key Set URL — where your identity provider publishes its public keys for JWT verification." example="https://accounts.google.com/.well-known/jwks.json" /></label>
                                <Input value={jwtJwksUrl} onChange={(e) => setJwtJwksUrl(e.target.value)} placeholder="https://www.googleapis.com/oauth2/v3/certs" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Audiences (optional) <InfoTooltip text="Expected 'aud' claim values. If set, the JWT must contain one of these audiences. Typically your API identifier." example="my-api" /></label>
                                <div className="flex gap-2">
                                  <Input
                                    value={jwtAudienceInput}
                                    onChange={(e) => setJwtAudienceInput(e.target.value)}
                                    placeholder="Add audience"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (jwtAudienceInput.trim()) {
                                          setJwtAudiences([...jwtAudiences, jwtAudienceInput.trim()]);
                                          setJwtAudienceInput('');
                                        }
                                      }
                                    }}
                                  />
                                  <Button type="button" variant="secondary" onClick={() => {
                                    if (jwtAudienceInput.trim()) {
                                      setJwtAudiences([...jwtAudiences, jwtAudienceInput.trim()]);
                                      setJwtAudienceInput('');
                                    }
                                  }}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {jwtAudiences.map((aud, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                      {aud}
                                      <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setJwtAudiences(jwtAudiences.filter((_, j) => j !== i))}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {securityMode === 'general' && (
                    <AccordionItem value="oidc">
                      <AccordionTrigger
                        value="oidc"
                        badge={oidcEnabled && <Badge variant="success">Enabled</Badge>}
                      >
                        <div className="flex items-center gap-2">
                          OIDC / SSO Login
                        </div>
                      </AccordionTrigger>
                      <AccordionContent value="oidc">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="oidcEnabled"
                              checked={oidcEnabled}
                              onChange={(e) => setOidcEnabled(e.target.checked)}
                              className="h-4 w-4 text-primary-600 rounded border-gray-300"
                            />
                            <label htmlFor="oidcEnabled" className="text-sm font-medium text-gray-700">
                              Enable OIDC / SSO Login <InfoTooltip text="Browser-based OAuth2/OpenID Connect login flow. Users are redirected to the identity provider to sign in. For API-to-API auth, use JWT instead." />
                            </label>
                          </div>
                          {oidcEnabled && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Issuer URL</label>
                                <Input value={oidcIssuer} onChange={(e) => setOidcIssuer(e.target.value)} placeholder="https://accounts.google.com" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                                <Input value={oidcClientId} onChange={(e) => setOidcClientId(e.target.value)} placeholder="my-app-client-id" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret Name (K8s Secret) <InfoTooltip text="A Kubernetes Secret containing the OAuth2 client secret." example="kubectl create secret generic my-oidc-secret --from-literal=client-secret=YOUR_SECRET" /></label>
                                <Input value={oidcClientSecretName} onChange={(e) => setOidcClientSecretName(e.target.value)} placeholder="my-oidc-secret" />
                                <p className="text-xs text-gray-500 mt-1">Name of the pre-created Kubernetes Secret containing the OIDC client secret</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URL <InfoTooltip text="The OAuth2 callback URL. Must match the redirect URI registered with your identity provider." example="https://app.example.com/oauth2/callback" /></label>
                                <Input value={oidcRedirectUrl} onChange={(e) => setOidcRedirectUrl(e.target.value)} placeholder="https://app.example.com/oauth2/callback" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Logout Path</label>
                                <Input value={oidcLogoutPath} onChange={(e) => setOidcLogoutPath(e.target.value)} placeholder="/logout" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Scopes <InfoTooltip text="OAuth2 scopes to request. 'openid' is required. Common: email, profile, groups." /></label>
                                <div className="flex gap-2">
                                  <Input
                                    value={oidcScopeInput}
                                    onChange={(e) => setOidcScopeInput(e.target.value)}
                                    placeholder="Add scope"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (oidcScopeInput.trim()) {
                                          setOidcScopes([...oidcScopes, oidcScopeInput.trim()]);
                                          setOidcScopeInput('');
                                        }
                                      }
                                    }}
                                  />
                                  <Button type="button" variant="secondary" onClick={() => {
                                    if (oidcScopeInput.trim()) {
                                      setOidcScopes([...oidcScopes, oidcScopeInput.trim()]);
                                      setOidcScopeInput('');
                                    }
                                  }}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {oidcScopes.map((scope, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                      {scope}
                                      <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setOidcScopes(oidcScopes.filter((_, j) => j !== i))}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cookie Domain (optional)</label>
                                <Input value={oidcCookieDomain} onChange={(e) => setOidcCookieDomain(e.target.value)} placeholder="example.com" />
                                <p className="text-xs text-gray-500 mt-1">For cross-subdomain SSO</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* External Authorization (both modes) */}
                  <AccordionItem value="ext-auth">
                    <AccordionTrigger
                      value="ext-auth"
                      badge={extAuthEnabled && <Badge variant="success">Enabled</Badge>}
                    >
                      <div className="flex items-center gap-2">
                        External Authorization
                      </div>
                    </AccordionTrigger>
                    <AccordionContent value="ext-auth">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="extAuthEnabled"
                            checked={extAuthEnabled}
                            onChange={(e) => setExtAuthEnabled(e.target.checked)}
                            className="h-4 w-4 text-primary-600 rounded border-gray-300"
                          />
                          <label htmlFor="extAuthEnabled" className="text-sm font-medium text-gray-700">
                            Enable External Authorization
                          </label>
                        </div>
                        <p className="text-xs text-gray-500">
                          Delegate authorization decisions to an external HTTP or gRPC service.
                        </p>
                        {extAuthEnabled && (
                          <div className="space-y-4">
                            {/* Type Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                              <Select
                                value={extAuthType}
                                onChange={(e) => setExtAuthType(e.target.value as 'http' | 'grpc')}
                                options={[
                                  { value: 'http', label: 'HTTP' },
                                  { value: 'grpc', label: 'gRPC' },
                                ]}
                              />
                            </div>

                            {/* Backend Service */}
                            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                              <h4 className="text-sm font-medium text-gray-700">Backend Service</h4>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                                <Input
                                  value={extAuthServiceName}
                                  onChange={(e) => setExtAuthServiceName(e.target.value)}
                                  placeholder="auth-service"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Namespace (optional)</label>
                                <Input
                                  value={extAuthServiceNamespace}
                                  onChange={(e) => setExtAuthServiceNamespace(e.target.value)}
                                  placeholder="auth-system"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                                <Input
                                  type="number"
                                  value={extAuthServicePort}
                                  onChange={(e) => setExtAuthServicePort(parseInt(e.target.value) || 8080)}
                                  placeholder="8080"
                                />
                              </div>
                            </div>

                            {/* HTTP-specific options */}
                            {extAuthType === 'http' && (
                              <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                                <h4 className="text-sm font-medium text-gray-700">HTTP Options</h4>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Authorization Path</label>
                                  <Input
                                    value={extAuthPath}
                                    onChange={(e) => setExtAuthPath(e.target.value)}
                                    placeholder="/auth"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Headers to Backend</label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={extAuthHeaderToBackendInput}
                                      onChange={(e) => setExtAuthHeaderToBackendInput(e.target.value)}
                                      placeholder="Add header name"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (extAuthHeaderToBackendInput.trim()) {
                                            setExtAuthHeadersToBackend([...extAuthHeadersToBackend, extAuthHeaderToBackendInput.trim()]);
                                            setExtAuthHeaderToBackendInput('');
                                          }
                                        }
                                      }}
                                    />
                                    <Button type="button" variant="secondary" onClick={() => {
                                      if (extAuthHeaderToBackendInput.trim()) {
                                        setExtAuthHeadersToBackend([...extAuthHeadersToBackend, extAuthHeaderToBackendInput.trim()]);
                                        setExtAuthHeaderToBackendInput('');
                                      }
                                    }}>Add</Button>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {extAuthHeadersToBackend.map((h, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                        {h}
                                        <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setExtAuthHeadersToBackend(extAuthHeadersToBackend.filter((_, j) => j !== i))}>
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">Headers forwarded to the auth service</p>
                                </div>
                              </div>
                            )}

                            {/* Common options */}
                            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                              <h4 className="text-sm font-medium text-gray-700">Advanced Options</h4>

                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id="extAuthFailOpen"
                                  checked={extAuthFailOpen}
                                  onChange={(e) => setExtAuthFailOpen(e.target.checked)}
                                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                />
                                <label htmlFor="extAuthFailOpen" className="text-sm text-gray-700">
                                  Fail Open (allow traffic if auth service unavailable)
                                </label>
                              </div>

                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id="extAuthIncludeBody"
                                  checked={extAuthIncludeBody}
                                  onChange={(e) => setExtAuthIncludeBody(e.target.checked)}
                                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                />
                                <label htmlFor="extAuthIncludeBody" className="text-sm text-gray-700">
                                  Include request body
                                </label>
                              </div>
                              {extAuthIncludeBody && (
                                <div className="ml-6">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Body Bytes</label>
                                  <Input
                                    type="number"
                                    value={extAuthMaxBodyBytes}
                                    onChange={(e) => setExtAuthMaxBodyBytes(parseInt(e.target.value) || 1024)}
                                    placeholder="1024"
                                  />
                                </div>
                              )}

                              {/* Headers to downstream on deny */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Headers to Downstream on Deny <InfoTooltip text="Response headers from the auth service included in the error response sent back to the client when authorization is denied." /></label>
                                <div className="flex gap-2">
                                  <Input
                                    value={extAuthHeaderToDownstreamOnDenyInput}
                                    onChange={(e) => setExtAuthHeaderToDownstreamOnDenyInput(e.target.value)}
                                    placeholder="Add header name"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (extAuthHeaderToDownstreamOnDenyInput.trim()) {
                                          setExtAuthHeadersToDownstreamOnDeny([...extAuthHeadersToDownstreamOnDeny, extAuthHeaderToDownstreamOnDenyInput.trim()]);
                                          setExtAuthHeaderToDownstreamOnDenyInput('');
                                        }
                                      }
                                    }}
                                  />
                                  <Button type="button" variant="secondary" onClick={() => {
                                    if (extAuthHeaderToDownstreamOnDenyInput.trim()) {
                                      setExtAuthHeadersToDownstreamOnDeny([...extAuthHeadersToDownstreamOnDeny, extAuthHeaderToDownstreamOnDenyInput.trim()]);
                                      setExtAuthHeaderToDownstreamOnDenyInput('');
                                    }
                                  }}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {extAuthHeadersToDownstreamOnDeny.map((h, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                      {h}
                                      <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setExtAuthHeadersToDownstreamOnDeny(extAuthHeadersToDownstreamOnDeny.filter((_, j) => j !== i))}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Headers to downstream on allow */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Headers to Downstream on Allow <InfoTooltip text="Response headers from the auth service included in the success response sent back to the client." /></label>
                                <div className="flex gap-2">
                                  <Input
                                    value={extAuthHeaderToDownstreamOnAllowInput}
                                    onChange={(e) => setExtAuthHeaderToDownstreamOnAllowInput(e.target.value)}
                                    placeholder="Add header name"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (extAuthHeaderToDownstreamOnAllowInput.trim()) {
                                          setExtAuthHeadersToDownstreamOnAllow([...extAuthHeadersToDownstreamOnAllow, extAuthHeaderToDownstreamOnAllowInput.trim()]);
                                          setExtAuthHeaderToDownstreamOnAllowInput('');
                                        }
                                      }
                                    }}
                                  />
                                  <Button type="button" variant="secondary" onClick={() => {
                                    if (extAuthHeaderToDownstreamOnAllowInput.trim()) {
                                      setExtAuthHeadersToDownstreamOnAllow([...extAuthHeadersToDownstreamOnAllow, extAuthHeaderToDownstreamOnAllowInput.trim()]);
                                      setExtAuthHeaderToDownstreamOnAllowInput('');
                                    }
                                  }}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {extAuthHeadersToDownstreamOnAllow.map((h, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                      {h}
                                      <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setExtAuthHeadersToDownstreamOnAllow(extAuthHeadersToDownstreamOnAllow.filter((_, j) => j !== i))}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Headers to upstream on allow */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Headers to Upstream on Allow <InfoTooltip text="Response headers from the auth service forwarded to the backend service when authorization succeeds. Useful for passing user identity." /></label>
                                <div className="flex gap-2">
                                  <Input
                                    value={extAuthHeaderToUpstreamOnAllowInput}
                                    onChange={(e) => setExtAuthHeaderToUpstreamOnAllowInput(e.target.value)}
                                    placeholder="Add header name"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (extAuthHeaderToUpstreamOnAllowInput.trim()) {
                                          setExtAuthHeadersToUpstreamOnAllow([...extAuthHeadersToUpstreamOnAllow, extAuthHeaderToUpstreamOnAllowInput.trim()]);
                                          setExtAuthHeaderToUpstreamOnAllowInput('');
                                        }
                                      }
                                    }}
                                  />
                                  <Button type="button" variant="secondary" onClick={() => {
                                    if (extAuthHeaderToUpstreamOnAllowInput.trim()) {
                                      setExtAuthHeadersToUpstreamOnAllow([...extAuthHeadersToUpstreamOnAllow, extAuthHeaderToUpstreamOnAllowInput.trim()]);
                                      setExtAuthHeaderToUpstreamOnAllowInput('');
                                    }
                                  }}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {extAuthHeadersToUpstreamOnAllow.map((h, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                      {h}
                                      <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setExtAuthHeadersToUpstreamOnAllow(extAuthHeadersToUpstreamOnAllow.filter((_, j) => j !== i))}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Headers to ext auth */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Headers to Ext Auth</label>
                                <p className="text-xs text-gray-500 mb-1">Additional client request headers to forward to the ext-auth service. Host, Method, Path, Content-Length, and Authorization are always forwarded.</p>
                                <div className="flex gap-2">
                                  <Input
                                    value={extAuthHeaderToExtAuthInput}
                                    onChange={(e) => setExtAuthHeaderToExtAuthInput(e.target.value)}
                                    placeholder="Add header name"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (extAuthHeaderToExtAuthInput.trim()) {
                                          setExtAuthHeadersToExtAuth([...extAuthHeadersToExtAuth, extAuthHeaderToExtAuthInput.trim()]);
                                          setExtAuthHeaderToExtAuthInput('');
                                        }
                                      }
                                    }}
                                  />
                                  <Button type="button" variant="secondary" onClick={() => {
                                    if (extAuthHeaderToExtAuthInput.trim()) {
                                      setExtAuthHeadersToExtAuth([...extAuthHeadersToExtAuth, extAuthHeaderToExtAuthInput.trim()]);
                                      setExtAuthHeaderToExtAuthInput('');
                                    }
                                  }}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {extAuthHeadersToExtAuth.map((h, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                      {h}
                                      <button type="button" className="text-gray-500 hover:text-red-500" onClick={() => setExtAuthHeadersToExtAuth(extAuthHeadersToExtAuth.filter((_, j) => j !== i))}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* WAF Protection Section */}
                  <AccordionItem value="waf">
                    <AccordionTrigger
                      value="waf"
                      badge={wafPolicy && (
                        <Badge variant="success">
                          {wafPolicy.mode === 'block' ? 'Blocking' : 'Detecting'}
                        </Badge>
                      )}
                    >
                      WAF Protection
                    </AccordionTrigger>
                    <AccordionContent value="waf">
                      <div className="space-y-4">
                        <WafPolicyForm
                          value={wafPolicy}
                          onChange={setWafPolicy}
                          disabled={isSubmitting}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {securityMode === 'client' && (
                  <AccordionItem value="default-traffic-policy">
                    <AccordionTrigger
                      value="default-traffic-policy"
                      badge={
                        <>
                          {pendingAttachments.length > 0 && defaultTrafficPolicy === 'allow_all' && (
                            <Badge variant="warning">⚠ Unprotected</Badge>
                          )}
                          {pendingAttachments.length > 0 && defaultTrafficPolicy !== 'allow_all' && (
                            <Badge variant="success">Protected</Badge>
                          )}
                        </>
                      }
                    >
                      Default Traffic Policy
                    </AccordionTrigger>
                    <AccordionContent value="default-traffic-policy">
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                          Controls how requests <strong>without</strong> a client header (x-client-id) are handled when clients are attached to this route.
                        </p>

                        {/* Warning when clients attached but policy allows bypass */}
                        {pendingAttachments.length > 0 && defaultTrafficPolicy === 'allow_all' && (
                          <div className="bg-amber-50 border border-amber-300 rounded-md p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 text-amber-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-amber-800">Security Warning</h4>
                                <p className="text-sm text-amber-700 mt-1">
                                  You have {pendingAttachments.length} client(s) attached, but the default policy allows all traffic without client identification.
                                  This means requests without an x-client-id header can bypass client security controls.
                                </p>
                                <p className="text-sm text-amber-700 mt-2">
                                  <strong>Recommendation:</strong> Set the policy to &quot;Deny&quot; or &quot;Require IP Allowlist&quot; to ensure only identified clients or approved IPs can access this route.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Policy options */}
                        <div className="space-y-3">
                          <label className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name="defaultTrafficPolicy"
                              value="allow_all"
                              checked={defaultTrafficPolicy === 'allow_all'}
                              onChange={() => setDefaultTrafficPolicy('allow_all')}
                              className="mt-1 h-4 w-4 text-primary-600 border-gray-300"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900">Allow All</span>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Allow all requests without client header. Not recommended when clients are attached.
                              </p>
                            </div>
                          </label>

                          <label className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name="defaultTrafficPolicy"
                              value="deny"
                              checked={defaultTrafficPolicy === 'deny'}
                              onChange={() => setDefaultTrafficPolicy('deny')}
                              className="mt-1 h-4 w-4 text-primary-600 border-gray-300"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900">Deny</span>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Return 403 Forbidden for all requests without client header. Most secure option.
                              </p>
                            </div>
                          </label>

                          <label className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name="defaultTrafficPolicy"
                              value="require_ip_allowlist"
                              checked={defaultTrafficPolicy === 'require_ip_allowlist'}
                              onChange={() => setDefaultTrafficPolicy('require_ip_allowlist')}
                              className="mt-1 h-4 w-4 text-primary-600 border-gray-300"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900">Require IP Allowlist</span>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Allow requests from specific IPs/CIDRs without client header. Useful for internal services or health checks.
                              </p>
                            </div>
                          </label>
                        </div>

                        {/* CIDR input for require_ip_allowlist */}
                        {defaultTrafficPolicy === 'require_ip_allowlist' && (
                          <div className="space-y-3 pt-3 border-t">
                            <label className="block text-sm font-medium text-gray-700">Allowed CIDRs for Default Traffic</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="Enter CIDR (e.g., 10.0.0.0/8)"
                                value={defaultCidrInput}
                                onChange={(e) => setDefaultCidrInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && defaultCidrInput.trim()) {
                                    e.preventDefault();
                                    setDefaultAllowedCIDRs([...defaultAllowedCIDRs, defaultCidrInput.trim()]);
                                    setDefaultCidrInput('');
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  if (defaultCidrInput.trim()) {
                                    setDefaultAllowedCIDRs([...defaultAllowedCIDRs, defaultCidrInput.trim()]);
                                    setDefaultCidrInput('');
                                  }
                                }}
                                disabled={!defaultCidrInput.trim()}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {defaultAllowedCIDRs.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {defaultAllowedCIDRs.map((cidr, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-mono">
                                    {cidr}
                                    <button
                                      type="button"
                                      onClick={() => setDefaultAllowedCIDRs(defaultAllowedCIDRs.filter((_, i) => i !== idx))}
                                      className="text-gray-400 hover:text-red-500"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-amber-600">
                                No CIDRs configured. Add at least one CIDR to allow traffic without client header.
                              </p>
                            )}
                          </div>
                        )}

                        {/* No clients info */}
                        {pendingAttachments.length === 0 && (
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                            <p className="text-sm text-gray-600">
                              No clients are attached to this route. The default traffic policy only applies when clients are attached.
                            </p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  )}
                </Accordion>
              </TabsContent>

              {/* Clients Tab */}
              <TabsContent value="clients">
                <Accordion type="multiple" defaultValue={['clients']}>
                  <AccordionItem value="clients">
                    <AccordionTrigger
                      value="clients"
                      badge={
                        pendingAttachments.length > 0 ? (
                          <Badge variant="success" className="text-xs">
                            {pendingAttachments.length} client{pendingAttachments.length !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">No clients</Badge>
                        )
                      }
                    >
                      Client Attachments
                    </AccordionTrigger>
                    <AccordionContent value="clients">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500">
                            Attach clients to this route. Attachments will be submitted after the route is created.
                          </p>
                          <Button type="button" size="sm" onClick={openAttachClientModal}>
                            <Plus className="h-4 w-4 mr-1" />
                            Attach Client
                          </Button>
                        </div>

                        {pendingAttachments.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Security</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {pendingAttachments.map((att, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <span className="text-sm font-medium text-gray-900">{att.clientName}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge variant="default">{att.teamName}</Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-1 flex-wrap">
                                        {att.enableIpAllowlist && <Badge variant="info">IP Allow</Badge>}
                                        {att.enableApiKey && <Badge variant="info">API Key</Badge>}
                                        {att.enableJwt && <Badge variant="info">JWT</Badge>}
                                        {att.enableBasicAuth && <Badge variant="info">Auth</Badge>}
                                        {att.enableMtls && <Badge variant="info">mTLS</Badge>}
                                        {att.enableHeaderAuth && <Badge variant="info">Header Auth</Badge>}
                                        {att.rateLimitConfig?.global?.rules?.[0] && (
                                          <Badge variant="warning">
                                            {att.rateLimitConfig.global.rules[0].limit.requests}/{att.rateLimitConfig.global.rules[0].limit.unit.toLowerCase().slice(0, 3)}
                                          </Badge>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveAttachment(idx)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Remove
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <Shield className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No clients attached yet</p>
                            <p className="text-gray-400 text-xs mt-1">Attach clients to enforce IP allowlisting and other security features</p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>

              {/* Preview Tab */}
              <TabsContent value="preview">
                <div className="space-y-6">
                  {isLoadingPreview ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                  ) : previewError ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      {previewError}
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">HTTPRoute</h3>
                        <YamlDiffViewer
                          proposedYaml={previewYaml}
                          mode="create"
                        />
                      </div>
                      {previewSecurityPolicyYaml && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">SecurityPolicy</h3>
                          <YamlDiffViewer
                            proposedYaml={previewSecurityPolicyYaml}
                            mode="create"
                          />
                        </div>
                      )}
                      {previewBackendTrafficPolicyYaml && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">BackendTrafficPolicy</h3>
                          <YamlDiffViewer
                            proposedYaml={previewBackendTrafficPolicyYaml}
                            mode="create"
                          />
                        </div>
                      )}
                      {previewEnvoyExtensionPolicyYaml && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">EnvoyExtensionPolicy (Lua/Wasm, WAF)</h3>
                          <YamlDiffViewer
                            proposedYaml={previewEnvoyExtensionPolicyYaml}
                            mode="create"
                          />
                        </div>
                      )}
                      {previewBackendYaml && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">Backend (External Service)</h3>
                          <YamlDiffViewer
                            proposedYaml={previewBackendYaml}
                            mode="create"
                          />
                        </div>
                      )}
                      {previewHttpRouteFilterYaml && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">HTTPRouteFilter (Direct Response)</h3>
                          <YamlDiffViewer
                            proposedYaml={previewHttpRouteFilterYaml}
                            mode="create"
                          />
                        </div>
                      )}
                      {previewConfigMapYaml && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">ConfigMap (Response Body)</h3>
                          <YamlDiffViewer
                            proposedYaml={previewConfigMapYaml}
                            mode="create"
                          />
                        </div>
                      )}
                    </>
                  )}
                  {/* AI Review Section */}
                  {aiEnabled && (
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Describe your changes (optional)
                        </label>
                        <textarea
                          value={changeDescription}
                          onChange={(e) => setChangeDescription(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="e.g., Adding retry policy for upstream resilience..."
                        />
                      </div>
                      <Button
                        variant="secondary"
                        onClick={handleAIReview}
                        disabled={isLoadingReview || !previewYaml}
                        isLoading={isLoadingReview}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Review with AI
                      </Button>
                      {reviewError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                          {reviewError}
                        </div>
                      )}
                      {aiReviewResult && <AIReviewCard review={aiReviewResult} />}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t">
              <div>
                {activeTab !== 'basic' && (
                  <Button type="button" variant="secondary" onClick={goToPrevTab}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push(`/projects/${projectId}/domains/${domainId}`)}
                >
                  Cancel
                </Button>

                {activeTab !== 'preview' ? (
                  <Button type="button" onClick={goToNextTab}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="submit" isLoading={isSubmitting}>
                    Submit for Approval
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
      )}

      {/* Attach Client Modal */}
      {showAttachClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Attach Client to Route</h2>
              <form onSubmit={handleAddAttachmentLocally} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <select
                    value={attachClientForm.clientId}
                    onChange={(e) => {
                      const selectedClient = clientsList.find(c => c.id === e.target.value);
                      setAttachClientForm({
                        ...attachClientForm,
                        clientId: e.target.value,
                        // Auto-set checkboxes based on client capabilities
                        enableIpAllowlist: selectedClient?.ipAddressCount ? true : false,
                        enableApiKey: selectedClient?.apiKeyEnabled ? true : false,
                        enableJwt: selectedClient?.jwtEnabled ? true : false,
                        enableMtls: selectedClient?.mtlsEnabled ? true : false,
                      });
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a client...</option>
                    {loadingClients && <option disabled>Loading...</option>}
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.team ? ` (${c.team.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Security Features</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachClientForm.enableIpAllowlist}
                      onChange={(e) =>
                        setAttachClientForm({ ...attachClientForm, enableIpAllowlist: e.target.checked })
                      }
                      className="rounded border-gray-300"
                      disabled={!clientsList.find(c => c.id === attachClientForm.clientId)?.ipAddressCount}
                    />
                    <span className={`text-sm ${clientsList.find(c => c.id === attachClientForm.clientId)?.ipAddressCount ? 'text-gray-700' : 'text-gray-400'}`}>
                      IP Allowlist {!clientsList.find(c => c.id === attachClientForm.clientId)?.ipAddressCount && attachClientForm.clientId && '(client has no IPs)'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachClientForm.enableApiKey}
                      onChange={(e) =>
                        setAttachClientForm({ ...attachClientForm, enableApiKey: e.target.checked })
                      }
                      className="rounded border-gray-300"
                      disabled={!clientsList.find(c => c.id === attachClientForm.clientId)?.apiKeyEnabled}
                    />
                    <span className={`text-sm ${clientsList.find(c => c.id === attachClientForm.clientId)?.apiKeyEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                      API Key {!clientsList.find(c => c.id === attachClientForm.clientId)?.apiKeyEnabled && attachClientForm.clientId && '(client has no key)'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachClientForm.enableJwt}
                      onChange={(e) =>
                        setAttachClientForm({ ...attachClientForm, enableJwt: e.target.checked })
                      }
                      className="rounded border-gray-300"
                      disabled={!clientsList.find(c => c.id === attachClientForm.clientId)?.jwtEnabled}
                    />
                    <span className={`text-sm ${clientsList.find(c => c.id === attachClientForm.clientId)?.jwtEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                      JWT {!clientsList.find(c => c.id === attachClientForm.clientId)?.jwtEnabled && attachClientForm.clientId && '(client has no JWT)'}
                    </span>
                  </label>
                  {(attachClientForm.enableIpAllowlist && attachClientForm.enableApiKey) ||
                   (attachClientForm.enableIpAllowlist && attachClientForm.enableJwt) ||
                   (attachClientForm.enableApiKey && attachClientForm.enableJwt) ? (
                    <p className="text-xs text-yellow-600 ml-6">
                      Multiple enabled = Client must pass ALL enabled checks (AND logic)
                    </p>
                  ) : null}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachClientForm.enableBasicAuth}
                      onChange={(e) =>
                        setAttachClientForm({ ...attachClientForm, enableBasicAuth: e.target.checked })
                      }
                      className="rounded border-gray-300"
                      disabled
                    />
                    <span className="text-sm text-gray-400">Basic Auth (coming soon)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachClientForm.enableMtls}
                      onChange={(e) =>
                        setAttachClientForm({ ...attachClientForm, enableMtls: e.target.checked })
                      }
                      className="rounded border-gray-300"
                      disabled={!clientsList.find(c => c.id === attachClientForm.clientId)?.mtlsEnabled}
                    />
                    <span className={`text-sm ${clientsList.find(c => c.id === attachClientForm.clientId)?.mtlsEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                      Mutual TLS {!clientsList.find(c => c.id === attachClientForm.clientId)?.mtlsEnabled && attachClientForm.clientId && '(client has no mTLS)'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachClientForm.enableHeaderAuth}
                      onChange={(e) =>
                        setAttachClientForm({ ...attachClientForm, enableHeaderAuth: e.target.checked })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Header & Method Auth</span>
                  </label>
                </div>

                {/* Rate Limiting Section */}
                {securityMode === 'client' && capabilities?.rateLimitAvailable && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">Rate Limiting (optional)</p>
                    <RateLimitForm
                      value={attachRateLimitConfig}
                      onChange={setAttachRateLimitConfig}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAttachClientModal(false);
                      setAttachClientForm({
                        clientId: '',
                        enableIpAllowlist: true,
                        enableApiKey: false,
                        enableJwt: false,
                        enableBasicAuth: false,
                        enableMtls: false,
                        enableHeaderAuth: false,
                      });
                      setAttachRateLimitConfig(undefined);
                      setClientsList([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!attachClientForm.clientId}>
                    Add Client
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <AIChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        getContext={getRouteContext}
      />
    </div>
  );
}
