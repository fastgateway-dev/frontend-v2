// User types
export type UserRole = 'owner' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  authProvider?: string;  // 'local' or 'oidc'
  authMethod?: string;    // 'jwt' or 'api_token' (how the current session is authenticated)
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ApiToken {
  id: string;
  name: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiTokenCapabilities {
  enabled: boolean;
  maxTokens: number;
  currentCount: number;
}

// Connection type constants
export type ConnectionType = 'in_cluster' | 'kubeconfig' | 'api_token';
export type TLSVerification = 'system_ca' | 'custom_ca' | 'skip';

// Project types
export interface Project {
  id: string;
  name: string;
  description: string;
  connectionType: ConnectionType;
  k8sApiUrl: string | null;
  k8sTlsSkipVerify: boolean;
  isConnected: boolean;
  lastConnectedAt: string | null;
  domainCount: number;
  routeCount: number;
  createdAt: string;
  updatedAt: string;
  labels?: Record<string, string>;
  approvalEnabled: boolean;
  selfApprovalAllowed: boolean;
  metricsEndpointUrl?: string;
  metricsAuthType?: 'none' | 'bearer' | 'basic';
  metricsUsername?: string;
  metricsTlsSkipVerify?: boolean;
  metricsCaCert?: string;
}

export interface MetricsPoint {
  time: string;
  value: number;
}

export interface MetricsTimeRange {
  start: string;
  end: string;
  step: string;
}

export interface RpsByClass {
  '2xx': MetricsPoint[];
  '3xx': MetricsPoint[];
  '4xx': MetricsPoint[];
  '5xx': MetricsPoint[];
}

export interface LatencyPercentiles {
  p50: MetricsPoint[];
  p95: MetricsPoint[];
  p99: MetricsPoint[];
}

export interface RouteMetrics {
  timeRange: MetricsTimeRange;
  totalRequests: number;
  errorRatePercent: number;
  rps: RpsByClass;
  latency: LatencyPercentiles;
}

export interface TopRouteEntry {
  routeId: string;
  routeName: string;
  value: number;
}

export interface DomainMetrics extends RouteMetrics {
  topRoutesByRps: TopRouteEntry[];
  topRoutesByErrorRate: TopRouteEntry[];
}

export type MetricsRange = '15m' | '1h' | '6h' | '24h' | '7d';

export interface TestMetricsConnectionResult {
  ok: boolean;
  prometheusVersion?: string;
  error?: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  connectionType: ConnectionType;

  // For kubeconfig type
  kubeconfig?: string;

  // For api_token type
  k8sApiUrl?: string;
  k8sToken?: string;
  tlsVerification?: TLSVerification;
  k8sCaCert?: string;
  labels?: Record<string, string>;
  approvalEnabled?: boolean;
  selfApprovalAllowed?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;

  // Connection settings (kubeconfig/api_token only)
  kubeconfig?: string;
  k8sApiUrl?: string;
  k8sToken?: string;
  tlsVerification?: TLSVerification;
  k8sCaCert?: string;
  labels?: Record<string, string>;
  approvalEnabled?: boolean;
  selfApprovalAllowed?: boolean;

  // Metrics (observability)
  metricsEndpointUrl?: string;
  metricsAuthType?: 'none' | 'bearer' | 'basic';
  metricsUsername?: string;
  metricsPassword?: string;
  metricsToken?: string;
  metricsTlsSkipVerify?: boolean;
  metricsCaCert?: string;
}

// Permission types (for team-project assignments)
export type Permission = string;

export interface Team {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamInput {
  name: string;
  description?: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
}

// Permission Preset types
export interface PermissionPreset {
  id: string;
  projectId: string;
  name: string;
  description: string;
  permissions: string[];
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePresetInput {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdatePresetInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

// Project Team Preset (junction table)
export interface ProjectTeamPreset {
  id: string;
  projectTeamRoleId: string;
  presetId: string;
  preset: PermissionPreset;
  createdAt: string;
}

// Project Team Role types (team-project assignments)
export interface ProjectTeamRole {
  id: string;
  projectId: string;
  teamId: string;
  team: Team;
  presets: ProjectTeamPreset[];
  effectivePermissions: string[];
  createdAt: string;
}

export interface AssignTeamInput {
  teamId: string;
  presetIds: string[];
}

export interface UpdateTeamPresetsInput {
  presetIds: string[];
}

// Domain types
export type TLSPolicy = 'terminate' | 'passthrough';
export type TLSMode = 'tls_only' | 'no_tls' | 'both';
export type DomainStatus = 'pending' | 'active' | 'error';

export interface Domain {
  id: string;
  projectId: string;
  domainTemplateId?: string;
  name: string;
  hostname: string;
  httpPort: number;
  httpsPort: number;
  tlsMode: TLSMode;
  tlsSecretName: string;
  tlsSecretNamespace?: string;
  namespace: string;
  tlsPolicy: TLSPolicy;
  status: DomainStatus;
  statusMessage?: string;
  routeCount: number;
  createdAt: string;
  updatedAt: string;
  labels?: Record<string, string>;
  managedCertificateId?: string;
}

export interface CreateDomainInput {
  name: string;
  hostname: string;
  domainTemplateId: string;
  tlsSecretName?: string;
  tlsSecretNamespace?: string;
  namespace?: string;
  labels?: Record<string, string>;
}

export interface TLSSecretInfo {
  name: string;
  namespace: string;
  managedByFastgateway: boolean;
  labels: Record<string, string>;
  createdAt: string;
}

export interface ListTLSSecretsResponse {
  namespace: string;
  secrets: TLSSecretInfo[];
  availableNamespaces: string[];
}

// Domain Settings types (gateway-agnostic configuration)
export interface DomainSettings {
  id?: string;
  domainId?: string;
  projectId?: string;
  settings?: DomainSettingsConfig;
  backendTrafficPolicy?: BackendTrafficPolicyConfig;
  extensionPolicy?: EnvoyExtensionPolicyConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface DomainSettingsConfig {
  clientConnection?: ClientConnectionConfig;
  clientIPDetection?: ClientIPDetectionConfig;
  timeout?: TimeoutConfig;
  http3?: HTTP3Config;
  tls?: TLSSettingsConfig;
  mtls?: DomainMTLSConfig;
}

export interface ClientConnectionConfig {
  tcpKeepalive?: TCPKeepaliveConfig;
  proxyProtocol?: ProxyProtocolConfig;
  connectionLimit?: ConnectionLimitConfig;
  bufferLimit?: string;
}

export interface ClientIPDetectionConfig {
  xForwardedFor?: XForwardedForConfig;
  customHeader?: CustomHeaderConfig;
}

export interface XForwardedForConfig {
  numTrustedHops: number;
}

export interface CustomHeaderConfig {
  name: string;
  failClosed?: boolean;
}

export interface TCPKeepaliveConfig {
  probes?: number;
  idleTime?: string;
  interval?: string;
}

export interface ProxyProtocolConfig {
  enabled: boolean;
}

export interface ConnectionLimitConfig {
  maxConnections?: number;
  closeDelay?: string;
  maxConnectionDuration?: string;
  maxRequestsPerConnection?: number;
}

export interface TimeoutConfig {
  http?: HTTPTimeoutConfig;
}

export interface HTTPTimeoutConfig {
  requestReceivedTimeout?: string;
  idleTimeout?: string;
}

export interface HTTP3Config {
  enabled: boolean;
}

export type TLSVersion = 'Auto' | 'TLS1.0' | 'TLS1.1' | 'TLS1.2' | 'TLS1.3';
export type TLSProfile = 'modern' | 'intermediate' | 'compatible' | 'custom';

export interface TLSSettingsConfig {
  minVersion?: string;
  maxVersion?: string;
  ciphers?: string[];
  ecdhCurves?: string[];
  signatureAlgorithms?: string[];
}

// mTLS Types
export interface MTLSCACert {
  id: string;
  name: string;
  secretName: string;
  secretKey: string;
}

export interface MTLSSANEntry {
  type: 'DNS' | 'URI';
  value: string;
}

export interface DomainMTLSConfig {
  enabled: boolean;
  optional: boolean;
  caCerts?: MTLSCACert[];
  sanWhitelist?: MTLSSANEntry[];
  hashWhitelist?: string[];
}

export interface UpdateDomainSettingsInput {
  clientConnection?: ClientConnectionConfig;
  clientIPDetection?: ClientIPDetectionConfig;
  timeout?: TimeoutConfig;
  http3?: HTTP3Config;
  tls?: TLSSettingsConfig;
  mtls?: DomainMTLSConfig;
  backendTrafficPolicy?: BackendTrafficPolicyConfig;
  extensionPolicy?: EnvoyExtensionPolicyConfig;
}

// DomainTemplate types
export type ExposureType = 'LoadBalancer' | 'ClusterIP';
export type ExternalTrafficPolicy = 'Cluster' | 'Local';
export type DomainTemplateStatus = 'pending' | 'active' | 'error';
export type ScalingType = 'fixed' | 'hpa';

export interface ContainerResourceValues {
  cpu?: string;
  memory?: string;
}

export interface ContainerResourcesConfig {
  requests?: ContainerResourceValues;
  limits?: ContainerResourceValues;
}

export interface ScalingConfig {
  type: ScalingType;
  replicas?: number;
  minReplicas?: number;
  maxReplicas?: number;
}

// Telemetry types — see EnvoyProxy spec.telemetry on the EG CRD.
export type TelemetryAccessLogFormatType = 'text' | 'json' | 'disabled';
export type TelemetryAccessLogSinkType = 'file' | 'otel';
export type TelemetryFilePath = '/dev/stdout' | '/dev/stderr';

export interface TelemetryAccessLogFormat {
  type: TelemetryAccessLogFormatType;
  text?: string;
  json?: Record<string, string>;
}

export interface TelemetryAccessLogFileSink {
  path: TelemetryFilePath;
}

export interface TelemetryAccessLogOTelSink {
  namespace: string;
  service: string;
  port: number;
}

export interface TelemetryAccessLogSink {
  type: TelemetryAccessLogSinkType;
  file?: TelemetryAccessLogFileSink;
  otel?: TelemetryAccessLogOTelSink;
}

export interface TelemetryAccessLogConfig {
  format: TelemetryAccessLogFormat;
  sink: TelemetryAccessLogSink;
}

export interface TelemetryServiceRef {
  namespace: string;
  service: string;
  port: number;
}

export type TelemetryTracingTagType = 'literal' | 'requestHeader';

export interface TelemetryTracingTag {
  type: TelemetryTracingTagType;
  tag: string;
  value?: string;
  header?: string;
  defaultValue?: string;
}

export interface TelemetryTracingConfig {
  samplingRate: number;
  provider: TelemetryServiceRef;
  customTags?: TelemetryTracingTag[];
}

export interface TelemetryPrometheusConfig {
  disable: boolean;
}

export interface TelemetryMetricsSink {
  type: 'openTelemetry';
  namespace: string;
  service: string;
  port: number;
}

export interface TelemetryMetricsConfig {
  prometheus?: TelemetryPrometheusConfig;
  enableVirtualHostStats: boolean;
  enablePerEndpointStats: boolean;
  sinks?: TelemetryMetricsSink[];
}

// Pod scheduling, PDB, deployment strategy types — see EnvoyProxy spec.provider.kubernetes on the EG CRD.
export type TolerationOperator = 'Equal' | 'Exists';
export type TolerationEffect = 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute' | '';
export type WhenUnsatisfiable = 'DoNotSchedule' | 'ScheduleAnyway';

export interface TolerationConfig {
  key?: string;
  operator?: TolerationOperator;
  value?: string;
  effect?: TolerationEffect;
  tolerationSeconds?: number;
}

export interface TopologySpreadConstraintConfig {
  maxSkew: number;
  topologyKey: string;
  whenUnsatisfiable: WhenUnsatisfiable;
}

export interface PodPlacementConfig {
  nodeSelector?: Record<string, string>;
  tolerations?: TolerationConfig[];
  topologySpreadConstraints?: TopologySpreadConstraintConfig[];
  priorityClassName?: string;
}

export type PDBKind = 'minAvailable' | 'maxUnavailable';

export interface PDBConfig {
  kind: PDBKind;
  value: string; // positive integer string OR "NN%"
}

export type DeploymentStrategyType = 'RollingUpdate' | 'Recreate';

export interface RollingUpdateConfig {
  maxSurge?: string;
  maxUnavailable?: string;
}

export interface DeploymentStrategyConfig {
  type: DeploymentStrategyType;
  rollingUpdate?: RollingUpdateConfig;
}

export interface DomainTemplate {
  id: string;
  projectId: string;
  name: string;
  description: string;
  controllerName: string;
  exposureType: ExposureType;
  tlsMode: TLSMode;
  httpPort: number;
  httpsPort: number;
  tlsPolicy: TLSPolicy;
  externalTrafficPolicy?: ExternalTrafficPolicy;
  loadBalancerClass?: string;
  annotations: Record<string, string>;
  podAnnotations: Record<string, string>;
  containerResources?: ContainerResourcesConfig;
  scalingConfig?: ScalingConfig;
  mergeGateways: boolean;
  telemetryAccessLog?: TelemetryAccessLogConfig | null;
  telemetryTracing?: TelemetryTracingConfig | null;
  telemetryMetrics?: TelemetryMetricsConfig | null;
  podPlacement?: PodPlacementConfig | null;
  pdbConfig?: PDBConfig | null;
  deploymentStrategy?: DeploymentStrategyConfig | null;
  status: DomainTemplateStatus;
  statusMessage?: string;
  k8sGatewayClassName: string;
  k8sEnvoyProxyName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDomainTemplateInput {
  name: string;
  description?: string;
  controllerName?: string;
  exposureType: ExposureType;
  tlsMode: TLSMode;
  // Advanced settings
  httpPort?: number;
  httpsPort?: number;
  tlsPolicy?: TLSPolicy;
  externalTrafficPolicy?: ExternalTrafficPolicy;
  loadBalancerClass?: string;
  annotations?: Record<string, string>;
  podAnnotations?: Record<string, string>;
  containerResources?: ContainerResourcesConfig;
  scalingConfig?: ScalingConfig;
  mergeGateways?: boolean;
  telemetryAccessLog?: TelemetryAccessLogConfig | null;
  telemetryTracing?: TelemetryTracingConfig | null;
  telemetryMetrics?: TelemetryMetricsConfig | null;
  podPlacement?: PodPlacementConfig | null;
  pdbConfig?: PDBConfig | null;
  deploymentStrategy?: DeploymentStrategyConfig | null;
}

export interface DomainTemplateManifests {
  gatewayClassYaml: string;
  envoyProxyYaml: string;
}

export interface DomainTemplatePreviewResult {
  currentEnvoyProxyYaml: string;
  proposedEnvoyProxyYaml: string;
  aiReview?: AIReviewResult;
}

export interface DomainTemplateCreatePreviewResult {
  gatewayClassYaml: string;
  envoyProxyYaml: string;
  gatewayYaml: string;
  aiReview?: AIReviewResult;
}

// Route types
export type RouteStatus = 'pending_create' | 'pending_update' | 'pending_delete' | 'approved' | 'pending_deploy' | 'active' | 'rejected';
export type RouteProtocol = 'http' | 'grpc';
export type SecurityMode = 'general' | 'client';

export interface PathMatch {
  type: 'Exact' | 'Prefix' | 'RegularExpression';
  value: string;
}

export interface GRPCMethodMatch {
  type: 'Exact' | 'RegularExpression';
  value: string;
}

export interface RouteMatch {
  path?: PathMatch;
  headers?: Array<{ name: string; type: string; value: string }>;
  method?: string;
  queryParams?: Array<{ name: string; type: string; value: string }>;
  // gRPC-specific matching
  grpcService?: GRPCMethodMatch;
  grpcMethod?: GRPCMethodMatch;
}

export interface ConflictResult {
  routeId: string;
  routeName: string;
}

export interface RouteBackend {
  type: 'kubernetes' | 'external';
  service?: string;
  namespace?: string;
  port: number;
  weight?: number;
  fallback?: boolean;  // If true, this backend only receives traffic when primary backends are unhealthy
  // External backend fields
  addressType?: 'fqdn' | 'ip';
  address?: string;
  tls?: BackendTLSConfig; // TLS configuration for backends
}

// Backend TLS configuration for backends
export interface BackendTLSConfig {
  mode: 'simple' | 'mtls';
  insecureSkipVerify?: boolean;
  sni?: string;
  // Client certificate for mTLS (required for mtls mode)
  clientCertificateRef?: SecretRef;
  // CA certificates for verifying backend (required unless insecureSkipVerify)
  caCertificateRefs?: CertificateRef[];
}

// Reference to a Kubernetes Secret
export interface SecretRef {
  name: string;
  namespace?: string; // defaults to fastgateway-system
}

// Reference to a Kubernetes Secret or ConfigMap
export interface CertificateRef {
  kind: 'Secret' | 'ConfigMap';
  name: string;
  namespace?: string; // defaults to fastgateway-system
}

// Mirror backend for request mirroring (no weight - mirrors don't participate in traffic splitting)
export interface MirrorBackend {
  type: 'kubernetes';  // Only kubernetes for now
  service: string;
  namespace?: string;
  port: number;
}

// Header modifier types
export interface HeaderValue {
  name: string;
  value: string;
}

export interface HeaderModifier {
  set?: HeaderValue[];
  add?: HeaderValue[];
  remove?: string[];
}

// URL Rewrite types
export type PathRewriteType = 'ReplacePrefixMatch' | 'ReplaceFullPath';

export interface PathRewrite {
  type: PathRewriteType;
  replacePrefixMatch?: string;
  replaceFullPath?: string;
}

export interface URLRewrite {
  hostname?: string;
  path?: PathRewrite;
}

// CORS Filter types
export interface CORSFilter {
  allowOrigins?: string[];    // Origins allowed (supports wildcards like "http://*.foo.com")
  allowMethods?: string[];    // HTTP methods allowed (GET, POST, PUT, DELETE, etc.)
  allowHeaders?: string[];    // Headers allowed in requests
  exposeHeaders?: string[];   // Headers exposed to the browser
  maxAge?: number;            // Max age in seconds for preflight cache
  allowCredentials?: boolean; // Whether to allow credentials
}

// Route type - determines if route forwards to backends, redirects, or returns direct response
export type RouteType = 'backend' | 'redirect' | 'directResponse';

// Redirect configuration
export interface RedirectConfig {
  scheme?: string;           // "http" or "https"
  hostname?: string;         // New hostname to redirect to
  port?: number;             // New port
  statusCode?: number;       // 301 (permanent) or 302 (temporary)
  path?: PathRewrite;        // Path rewrite for redirect
}

// Direct Response configuration
export type DirectResponseBodyType = 'Inline' | 'ValueRef';

export interface DirectResponseBody {
  type: DirectResponseBodyType;
  inline?: string;           // Inline body content (max 4096 bytes)
}

export interface DirectResponseConfig {
  statusCode: number;        // HTTP status code (100-599)
  contentType?: string;      // e.g., "text/plain", "application/json"
  body?: DirectResponseBody; // Response body
}

// Default traffic policy for requests without client header
export type DefaultTrafficPolicy = 'allow_all' | 'deny' | 'require_ip_allowlist';

// Security status for routes with client attachments
export type SecurityStatus = 'none' | 'warning' | 'protected';

export interface RouteConfig {
  routeType?: RouteType;     // "backend" (default), "redirect", or "directResponse"
  matches: RouteMatch[];
  backends: RouteBackend[];
  mirrors?: MirrorBackend[];         // Mirror destinations for request mirroring
  redirect?: RedirectConfig;         // Used when routeType is "redirect"
  directResponse?: DirectResponseConfig; // Used when routeType is "directResponse"
  requestHeaderModifier?: HeaderModifier;
  responseHeaderModifier?: HeaderModifier;
  urlRewrite?: URLRewrite;
  // Default traffic policy for requests without x-client-id header (when clients are attached)
  defaultTrafficPolicy?: DefaultTrafficPolicy;
  defaultAllowedCIDRs?: string[];    // CIDRs for "require_ip_allowlist" policy
  // Note: CORS is now in SecurityPolicy, not here
}

// Security Policy types (Envoy Gateway specific)
export interface AuthorizationHeaderMatch {
  name: string;
  values: string[];
}

export interface AuthorizationOperation {
  methods?: string[];
}

export interface AuthorizationPrincipal {
  clientCIDRs?: string[];
  jwt?: { provider: string; claims?: Array<{ name: string; values: string[]; valueType?: string }> };
  headers?: AuthorizationHeaderMatch[];
}

export interface AuthorizationRule {
  action: string;
  principal: AuthorizationPrincipal;
  operation?: AuthorizationOperation;
}

export interface AuthorizationConfig {
  defaultAction: string;
  rules: AuthorizationRule[];
}

export interface JWTProviderConfig {
  name: string;
  issuer: string;
  remoteJWKS?: { uri: string };
  audiences?: string[];
  claimToHeaders?: Array<{ claim: string; header: string }>;
}

export interface SecurityPolicyConfig {
  cors?: CORSConfig;
  authorization?: AuthorizationConfig;
  apiKeyAuth?: {
    credentialRefs: Array<{ name: string; namespace?: string }>;
    extractFrom: Array<{ headers: string[] }>;
  };
  jwt?: {
    providers: JWTProviderConfig[];
  };
  oidc?: {
    provider?: { issuer: string };
    clientId: string;
    clientSecret?: { name: string; namespace?: string };
    redirectURL: string;
    logoutPath: string;
    scopes?: string[];
    cookieDomain?: string;
  };
  extAuth?: ExtAuthConfig;
}

export interface CORSConfig {
  allowOrigins?: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  allowCredentials?: boolean;
}

export interface SecurityPolicy {
  id: string;
  routeId: string;
  projectId: string;
  config: SecurityPolicyConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityPolicyInput {
  cors?: CORSConfig;
  authorization?: {
    allowedCIDRs?: string[];
    headers?: AuthorizationHeaderMatch[];
    methods?: string[];
  };
  apiKeyAuth?: {
    secretName: string;
    headerName: string;
  };
  jwt?: {
    issuer: string;
    jwksUrl: string;
    audiences?: string[];
    claimToHeaders?: Array<{ claim: string; header: string }>;
  };
  oidc?: {
    issuer: string;
    clientId: string;
    clientSecretName: string;
    redirectURL: string;
    logoutPath: string;
    scopes?: string[];
    cookieDomain?: string;
  };
  extAuth?: ExtAuthConfig;
}

// External Authorization types
export interface ExtAuthConfig {
  type: 'http' | 'grpc';
  http?: ExtAuthHTTPConfig;
  grpc?: ExtAuthGRPCConfig;
  failOpen?: boolean;
  headersToExtAuth?: string[];
  headersToDownstreamOnDeny?: string[];
  headersToDownstreamOnAllow?: string[];
  headersToUpstreamOnAllow?: string[];
  withRequestBody?: ExtAuthRequestBody;
}

export interface ExtAuthHTTPConfig {
  backendRef: ExtAuthBackendRef;
  path: string;
  headersToBackend?: string[];
}

export interface ExtAuthGRPCConfig {
  backendRef: ExtAuthBackendRef;
}

export interface ExtAuthBackendRef {
  name: string;
  namespace?: string;
  port: number;
}

export interface ExtAuthRequestBody {
  maxBytes: number;
}

// Backend Traffic Policy types (Envoy Gateway specific)
export type CompressionType = 'Gzip' | 'Brotli' | 'Zstd';

export interface CompressionConfig {
  type: CompressionType;
  gzip?: Record<string, never>;   // Empty object for now
  brotli?: Record<string, never>; // Empty object for now
  zstd?: Record<string, never>;   // Empty object for now
}

export interface RetryConfig {
  numRetries?: number;
  retryOn?: RetryOn;
  perRetryPolicy?: PerRetryPolicy;
}

export interface RetryOn {
  httpStatusCodes?: number[];
  triggers?: string[];
}

export interface PerRetryPolicy {
  backOff?: BackOffPolicy;
  timeout?: string;
}

export interface BackOffPolicy {
  baseInterval?: string;
  maxInterval?: string;
}

// Load Balancer types
export type LoadBalancerType = 'RoundRobin' | 'Random' | 'LeastRequest' | 'ConsistentHash';
export type ConsistentHashType = 'SourceIP' | 'Header' | 'Cookie';

export interface ConsistentHashHeader {
  name: string;
}

export interface ConsistentHashCookie {
  name: string;
  ttl?: string;
  attributes?: Record<string, string>;
}

export interface ConsistentHashConfig {
  type: ConsistentHashType;
  header?: ConsistentHashHeader;
  cookie?: ConsistentHashCookie;
}

export interface LoadBalancerConfig {
  type: LoadBalancerType;
  consistentHash?: ConsistentHashConfig;
}

export interface CircuitBreakerConfig {
  maxConnections?: number;
  maxPendingRequests?: number;
  maxParallelRequests?: number;
  maxParallelRetries?: number;
  maxRequestsPerConnection?: number;
}

export interface HealthCheckConfig {
  active?: ActiveHealthCheckConfig;
  passive?: PassiveHealthCheckConfig;
  panicThreshold?: number;
}

export interface ActiveHealthCheckConfig {
  timeout?: string;
  interval?: string;
  unhealthyThreshold?: number;
  healthyThreshold?: number;
  type: 'HTTP' | 'TCP' | 'GRPC';
  http?: HTTPActiveHealthCheckConfig;
  tcp?: TCPActiveHealthCheckConfig;
  grpc?: GRPCActiveHealthCheckConfig;
}

export interface HTTPActiveHealthCheckConfig {
  path: string;
  method?: string;
  expectedStatuses?: number[];
}

export interface TCPActiveHealthCheckConfig {
  send?: HealthCheckPayload;
  receive?: HealthCheckPayload;
}

export interface GRPCActiveHealthCheckConfig {
  service?: string;
}

export interface HealthCheckPayload {
  type: 'Text';
  text?: string;
}

export interface PassiveHealthCheckConfig {
  consecutiveGatewayErrors?: number;
  consecutive5xxErrors?: number;
  interval?: string;
  baseEjectionTime?: string;
}

export interface FaultInjectionConfig {
  delay?: FaultInjectionDelayConfig;
  abort?: FaultInjectionAbortConfig;
}

export interface FaultInjectionDelayConfig {
  fixedDelay: string;
  percentage?: number;
}

export interface FaultInjectionAbortConfig {
  httpStatus?: number;
  grpcStatus?: number;
  percentage?: number;
}

// Rate Limit types
export interface RateLimitConfig {
  global?: GlobalRateLimitConfig;
}

export interface GlobalRateLimitConfig {
  rules: RateLimitRule[];
}

export interface RateLimitRule {
  limit: RateLimitValue;
  clientSelectors?: RateLimitSelector[];
}

export interface RateLimitValue {
  requests: number;
  unit: 'Second' | 'Minute' | 'Hour' | 'Day';
}

export interface RateLimitSelector {
  headers?: RateLimitHeaderMatch[];
  sourceCIDR?: RateLimitSourceCIDR;
  path?: RateLimitPathMatch;
  methods?: string[];
}

export interface RateLimitHeaderMatch {
  name: string;
  value?: string;
  type?: 'Exact' | 'Distinct';
  invert?: boolean;
}

export interface RateLimitSourceCIDR {
  value: string;
  type?: 'Exact' | 'Distinct';
}

export interface RateLimitPathMatch {
  value: string;
  type: 'Exact' | 'PathPrefix' | 'RegularExpression';
}

// Request Buffering
export interface RequestBufferConfig {
  limit: string; // e.g., "4Ki", "1Mi"
}

// Response Override
export interface ResponseOverrideRule {
  match: ResponseOverrideMatch;
  response: ResponseOverrideResponse;
}

export interface ResponseOverrideMatch {
  statusCodes: StatusCodeMatch[];
}

export interface StatusCodeMatch {
  type: 'Value' | 'Range';
  value?: number;
  range?: StatusCodeRange;
}

export interface StatusCodeRange {
  start: number;
  end: number;
}

export interface ResponseOverrideResponse {
  contentType: string;
  body: ResponseOverrideBody;
}

export interface ResponseOverrideBody {
  type: 'Inline' | 'ValueRef';
  inline?: string;
  valueRef?: ValueRef;
}

export interface ValueRef {
  group?: string;
  kind: 'ConfigMap' | 'Secret';
  name: string;
  namespace?: string;
}

// EnvoyExtensionPolicy types
export interface EnvoyExtensionPolicyConfig {
  lua?: LuaExtensionConfig;
  wasm?: WasmExtensionConfig;
  extProc?: ExtProcExtensionConfig;
}

export interface LuaExtensionConfig {
  type: 'Inline' | 'ValueRef';
  inline?: string;
  valueRef?: ValueRef;
}

export interface WasmExtensionConfig {
  name: string;
  rootID?: string;
  code: WasmCodeSource;
  config?: string; // JSON config for wasm module
}

export interface WasmCodeSource {
  type: 'HTTP' | 'Image';
  http?: WasmHTTPSource;
  image?: WasmImageSource;
}

export interface WasmHTTPSource {
  url: string;
  sha256: string;
}

export interface WasmImageSource {
  url: string;
  sha256?: string;
  pullSecret?: ValueRef;
}

export interface ExtProcExtensionConfig {
  backendRef: ExtProcBackendRef;
  processingMode?: ExtProcProcessingMode;
  failOpen?: boolean;
}

export interface ExtProcBackendRef {
  name: string;
  namespace: string;
  port: number;
}

export interface ExtProcProcessingMode {
  request?: ExtProcBodyMode;
  response?: ExtProcBodyMode;
}

export interface ExtProcBodyMode {
  body?: 'None' | 'Buffered' | 'Streamed';
}

export interface EnvoyExtensionPolicy {
  id: string;
  routeId: string;
  projectId: string;
  config: EnvoyExtensionPolicyConfig;
  createdAt: string;
  updatedAt: string;
}

// WAF Policy types
export interface WafPolicyConfig {
  mode: 'block' | 'detect';
  rulesets?: string[];
  anomalyThreshold?: number;
  paranoiaLevel?: number;
  disabledRuleIDs?: number[];
  customDirectives?: string[];
}

export interface WafPolicy {
  id: string;
  routeId: string;
  projectId: string;
  config: WafPolicyConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCapabilities {
  rateLimitAvailable: boolean;
}

// BTP Timeout types (BackendTrafficPolicy-level, works for both HTTP and gRPC)
export interface BTPTimeoutConfig {
  tcp?: BTPTCPTimeoutConfig;
  http?: BTPHTTPTimeoutConfig;
}
export interface BTPTCPTimeoutConfig {
  connectTimeout?: string;
}
export interface BTPHTTPTimeoutConfig {
  requestTimeout?: string;
  connectionIdleTimeout?: string;
  maxConnectionDuration?: string;
  maxStreamDuration?: string;
}

export interface BackendTrafficPolicyConfig {
  compression?: CompressionConfig[];
  retry?: RetryConfig;
  loadBalancer?: LoadBalancerConfig;
  circuitBreaker?: CircuitBreakerConfig;
  healthCheck?: HealthCheckConfig;
  faultInjection?: FaultInjectionConfig;
  rateLimit?: RateLimitConfig;
  requestBuffer?: RequestBufferConfig;
  responseOverride?: ResponseOverrideRule[];
  timeout?: BTPTimeoutConfig;
}

export interface BackendTrafficPolicy {
  id: string;
  routeId?: string;
  domainId?: string;
  projectId: string;
  config: BackendTrafficPolicyConfig;
  createdAt: string;
  updatedAt: string;
}

export interface BackendTrafficPolicyInput {
  compression?: CompressionConfig[];
  retry?: RetryConfig;
  loadBalancer?: LoadBalancerConfig;
  circuitBreaker?: CircuitBreakerConfig;
  healthCheck?: HealthCheckConfig;
  faultInjection?: FaultInjectionConfig;
  rateLimit?: RateLimitConfig;
  requestBuffer?: RequestBufferConfig;
  responseOverride?: ResponseOverrideRule[];
  timeout?: BTPTimeoutConfig;
}

export interface Route {
  id: string;
  domainId: string;
  teamId: string;
  team?: Team;
  name: string;
  description: string;
  protocol: RouteProtocol;
  securityMode: SecurityMode;
  status: RouteStatus;
  config: RouteConfig;
  securityPolicy?: SecurityPolicy; // Envoy Gateway SecurityPolicy (CORS, auth, etc.)
  backendTrafficPolicy?: BackendTrafficPolicy; // Envoy Gateway BackendTrafficPolicy (compression, etc.)
  extensionPolicy?: EnvoyExtensionPolicy; // Envoy Gateway EnvoyExtensionPolicy (Lua, Wasm)
  wafPolicy?: WafPolicy; // WAF Policy (Coraza WAF)
  pendingApproval?: ApprovalRequest;
  createdBy: string;
  creator?: User;
  createdAt: string;
  updatedAt: string;
  labels?: Record<string, string>;
  // Computed fields
  clientCount?: number;           // Number of active client attachments
  securityStatus?: SecurityStatus; // Security status based on clients and default policy
}

/**
 * Backend RouteResponse JSON shape. The Go struct embeds *models.Route, so the
 * JSON is flat: { ...route fields, warnings: [...] }. Warnings are emitted by
 * the route create/update handlers when BackendTLSWarnings or
 * DirectResponsePercentWarnings has anything to report.
 */
export type RouteWithWarnings = Route & { warnings?: string[] };

export interface CreateRouteInput {
  name: string;
  description?: string;
  protocol?: RouteProtocol;
  securityMode?: SecurityMode;
  teamId: string;
  config: RouteConfig;
  securityPolicy?: SecurityPolicyInput;
  backendTrafficPolicy?: BackendTrafficPolicyInput;
  extensionPolicy?: EnvoyExtensionPolicyConfig;
  wafPolicy?: WafPolicyConfig;
  changeDescription?: string;
  aiReview?: AIReviewResult;
  labels?: Record<string, string>;
}

export interface UpdateRouteInput {
  description?: string;
  config: RouteConfig;
  securityPolicy?: SecurityPolicyInput;
  backendTrafficPolicy?: BackendTrafficPolicyInput;
  extensionPolicy?: EnvoyExtensionPolicyConfig;
  wafPolicy?: WafPolicyConfig;
  labels?: Record<string, string>;
}

// Approval types
export type ApprovalAction = 'create' | 'update' | 'delete' | 'export';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  routeId: string;
  route?: Route;
  entityType?: 'route' | 'client_attachment' | 'certificate';
  action: ApprovalAction;
  configSnapshot?: RouteConfig;
  previousConfig?: RouteConfig;
  submittedBy: string;
  submitter?: User;
  reviewedBy?: string;
  reviewer?: User;
  status: ApprovalStatus;
  rejectionComment?: string;
  entityName?: string;
  domainName?: string;
  stages?: ApprovalStage[];
  createdAt: string;
  reviewedAt?: string;
}

// Client types

// JWT Required Claim for authorization
export interface JWTRequiredClaim {
  name: string;           // Claim name (e.g., "scope", "role")
  values: string[];       // Required values
  valueType?: 'Exact' | 'StringContains';  // Match type (default: Exact)
}

// JWT Claim to Header mapping (optional/future)
export interface JWTClaimToHeader {
  claim: string;   // JWT claim name
  header: string;  // HTTP header to add
}

export interface Client {
  id: string;
  teamId: string;
  team?: Team;
  name: string;
  description: string;
  contactName: string;
  contactEmail: string;
  createdBy: string;
  creator?: User;
  ipAddressCount: number;
  headerCount: number;
  attachmentCount: number;
  // API Key Authentication
  apiKeyEnabled: boolean;
  apiKeyPrefix?: string;
  apiKeyHeaderName: string;       // Header for API key value (e.g., "x-api-key")
  clientIdHeaderName: string;     // Header for client ID routing (e.g., "x-client-id")
  apiKeyCreatedAt?: string;
  apiKeyCreatedBy?: string;
  // JWT Authentication
  jwtEnabled: boolean;
  jwtIssuer?: string;
  jwtJwksUrl?: string;
  jwtAudiences?: string[];
  jwtRequiredClaims?: JWTRequiredClaim[];
  jwtClaimToHeaders?: JWTClaimToHeader[];
  jwtCreatedAt?: string;
  jwtCreatedBy?: string;
  // mTLS Authentication
  mtlsEnabled: boolean;
  mtlsCaName?: string;
  mtlsCaSecret?: string;
  mtlsCaSecretKey?: string;
  mtlsSans?: MTLSSANEntry[];
  mtlsHashes?: string[];
  mtlsCreatedAt?: string;
  mtlsCreatedBy?: string;
  // Managed certificate identity (mutually exclusive with the BYO CA config above)
  managedCertificateId?: string;
  // Header & Method Authorization
  allowedMethods?: string[];
  createdAt: string;
  updatedAt: string;
}

// API Key types
export interface GenerateAPIKeyInput {
  headerName?: string;
}

export interface GenerateAPIKeyResponse {
  apiKey: string;
  prefix: string;
  headerName: string;
  createdAt: string;
}

// JWT Configuration types
export interface ConfigureJWTInput {
  issuer: string;
  jwksUrl: string;
  audiences?: string[];
  requiredClaims?: JWTRequiredClaim[];
  claimToHeaders?: JWTClaimToHeader[];
}

export interface ConfigureJWTResponse {
  jwtEnabled: boolean;
  jwtIssuer: string;
  jwtJwksUrl: string;
  jwtAudiences?: string[];
  jwtRequiredClaims?: JWTRequiredClaim[];
  jwtClaimToHeaders?: JWTClaimToHeader[];
  jwtCreatedAt: string;
  jwtCreatedBy: string;
}

export interface ClientIPAddress {
  id: string;
  clientId: string;
  cidr: string;
  description: string;
  createdBy: string;
  creator?: User;
  createdAt: string;
}

export interface ClientHeader {
  id: string;
  clientId: string;
  name: string;
  values: string[];
  description: string;
  createdBy: string;
  creator?: User;
  createdAt: string;
}

export interface CreateClientHeaderInput {
  name: string;
  values: string[];
  description?: string;
}

export interface CreateClientInput {
  name: string;
  description?: string;
  teamId: string;
  contactName?: string;
  contactEmail?: string;
  clientIdHeaderName?: string;    // Header for client ID routing (default: x-client-id)
}

export interface UpdateClientInput {
  name?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  clientIdHeaderName?: string;    // Header for client ID routing
}

export interface CreateClientIPInput {
  cidr: string;
  description?: string;
}

// Client Attachment types
export type AttachmentStatus = 'pending_attach' | 'pending_update' | 'pending_detach' | 'approved' | 'active' | 'removed' | 'rejected';

export interface ClientRouteAttachment {
  id: string;
  clientId: string;
  client?: Client;
  routeId: string;
  route?: Route;
  enableIpAllowlist: boolean;
  enableApiKey: boolean;
  enableJwt: boolean;
  enableBasicAuth: boolean;
  enableMtls: boolean;
  enableHeaderAuth: boolean;
  rateLimitConfig?: RateLimitConfig;
  extAuth?: ExtAuthConfig;
  status: AttachmentStatus;
  pendingApproval?: Approval;
  createdBy: string;
  creator?: User;
  createdAt: string;
  updatedAt: string;
}

export interface AttachClientFromRouteInput {
  clientId: string;
  enableIpAllowlist: boolean;
  enableApiKey: boolean;
  enableJwt: boolean;
  enableBasicAuth: boolean;
  enableMtls: boolean;
  enableHeaderAuth: boolean;
  rateLimitConfig?: RateLimitConfig;
  extAuth?: ExtAuthConfig;
}

export interface AttachClientFromClientInput {
  routeId: string;
  projectId: string;
  enableIpAllowlist: boolean;
  enableApiKey: boolean;
  enableJwt: boolean;
  enableBasicAuth: boolean;
  enableMtls: boolean;
  enableHeaderAuth: boolean;
  rateLimitConfig?: RateLimitConfig;
  extAuth?: ExtAuthConfig;
}

export interface ApprovalStage {
  id: string;
  approvalId: string;
  order: number;
  requiredPermission: string;
  requiredTeamId?: string;
  requiredTeamName?: string;
  reviewedBy?: string;
  reviewer?: User;
  status: ApprovalStatus;
  comment?: string;
  minApprovers?: number;
  reviews?: ApprovalStageReview[];
  reviewedAt?: string;
}

export interface ApprovalStageReview {
  id: string;
  stageId: string;
  reviewerId: string;
  reviewer?: User;
  decision: string;
  createdAt: string;
}

export interface ApprovalPolicy {
  id: string;
  projectId: string;
  entityType: 'route' | 'client_attachment' | 'certificate';
  action?: string | null;
  stages: PolicyStageTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface PolicyStageTemplate {
  order: number;
  required_permission: string;
  team_scope: string;
  min_approvers: number;
}

export interface Approval {
  id: string;
  projectId: string;
  entityType: 'route' | 'client_attachment' | 'certificate';
  entityId: string;
  action: string;
  configSnapshot?: unknown;
  previousConfig?: unknown;
  submittedBy: string;
  submitter?: User;
  status: ApprovalStatus;
  stages: ApprovalStage[];
  entityName?: string;
  domainName?: string;
  changeDescription?: string;
  aiReview?: AIReviewResult;
  createdAt: string;
}

// Effective IP allowlist entry (computed from active client attachments)
export interface EffectiveIPEntry {
  cidr: string;
  clientId: string;
  clientName: string;
  description?: string;
}

// Audit types
export interface AuditLog {
  id: string;
  projectId?: string;
  userId?: string;
  username: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// Kubernetes types
export interface K8sNamespace {
  name: string;
  status: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  ports: Array<{ name: string; port: number; protocol: string }>;
}

// Pagination types
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// Project Permission types
export interface ProjectPermissions {
  canManageDomainTemplates: boolean;
  canManageDomains: boolean;
  canManageTeams: boolean;
  canCreateRoutes: boolean;
  canApproveRoutes: boolean;
  canViewAudit: boolean;
  permissions: string[];
  isOwner: boolean;
  isProjectAdmin: boolean;
}

// Project Namespace types (for cross-namespace routing with ReferenceGrants)
export type NamespaceCapability = 'deploy_gateway' | 'backend_service' | 'tls_secret';

export const ALL_NAMESPACE_CAPABILITIES: NamespaceCapability[] = [
  'deploy_gateway',
  'backend_service',
  'tls_secret',
];

export const NAMESPACE_CAPABILITY_LABELS: Record<NamespaceCapability, { title: string; description: string }> = {
  deploy_gateway: {
    title: 'Deploy Gateway',
    description: 'Gateway and HTTPRoute / GRPCRoute resources can be deployed in this namespace.',
  },
  backend_service: {
    title: 'Backend Service',
    description: 'HTTPRoutes can forward traffic to Services in this namespace.',
  },
  tls_secret: {
    title: 'TLS Secret',
    description: 'Gateway can mount TLS Secrets stored in this namespace.',
  },
};

export interface ProjectNamespace {
  id: string;
  projectId: string;
  namespace: string;
  capabilities: NamespaceCapability[];
  referenceGrantCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectNamespaceInput {
  namespace: string;
  capabilities: NamespaceCapability[];
}

export interface UpdateProjectNamespaceInput {
  capabilities: NamespaceCapability[];
}

// AI Types
export type AIGenerateMode = 'natural_language' | 'manifest_import';

export interface AIGenerateRequest {
  mode: AIGenerateMode;
  input: string;
  formatHint?: 'ingress' | 'istio' | 'kong';
}

export interface AIStatus {
  enabled: boolean;
  provider?: 'anthropic' | 'openai';
}

export interface AIWarning {
  field?: string;
  category: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface AIGeneratedRoute {
  name: string;
  description?: string;
  protocol?: 'http' | 'grpc';
  securityMode?: 'general' | 'client';
  config: RouteConfig;
  warnings?: AIWarning[];
  securityPolicy?: SecurityPolicyInput;
  backendTrafficPolicy?: BackendTrafficPolicyInput;
  extensionPolicy?: EnvoyExtensionPolicyConfig;
  wafPolicy?: WafPolicyConfig;
}

export interface RoutePrefillData {
  name: string;
  description?: string;
  protocol?: 'http' | 'grpc';
  securityMode?: 'general' | 'client';
  teamId: string;
  config: RouteConfig;
  securityPolicy?: SecurityPolicyInput;
  backendTrafficPolicy?: BackendTrafficPolicyInput;
  extensionPolicy?: EnvoyExtensionPolicyConfig;
  wafPolicy?: WafPolicyConfig;
}

export interface AIStreamChunk {
  type: 'content' | 'route' | 'warning' | 'error' | 'done';
  content?: string;
  route?: AIGeneratedRoute;
  warning?: AIWarning;
  error?: string;
  index?: number;
  total?: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  routes?: AIGeneratedRoute[];
  timestamp: Date;
}

// AI Review types
export interface AIReviewNote {
  severity: 'warning' | 'info';
  message: string;
}

export interface AIReviewResult {
  summary: string;
  risks?: AIReviewNote[];
  securityNotes?: AIReviewNote[];
  suggestions?: string[];
  configHighlights?: string[];
}

export interface AIReviewRequest {
  action: 'create' | 'update' | 'delete';
  description?: string;
  proposedYaml?: {
    httpRoute?: string;
    securityPolicy?: string;
    backendTrafficPolicy?: string;
    envoyExtensionPolicy?: string;
    backend?: string;
  };
  currentYaml?: {
    httpRoute?: string;
    securityPolicy?: string;
    backendTrafficPolicy?: string;
    envoyExtensionPolicy?: string;
    backend?: string;
  };
}

// AI Chat types
export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatContext {
  type: 'route' | 'domain';
  route?: Record<string, unknown>;
  domain?: Record<string, unknown>;
}

export interface AIChatRequest {
  message: string;
  context?: AIChatContext;
  history?: AIChatMessage[];
}

// SSO Types
export interface SSOPublicConfig {
  enabled: boolean;
  providerName: string;
  forceSSO: boolean;
  allowedDomains?: string[];
}

export interface SSOConfig {
  id: string;
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  scopes: string[];
  allowedDomains: string[] | null;
  allowedEmails: string[] | null;
  autoRegister: boolean;
  forceSSO: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SSOConfigInput {
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  allowedDomains: string[];
  allowedEmails: string[];
  autoRegister: boolean;
  forceSSO: boolean;
}

export interface TeamEmailInvite {
  id: string;
  teamId: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  team?: {
    id: string;
    name: string;
  };
  inviter?: {
    id: string;
    username: string;
  };
}

export interface AddMemberByEmailResult {
  type: 'added' | 'invited';
  user?: User;
  invite?: TeamEmailInvite;
}

// Approval Comments
export interface ApprovalComment {
  id: string;
  approvalId: string;
  userId: string;
  body: string;
  user?: User;
  createdAt: string;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

// System Settings Types
export interface SystemSettingsEffective {
  baseUrl: string;
  jwtExpiry: string;
  refreshTokenExpiry: string;
  logLevel: string;
}

export interface SystemSettingsResponse {
  baseUrl: string;
  jwtExpiry: string;
  refreshTokenExpiry: string;
  logLevel: string;
  effective: SystemSettingsEffective;
}

export interface SystemSettingsInput {
  baseUrl: string;
  jwtExpiry: string;
  refreshTokenExpiry: string;
  logLevel: string;
}

// OpenAPI Import types
export interface DefaultBackend {
  service?: string;
  namespace?: string;
  address?: string;
  port: number;
}

export interface OpenAPIImportRequest {
  spec: string;
  defaultBackend: DefaultBackend;
}

export interface ParsedRoute {
  name: string;
  description?: string;
  protocol: 'http';
  securityMode: 'general';
  config: RouteConfig;
  tag?: string;
}

export interface ImportWarning {
  level: 'info' | 'warning';
  source: string;
  message: string;
}

export interface Rename {
  original: string;
  final: string;
  reason: 'duplicate' | 'sanitized' | 'truncated';
}

export interface SpecInfo {
  title: string;
  version: string;
  format: 'openapi-3.0' | 'openapi-3.1';
}

export interface OpenAPIImportResponse {
  routes: ParsedRoute[];
  warnings: ImportWarning[];
  renames: Rename[];
  specInfo: SpecInfo;
}

export interface RouteEdit {
  matcher?: { type: 'Exact' | 'Prefix' | 'RegularExpression'; value: string };
  backend?: DefaultBackend;
  description?: string;
}

// Certificate types
export type ManagedCertUsage = 'server' | 'client';
export type ManagedCertStatus = 'pending' | 'issuing' | 'ready' | 'error';
export type ManagedCertKeyMode = 'managed' | 'csr';
export type IssuerType = 'self_signed_ca' | 'acme';
export type IssuerStatus = 'pending' | 'ready' | 'error';
export type CertDistStatus = 'pending' | 'synced' | 'error';

export interface IssuerConfig {
  commonName?: string;
  keyAlgorithm?: string;
  keySize?: number;
  durationDays?: number;
  server?: string;
  email?: string;
  eabKeyId?: string;
  dnsCredentialId?: string;
  clusterIssuerName?: string;
}
export interface CertificateIssuer {
  id: string;
  name: string;
  type: IssuerType;
  status: IssuerStatus;
  statusMessage?: string;
  config: IssuerConfig;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
export interface IssuerStatusResponse { status: IssuerStatus; statusMessage?: string; }

export interface IssuerProjectGrant {
  id: string;
  issuerId: string;
  projectId: string;
  createdBy?: string;
  createdAt: string;
}

// FLAT response shape — no `config` wrapper (mirrors backend managedCertificateResponse).
export interface ManagedCertificate {
  id: string;
  projectId: string;
  name: string;
  issuerId: string;
  usage: ManagedCertUsage;
  dnsNames?: string[];
  status: ManagedCertStatus;
  statusMessage?: string;
  fingerprint?: string;
  notAfter?: string;
  createdAt: string;
  keyMode?: ManagedCertKeyMode;
  subject?: string;
  uriSans?: string[];
  exportAvailable?: boolean;
}
export interface ManagedCertificateStatus { status: ManagedCertStatus; message?: string; notAfter?: string; }
export interface CertificateDistribution {
  status: CertDistStatus;
  lastPushedFingerprint?: string;
  message?: string;
  lastSyncedAt?: string;
}

export interface DNSProviderCredential {
  id: string;
  name: string;
  providerType: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateDNSCredentialInput { name: string; providerType: string; credentials: { apiToken: string }; }
export interface UpdateDNSCredentialInput { name?: string; credentials?: { apiToken: string }; }

export type CreateIssuerInput =
  | { type: 'self_signed_ca'; name: string; commonName: string; keyAlgorithm: string; keySize: number; durationDays: number }
  | { type: 'acme'; name: string; server: string; email: string; dnsCredentialId: string; eab?: { keyId: string; hmacKey: string } };

export interface CreateCertificateInput {
  name: string;
  issuerId: string;
  usage: ManagedCertUsage;
  dnsNames?: string[];
  subject?: string;
  keyAlgorithm?: string;
  keySize?: number;
  durationDays?: number;
  keyMode?: ManagedCertKeyMode;
  uriSans?: string[];
  csr?: string;
}
export interface CreateCertificateResponse { certificate: ManagedCertificate; approvalId: string | null; }

export interface DomainSummary { id: string; hostname: string; }
export interface EnrichedCertificate extends ManagedCertificate {
  issuerName: string;
  issuerType: IssuerType;
  distribution: CertificateDistribution | null;
  domains: DomainSummary[];
}
