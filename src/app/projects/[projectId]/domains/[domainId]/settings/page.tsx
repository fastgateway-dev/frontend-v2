'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, AlertTriangle, Info, X, Shield, Trash2, Upload, Sparkles, MessageSquare } from 'lucide-react';
import { Button, Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Accordion, AccordionItem, AccordionTrigger, AccordionContent, Input, InfoTooltip } from '@/components/ui';
import { domainsApi } from '@/lib/api';
import { aiApi } from '@/lib/api/ai';
import { AIReviewCard } from '@/components/features/ai-review-card';
import { YamlDiffViewer } from '@/components/features/yaml-diff-viewer';
import { AIChatPanel } from '@/components/AIChatPanel';
import RequestBufferForm from '@/components/RequestBufferForm';
import ResponseOverrideForm from '@/components/ResponseOverrideForm';
import LuaExtensionForm from '@/components/LuaExtensionForm';
import WasmExtensionForm from '@/components/WasmExtensionForm';
import ExtProcExtensionForm from '@/components/ExtProcExtensionForm';
import type { Domain, DomainSettings, TLSProfile, MTLSCACert, MTLSSANEntry, AIReviewResult, AIChatContext, CompressionType, LoadBalancerType, ConsistentHashType, RetryConfig, RetryOn, PerRetryPolicy, BackOffPolicy, CircuitBreakerConfig, RequestBufferConfig, ResponseOverrideRule, BTPTimeoutConfig, BackendTrafficPolicyConfig, EnvoyExtensionPolicyConfig, LuaExtensionConfig, WasmExtensionConfig, ExtProcExtensionConfig } from '@/types';

// TLS Profile presets
const TLS_PROFILES: Record<TLSProfile, { label: string; description: string; minVersion: string; maxVersion: string; ciphers: string[] }> = {
  modern: {
    label: 'Modern',
    description: 'TLS 1.3 only. Maximum security, may not work with older clients.',
    minVersion: 'TLS1.3',
    maxVersion: 'TLS1.3',
    ciphers: [],
  },
  intermediate: {
    label: 'Intermediate (Recommended)',
    description: 'TLS 1.2+. Good security with broad compatibility.',
    minVersion: 'TLS1.2',
    maxVersion: 'TLS1.3',
    ciphers: [
      'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
      'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
      'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
      'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
    ],
  },
  compatible: {
    label: 'Compatible',
    description: 'TLS 1.0+. Maximum compatibility, weaker security.',
    minVersion: 'TLS1.0',
    maxVersion: 'TLS1.3',
    ciphers: [],
  },
  custom: {
    label: 'Custom',
    description: 'Manual configuration of TLS settings.',
    minVersion: '',
    maxVersion: '',
    ciphers: [],
  },
};

export default function DomainSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const domainId = params.domainId as string;

  const [domain, setDomain] = useState<Domain | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [domainSettings, setDomainSettings] = useState<DomainSettings | null>(null);

  // Client Connection state
  const [tcpKeepaliveEnabled, setTcpKeepaliveEnabled] = useState(false);
  const [tcpProbes, setTcpProbes] = useState('');
  const [tcpIdleTime, setTcpIdleTime] = useState('');
  const [tcpInterval, setTcpInterval] = useState('');
  const [proxyProtocolEnabled, setProxyProtocolEnabled] = useState(false);
  const [maxConnections, setMaxConnections] = useState('');
  const [closeDelay, setCloseDelay] = useState('');
  const [maxConnectionDuration, setMaxConnectionDuration] = useState('');
  const [maxRequestsPerConnection, setMaxRequestsPerConnection] = useState('');
  const [bufferLimit, setBufferLimit] = useState('');

  // Client IP Detection state
  const [ipDetectionMethod, setIpDetectionMethod] = useState<'none' | 'xff' | 'custom'>('none');
  const [xffNumTrustedHops, setXffNumTrustedHops] = useState('1');
  const [customHeaderName, setCustomHeaderName] = useState('');
  const [customHeaderFailClosed, setCustomHeaderFailClosed] = useState(false);

  // Timeout state
  const [requestReceivedTimeout, setRequestReceivedTimeout] = useState('');
  const [httpIdleTimeout, setHttpIdleTimeout] = useState('');

  // HTTP/3 state
  const [http3Enabled, setHttp3Enabled] = useState(false);

  // TLS state
  const [tlsProfile, setTlsProfile] = useState<TLSProfile>('custom');
  const [tlsMinVersion, setTlsMinVersion] = useState('');
  const [tlsMaxVersion, setTlsMaxVersion] = useState('');
  const [tlsCiphers, setTlsCiphers] = useState('');

  // mTLS state
  const [mtlsEnabled, setMtlsEnabled] = useState(false);
  const [mtlsOptional, setMtlsOptional] = useState(true);
  const [mtlsCACerts, setMtlsCACerts] = useState<MTLSCACert[]>([]);
  const [mtlsSanWhitelist, setMtlsSanWhitelist] = useState<MTLSSANEntry[]>([]);
  const [mtlsHashWhitelist, setMtlsHashWhitelist] = useState<string[]>([]);
  // BTP: Compression state
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionTypes, setCompressionTypes] = useState<CompressionType[]>([]);

  // BTP: Retry state
  const [retryEnabled, setRetryEnabled] = useState(false);
  const [retryNumRetries, setRetryNumRetries] = useState<string>('');
  const [retryHttpStatusCodes, setRetryHttpStatusCodes] = useState<number[]>([]);
  const [retryStatusCodeInput, setRetryStatusCodeInput] = useState<string>('');
  const [retryTriggers, setRetryTriggers] = useState<string[]>([]);
  const [retryTimeout, setRetryTimeout] = useState('');
  const [retryBackOffBaseInterval, setRetryBackOffBaseInterval] = useState('');
  const [retryBackOffMaxInterval, setRetryBackOffMaxInterval] = useState('');

  // BTP: Load Balancer state
  const [lbEnabled, setLbEnabled] = useState(false);
  const [lbType, setLbType] = useState<LoadBalancerType>('RoundRobin');
  const [lbConsistentHashType, setLbConsistentHashType] = useState<ConsistentHashType>('SourceIP');
  const [lbHeaderName, setLbHeaderName] = useState('');
  const [lbCookieName, setLbCookieName] = useState('');
  const [lbCookieTTL, setLbCookieTTL] = useState('');
  const [lbCookieAttributes, setLbCookieAttributes] = useState<Array<{key: string; value: string}>>([]);
  const [lbCookieAttrKeyInput, setLbCookieAttrKeyInput] = useState('');
  const [lbCookieAttrValueInput, setLbCookieAttrValueInput] = useState('');

  // BTP: Circuit Breaker state
  const [cbEnabled, setCbEnabled] = useState(false);
  const [cbMaxConnections, setCbMaxConnections] = useState('');
  const [cbMaxPendingRequests, setCbMaxPendingRequests] = useState('');
  const [cbMaxParallelRequests, setCbMaxParallelRequests] = useState('');
  const [cbMaxParallelRetries, setCbMaxParallelRetries] = useState('');
  const [cbMaxRequestsPerConnection, setCbMaxRequestsPerConnection] = useState('');

  // BTP: Timeout state
  const [btpTimeoutEnabled, setBtpTimeoutEnabled] = useState(false);
  const [tcpConnectTimeout, setTcpConnectTimeout] = useState('');
  const [httpRequestTimeout, setHttpRequestTimeout] = useState('');
  const [httpConnectionIdleTimeout, setHttpConnectionIdleTimeout] = useState('');
  const [httpMaxConnectionDuration2, setHttpMaxConnectionDuration2] = useState('');
  const [httpMaxStreamDuration, setHttpMaxStreamDuration] = useState('');

  // BTP: Request Buffer state
  const [requestBuffer, setRequestBuffer] = useState<RequestBufferConfig | undefined>(undefined);

  // BTP: Response Override state
  const [responseOverride, setResponseOverride] = useState<ResponseOverrideRule[]>([]);

  // Extension state
  const [luaExtension, setLuaExtension] = useState<LuaExtensionConfig | undefined>(undefined);
  const [wasmExtension, setWasmExtension] = useState<WasmExtensionConfig | undefined>(undefined);
  const [extProcExtension, setExtProcExtension] = useState<ExtProcExtensionConfig | undefined>(undefined);

  const [isAddingCA, setIsAddingCA] = useState(false);
  const [newCAName, setNewCAName] = useState('');
  const [newCAPem, setNewCAPem] = useState('');
  const [caError, setCAError] = useState<string | null>(null);
  const [newSanType, setNewSanType] = useState<'DNS' | 'URI'>('DNS');
  const [newSanValue, setNewSanValue] = useState('');
  const [sanError, setSanError] = useState<string | null>(null);
  const [newHash, setNewHash] = useState('');
  const [hashError, setHashError] = useState<string | null>(null);

  // YAML manifest state
  const [gatewayYaml, setGatewayYaml] = useState('');
  const [clientTrafficPolicyYaml, setClientTrafficPolicyYaml] = useState('');
  const [proposedClientTrafficPolicyYaml, setProposedClientTrafficPolicyYaml] = useState('');
  const [backendTrafficPolicyYaml, setBackendTrafficPolicyYaml] = useState('');
  const [proposedBackendTrafficPolicyYaml, setProposedBackendTrafficPolicyYaml] = useState('');
  const [envoyExtensionPolicyYaml, setEnvoyExtensionPolicyYaml] = useState('');
  const [proposedEnvoyExtensionPolicyYaml, setProposedEnvoyExtensionPolicyYaml] = useState('');

  // AI Review state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResult | null>(null);
  const [changeDescription, setChangeDescription] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId, domainId]);

  const loadData = async () => {
    try {
      const [domainData, settingsData, yamlsData, aiStatus] = await Promise.all([
        domainsApi.get(projectId, domainId),
        domainsApi.getSettings(projectId, domainId).catch(() => null),
        domainsApi.getYamls(projectId, domainId).catch(() => null),
        aiApi.getStatus().catch(() => ({ enabled: false })),
      ]);

      setDomain(domainData);
      setAiEnabled(aiStatus.enabled);

      if (settingsData) {
        setDomainSettings(settingsData);
        loadSettingsIntoForm(settingsData);
      }

      if (yamlsData) {
        setGatewayYaml(yamlsData.gatewayYaml || '');
        setClientTrafficPolicyYaml(yamlsData.clientTrafficPolicyYaml || '');
        setBackendTrafficPolicyYaml(yamlsData.backendTrafficPolicyYaml || '');
        setEnvoyExtensionPolicyYaml(yamlsData.envoyExtensionPolicyYaml || '');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettingsIntoForm = (settingsData: DomainSettings | null) => {
    // Client Connection
    const conn = settingsData?.settings?.clientConnection;
    if (conn?.tcpKeepalive) {
      setTcpKeepaliveEnabled(true);
      setTcpProbes(conn.tcpKeepalive.probes?.toString() ?? '');
      setTcpIdleTime(conn.tcpKeepalive.idleTime ?? '');
      setTcpInterval(conn.tcpKeepalive.interval ?? '');
    } else {
      setTcpKeepaliveEnabled(false);
      setTcpProbes('');
      setTcpIdleTime('');
      setTcpInterval('');
    }
    setProxyProtocolEnabled(conn?.proxyProtocol?.enabled ?? false);
    setMaxConnections(conn?.connectionLimit?.maxConnections?.toString() ?? '');
    setCloseDelay(conn?.connectionLimit?.closeDelay ?? '');
    setMaxConnectionDuration(conn?.connectionLimit?.maxConnectionDuration ?? '');
    setMaxRequestsPerConnection(conn?.connectionLimit?.maxRequestsPerConnection?.toString() ?? '');
    setBufferLimit(conn?.bufferLimit ?? '');

    // Client IP Detection
    if (settingsData?.settings?.clientIPDetection?.xForwardedFor) {
      setIpDetectionMethod('xff');
      setXffNumTrustedHops(settingsData.settings.clientIPDetection.xForwardedFor.numTrustedHops?.toString() || '1');
    } else if (settingsData?.settings?.clientIPDetection?.customHeader) {
      setIpDetectionMethod('custom');
      setCustomHeaderName(settingsData.settings.clientIPDetection.customHeader.name || '');
      setCustomHeaderFailClosed(settingsData.settings.clientIPDetection.customHeader.failClosed || false);
    } else {
      setIpDetectionMethod('none');
      setXffNumTrustedHops('1');
      setCustomHeaderName('');
      setCustomHeaderFailClosed(false);
    }

    // Timeout
    const timeout = settingsData?.settings?.timeout;
    setRequestReceivedTimeout(timeout?.http?.requestReceivedTimeout ?? '');
    setHttpIdleTimeout(timeout?.http?.idleTimeout ?? '');

    // HTTP/3
    setHttp3Enabled(settingsData?.settings?.http3?.enabled ?? false);

    // TLS
    const tls = settingsData?.settings?.tls;
    if (tls) {
      const detectedProfile = detectTLSProfile(tls.minVersion, tls.maxVersion);
      setTlsProfile(detectedProfile);
      setTlsMinVersion(tls.minVersion ?? '');
      setTlsMaxVersion(tls.maxVersion ?? '');
      setTlsCiphers(tls.ciphers?.join(', ') ?? '');
    } else {
      setTlsProfile('custom');
      setTlsMinVersion('');
      setTlsMaxVersion('');
      setTlsCiphers('');
    }

    // mTLS
    const mtls = settingsData?.settings?.mtls;
    if (mtls) {
      setMtlsEnabled(mtls.enabled ?? false);
      setMtlsOptional(mtls.optional ?? true);
      setMtlsCACerts(mtls.caCerts ?? []);
      setMtlsSanWhitelist(mtls.sanWhitelist ?? []);
      setMtlsHashWhitelist(mtls.hashWhitelist ?? []);
    } else {
      setMtlsEnabled(false);
      setMtlsOptional(true);
      setMtlsCACerts([]);
      setMtlsSanWhitelist([]);
      setMtlsHashWhitelist([]);
    }

    // Backend Traffic Policy
    const btp = settingsData?.backendTrafficPolicy;
    if (btp) {
      // Compression
      if (btp.compression && btp.compression.length > 0) {
        setCompressionEnabled(true);
        setCompressionTypes(btp.compression.map(c => c.type));
      } else {
        setCompressionEnabled(false);
        setCompressionTypes([]);
      }

      // Retry
      if (btp.retry) {
        setRetryEnabled(true);
        setRetryNumRetries(btp.retry.numRetries?.toString() ?? '');
        setRetryHttpStatusCodes(btp.retry.retryOn?.httpStatusCodes ?? []);
        setRetryTriggers(btp.retry.retryOn?.triggers ?? []);
        setRetryTimeout(btp.retry.perRetryPolicy?.timeout ?? '');
        setRetryBackOffBaseInterval(btp.retry.perRetryPolicy?.backOff?.baseInterval ?? '');
        setRetryBackOffMaxInterval(btp.retry.perRetryPolicy?.backOff?.maxInterval ?? '');
      } else {
        setRetryEnabled(false);
        setRetryNumRetries('');
        setRetryHttpStatusCodes([]);
        setRetryTriggers([]);
        setRetryTimeout('');
        setRetryBackOffBaseInterval('');
        setRetryBackOffMaxInterval('');
      }

      // Load Balancer
      if (btp.loadBalancer) {
        setLbEnabled(true);
        setLbType(btp.loadBalancer.type);
        if (btp.loadBalancer.consistentHash) {
          setLbConsistentHashType(btp.loadBalancer.consistentHash.type);
          setLbHeaderName(btp.loadBalancer.consistentHash.header?.name ?? '');
          setLbCookieName(btp.loadBalancer.consistentHash.cookie?.name ?? '');
          setLbCookieTTL(btp.loadBalancer.consistentHash.cookie?.ttl ?? '');
          if (btp.loadBalancer.consistentHash.cookie?.attributes) {
            setLbCookieAttributes(
              Object.entries(btp.loadBalancer.consistentHash.cookie.attributes).map(([key, value]) => ({ key, value }))
            );
          }
        }
      } else {
        setLbEnabled(false);
        setLbType('RoundRobin');
        setLbConsistentHashType('SourceIP');
        setLbHeaderName('');
        setLbCookieName('');
        setLbCookieTTL('');
        setLbCookieAttributes([]);
      }

      // Circuit Breaker
      if (btp.circuitBreaker) {
        setCbEnabled(true);
        setCbMaxConnections(btp.circuitBreaker.maxConnections?.toString() ?? '');
        setCbMaxPendingRequests(btp.circuitBreaker.maxPendingRequests?.toString() ?? '');
        setCbMaxParallelRequests(btp.circuitBreaker.maxParallelRequests?.toString() ?? '');
        setCbMaxParallelRetries(btp.circuitBreaker.maxParallelRetries?.toString() ?? '');
        setCbMaxRequestsPerConnection(btp.circuitBreaker.maxRequestsPerConnection?.toString() ?? '');
      } else {
        setCbEnabled(false);
        setCbMaxConnections('');
        setCbMaxPendingRequests('');
        setCbMaxParallelRequests('');
        setCbMaxParallelRetries('');
        setCbMaxRequestsPerConnection('');
      }

      // Timeout
      if (btp.timeout) {
        setBtpTimeoutEnabled(true);
        setTcpConnectTimeout(btp.timeout.tcp?.connectTimeout ?? '');
        setHttpRequestTimeout(btp.timeout.http?.requestTimeout ?? '');
        setHttpConnectionIdleTimeout(btp.timeout.http?.connectionIdleTimeout ?? '');
        setHttpMaxConnectionDuration2(btp.timeout.http?.maxConnectionDuration ?? '');
        setHttpMaxStreamDuration(btp.timeout.http?.maxStreamDuration ?? '');
      } else {
        setBtpTimeoutEnabled(false);
        setTcpConnectTimeout('');
        setHttpRequestTimeout('');
        setHttpConnectionIdleTimeout('');
        setHttpMaxConnectionDuration2('');
        setHttpMaxStreamDuration('');
      }

      // Request Buffer
      setRequestBuffer(btp.requestBuffer);

      // Response Override
      setResponseOverride(btp.responseOverride ?? []);
    } else {
      setCompressionEnabled(false);
      setCompressionTypes([]);
      setRetryEnabled(false);
      setLbEnabled(false);
      setCbEnabled(false);
      setBtpTimeoutEnabled(false);
      setRequestBuffer(undefined);
      setResponseOverride([]);
    }

    // Extension Policy
    const ext = settingsData?.extensionPolicy;
    if (ext) {
      setLuaExtension(ext.lua);
      setWasmExtension(ext.wasm);
      setExtProcExtension(ext.extProc);
    } else {
      setLuaExtension(undefined);
      setWasmExtension(undefined);
      setExtProcExtension(undefined);
    }
  };

  const detectTLSProfile = (minVersion?: string, maxVersion?: string): TLSProfile => {
    if (minVersion === 'TLS1.3' && maxVersion === 'TLS1.3') return 'modern';
    if (minVersion === 'TLS1.2' && maxVersion === 'TLS1.3') return 'intermediate';
    if (minVersion === 'TLS1.0' && maxVersion === 'TLS1.3') return 'compatible';
    return 'custom';
  };

  const handleTLSProfileChange = (profile: TLSProfile) => {
    setTlsProfile(profile);
    if (profile !== 'custom') {
      const preset = TLS_PROFILES[profile];
      setTlsMinVersion(preset.minVersion);
      setTlsMaxVersion(preset.maxVersion);
      setTlsCiphers(preset.ciphers.join(', '));
    }
  };

  // mTLS CA Management
  const handleAddCA = async () => {
    if (!newCAName.trim() || !newCAPem.trim()) {
      setCAError('CA name and certificate are required');
      return;
    }
    setIsAddingCA(true);
    setCAError(null);
    try {
      const updatedSettings = await domainsApi.addMTLSCA(projectId, domainId, {
        name: newCAName.trim(),
        caPem: newCAPem.trim(),
      });
      setDomainSettings(updatedSettings);
      loadSettingsIntoForm(updatedSettings);
      setNewCAName('');
      setNewCAPem('');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setCAError(err.response?.data?.error || 'Failed to add CA certificate');
    } finally {
      setIsAddingCA(false);
    }
  };

  const handleRemoveCA = async (caId: string) => {
    if (!confirm('Are you sure you want to remove this CA certificate?')) return;
    try {
      const updatedSettings = await domainsApi.removeMTLSCA(projectId, domainId, caId);
      setDomainSettings(updatedSettings);
      loadSettingsIntoForm(updatedSettings);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setSettingsError(err.response?.data?.error || 'Failed to remove CA certificate');
    }
  };

  // mTLS SAN Whitelist Management
  const handleAddSAN = () => {
    setSanError(null);
    if (!newSanValue.trim()) return;
    const value = newSanValue.trim();
    const isDuplicate = mtlsSanWhitelist.some(san => san.type === newSanType && san.value === value);
    if (isDuplicate) {
      setSanError('This SAN entry is already in the whitelist');
      return;
    }
    setMtlsSanWhitelist([...mtlsSanWhitelist, { type: newSanType, value }]);
    setNewSanValue('');
  };

  const handleRemoveSAN = (index: number) => {
    setMtlsSanWhitelist(mtlsSanWhitelist.filter((_, i) => i !== index));
    setSanError(null);
  };

  // mTLS Hash Whitelist Management
  const handleAddHash = () => {
    setHashError(null);
    if (!newHash.trim()) return;
    const hash = newHash.trim().toLowerCase();
    if (hash.length !== 64) {
      setHashError('Certificate hash must be 64 hex characters (SHA256)');
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      setHashError('Certificate hash must contain only hexadecimal characters (0-9, a-f)');
      return;
    }
    if (mtlsHashWhitelist.includes(hash)) {
      setHashError('This hash is already in the whitelist');
      return;
    }
    setMtlsHashWhitelist([...mtlsHashWhitelist, hash]);
    setNewHash('');
  };

  const handleRemoveHash = (index: number) => {
    setMtlsHashWhitelist(mtlsHashWhitelist.filter((_, i) => i !== index));
    setHashError(null);
  };

  const buildSettingsInput = () => {
    const input: Record<string, unknown> = {};

    const clientConnection: Record<string, unknown> = {};
    if (tcpKeepaliveEnabled) {
      clientConnection.tcpKeepalive = {
        probes: tcpProbes ? parseInt(tcpProbes, 10) : undefined,
        idleTime: tcpIdleTime || undefined,
        interval: tcpInterval || undefined,
      };
    }
    if (proxyProtocolEnabled) {
      clientConnection.proxyProtocol = { enabled: true };
    }
    if (maxConnections || closeDelay || maxConnectionDuration || maxRequestsPerConnection) {
      clientConnection.connectionLimit = {
        maxConnections: maxConnections ? parseInt(maxConnections, 10) : undefined,
        closeDelay: closeDelay || undefined,
        maxConnectionDuration: maxConnectionDuration || undefined,
        maxRequestsPerConnection: maxRequestsPerConnection ? parseInt(maxRequestsPerConnection, 10) : undefined,
      };
    }
    if (bufferLimit) {
      clientConnection.bufferLimit = bufferLimit;
    }
    if (Object.keys(clientConnection).length > 0) {
      input.clientConnection = clientConnection;
    }

    if (ipDetectionMethod === 'xff') {
      input.clientIPDetection = {
        xForwardedFor: { numTrustedHops: parseInt(xffNumTrustedHops, 10) || 1 },
      };
    } else if (ipDetectionMethod === 'custom' && customHeaderName) {
      input.clientIPDetection = {
        customHeader: { name: customHeaderName, failClosed: customHeaderFailClosed },
      };
    }

    if (requestReceivedTimeout || httpIdleTimeout) {
      input.timeout = {
        http: {
          requestReceivedTimeout: requestReceivedTimeout || undefined,
          idleTimeout: httpIdleTimeout || undefined,
        },
      };
    }

    if (http3Enabled) {
      input.http3 = { enabled: true };
    }

    if (tlsMinVersion || tlsMaxVersion || tlsCiphers) {
      input.tls = {
        minVersion: tlsMinVersion || undefined,
        maxVersion: tlsMaxVersion || undefined,
        ciphers: tlsCiphers ? tlsCiphers.split(',').map(c => c.trim()).filter(Boolean) : undefined,
      };
    }

    if (mtlsEnabled || mtlsSanWhitelist.length > 0 || mtlsHashWhitelist.length > 0) {
      input.mtls = {
        enabled: mtlsEnabled,
        optional: mtlsOptional,
        caCerts: mtlsCACerts.length > 0 ? mtlsCACerts : undefined,
        sanWhitelist: mtlsSanWhitelist.length > 0 ? mtlsSanWhitelist : undefined,
        hashWhitelist: mtlsHashWhitelist.length > 0 ? mtlsHashWhitelist : undefined,
      };
    }

    // Backend Traffic Policy
    const btpConfig = buildBTPConfig();
    if (btpConfig) {
      input.backendTrafficPolicy = btpConfig;
    }

    // Extension Policy
    const extConfig = buildExtensionPolicyConfig();
    if (extConfig) {
      input.extensionPolicy = extConfig;
    }

    return input;
  };

  const buildBTPConfig = (): BackendTrafficPolicyConfig | undefined => {
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

    const timeout = btpTimeoutEnabled ? (() => {
      const t: BTPTimeoutConfig = {};
      if (tcpConnectTimeout) {
        t.tcp = { connectTimeout: tcpConnectTimeout };
      }
      const http: BTPTimeoutConfig['http'] = {};
      if (httpRequestTimeout) http.requestTimeout = httpRequestTimeout;
      if (httpConnectionIdleTimeout) http.connectionIdleTimeout = httpConnectionIdleTimeout;
      if (httpMaxConnectionDuration2) http.maxConnectionDuration = httpMaxConnectionDuration2;
      if (httpMaxStreamDuration) http.maxStreamDuration = httpMaxStreamDuration;
      if (Object.keys(http).length > 0) t.http = http;
      return Object.keys(t).length > 0 ? t : undefined;
    })() : undefined;

    if (!compression && !retry && !loadBalancer && !circuitBreaker && !requestBuffer && responseOverride.length === 0 && !timeout) return undefined;
    return {
      ...(compression && { compression }),
      ...(retry && { retry }),
      ...(loadBalancer && { loadBalancer }),
      ...(circuitBreaker && { circuitBreaker }),
      ...(requestBuffer && { requestBuffer }),
      ...(responseOverride.length > 0 && { responseOverride }),
      ...(timeout && { timeout }),
    };
  };

  const buildExtensionPolicyConfig = (): EnvoyExtensionPolicyConfig | undefined => {
    if (!luaExtension && !wasmExtension && !extProcExtension) return undefined;
    return {
      ...(luaExtension && { lua: luaExtension }),
      ...(wasmExtension && { wasm: wasmExtension }),
      ...(extProcExtension && { extProc: extProcExtension }),
    };
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const input = buildSettingsInput();
      await domainsApi.updateSettings(projectId, domainId, input);
      router.push(`/projects/${projectId}/domains/${domainId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setSettingsError(err.response?.data?.error || 'Failed to update domain settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}/domains/${domainId}`);
  };

  const handleAIReview = async () => {
    setIsLoadingReview(true);
    setReviewError(null);
    try {
      const input = buildSettingsInput();
      const result = await domainsApi.previewSettings(projectId, domainId, {
        ...input,
        includeAIReview: true,
        description: changeDescription || undefined,
      });
      setProposedClientTrafficPolicyYaml(result.proposedClientTrafficPolicyYaml || '');
      setProposedBackendTrafficPolicyYaml(result.proposedBackendTrafficPolicyYaml || '');
      setProposedEnvoyExtensionPolicyYaml(result.proposedEnvoyExtensionPolicyYaml || '');
      if (result.aiReview) {
        setAiReviewResult(result.aiReview as AIReviewResult);
      } else {
        setReviewError('AI review is not available');
      }
    } catch (error: unknown) {
      setReviewError(error instanceof Error ? error.message : 'Failed to get AI review');
    } finally {
      setIsLoadingReview(false);
    }
  };

  const loadPreviewDiff = async () => {
    try {
      const input = buildSettingsInput();
      const result = await domainsApi.previewSettings(projectId, domainId, {
        ...input,
      });
      setProposedClientTrafficPolicyYaml(result.proposedClientTrafficPolicyYaml || '');
      setProposedBackendTrafficPolicyYaml(result.proposedBackendTrafficPolicyYaml || '');
      setProposedEnvoyExtensionPolicyYaml(result.proposedEnvoyExtensionPolicyYaml || '');
    } catch {
      // non-critical
    }
  };

  const getDomainContext = useCallback(async (): Promise<AIChatContext> => {
    try {
      const input = buildSettingsInput();
      const result = await domainsApi.previewSettings(projectId, domainId, input);
      return {
        type: 'domain' as const,
        domain: {
          clientTrafficPolicy: result.proposedClientTrafficPolicyYaml || '',
        },
      };
    } catch {
      return { type: 'domain' };
    }
  }, [buildSettingsInput, projectId, domainId]);

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
    <div className="p-8">
      <Link
        href={`/projects/${projectId}/domains/${domainId}`}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Domain
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{domain?.hostname}</h1>
        {aiEnabled && (
          <Button variant="secondary" onClick={() => setChatPanelOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            AI Help
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="settings" onValueChange={(tab) => {
            if (tab === 'manifests') loadPreviewDiff();
          }}>
            <TabsList>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="manifests">Manifests</TabsTrigger>
            </TabsList>

            {/* Settings Tab */}
            <TabsContent value="settings">
              {settingsError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {settingsError}
                </div>
              )}

              <Accordion type="multiple" defaultValue={['client-settings', 'backend-settings', 'extensions']}>
                {/* Client Settings Group */}
                <AccordionItem value="client-settings">
                  <AccordionTrigger value="client-settings">
                    Client Settings
                  </AccordionTrigger>
                  <AccordionContent value="client-settings">
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">
                        Configure client-facing settings for all routes on this domain. These settings apply at the domain level via ClientTrafficPolicy.
                      </p>

                      <Accordion type="multiple" defaultValue={['connection', 'ipdetection', 'timeouts', 'protocol', 'tls', 'mtls']}>
                        {/* Client Connection Section */}
                        <AccordionItem value="connection">
                          <AccordionTrigger value="connection">
                            Client Connection
                          </AccordionTrigger>
                          <AccordionContent value="connection">
                            <div className="space-y-4">
                              {/* TCP Keepalive */}
                              <div className="p-3 rounded-lg">
                                <div className="flex items-center gap-3 mb-3">
                                  <input
                                    type="checkbox"
                                    id="tcpKeepaliveEnabled"
                                    checked={tcpKeepaliveEnabled}
                                    onChange={(e) => setTcpKeepaliveEnabled(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                                  />
                                  <label htmlFor="tcpKeepaliveEnabled" className="text-sm font-medium text-gray-700">
                                    TCP Keepalive
                                  </label>
                                </div>
                                {tcpKeepaliveEnabled && (
                                  <div className="ml-7 grid grid-cols-3 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Probes <InfoTooltip text="Number of unacknowledged keepalive probes before the connection is dropped." example="3" /></label>
                                      <input type="number" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="3" value={tcpProbes} onChange={(e) => setTcpProbes(e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Idle Time <InfoTooltip text="Time a connection must be idle before keepalive probes begin." example="60s" /></label>
                                      <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="60s" value={tcpIdleTime} onChange={(e) => setTcpIdleTime(e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Interval <InfoTooltip text="Time between consecutive keepalive probes." example="10s" /></label>
                                      <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="10s" value={tcpInterval} onChange={(e) => setTcpInterval(e.target.value)} />
                                    </div>
                                  </div>
                                )}
                              </div>
        
                              {/* PROXY Protocol */}
                              <div className="p-3 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <input type="checkbox" id="proxyProtocolEnabled" checked={proxyProtocolEnabled} onChange={(e) => setProxyProtocolEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                                  <label htmlFor="proxyProtocolEnabled" className="text-sm font-medium text-gray-700">PROXY Protocol</label>
                                  <InfoTooltip text="Preserves original client IP when traffic passes through load balancers supporting PROXY protocol." />
                                </div>
                                {proxyProtocolEnabled && (
                                  <div className="ml-7 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <p className="text-xs text-amber-700">Only enable if your upstream load balancer sends PROXY protocol headers.</p>
                                    </div>
                                  </div>
                                )}
                              </div>
        
                              {/* Connection Limits */}
                              <div className="p-3 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Connection Limits</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Connections</label>
                                    <input type="number" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="10000" value={maxConnections} onChange={(e) => setMaxConnections(e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Close Delay <InfoTooltip text="Grace period before forcibly closing connections when the connection limit is reached. Allows in-flight requests to complete." /></label>
                                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="5s" value={closeDelay} onChange={(e) => setCloseDelay(e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Connection Duration</label>
                                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="1h" value={maxConnectionDuration} onChange={(e) => setMaxConnectionDuration(e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Requests/Connection</label>
                                    <input type="number" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="1000" value={maxRequestsPerConnection} onChange={(e) => setMaxRequestsPerConnection(e.target.value)} />
                                  </div>
                                </div>
                                <div className="mt-4">
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Buffer Limit <InfoTooltip text="Maximum buffer size per connection. Uses Kubernetes quantity format." example="32Ki, 1Mi, 512Ki" /></label>
                                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="32Ki" value={bufferLimit} onChange={(e) => setBufferLimit(e.target.value)} />
                                  <p className="mt-1 text-xs text-gray-500">Maximum buffer size per connection (e.g., 32Ki, 1Mi)</p>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
        
                        {/* Client IP Detection Section */}
                        <AccordionItem value="ipdetection">
                          <AccordionTrigger value="ipdetection">
                            Client IP Detection
                          </AccordionTrigger>
                          <AccordionContent value="ipdetection">
                            <div className="p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-4">
                                Configure how to detect client IP when behind load balancers or CDNs. Used for IP allowlisting.
                              </p>
        
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">Detection Method <InfoTooltip text="How the gateway determines the real client IP. Choose based on your network topology: L4 source IP for direct connections, XFF header when behind reverse proxies." /></label>
                                  <select
                                    value={ipDetectionMethod}
                                    onChange={(e) => setIpDetectionMethod(e.target.value as 'none' | 'xff' | 'custom')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  >
                                    <option value="none">None (use L4 source IP)</option>
                                    <option value="xff">X-Forwarded-For header</option>
                                    <option value="custom">Custom header</option>
                                  </select>
                                </div>
        
                                {ipDetectionMethod === 'xff' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Number of Trusted Hops <InfoTooltip text="Number of reverse proxies between the client and the gateway. Wrong values cause incorrect client IP detection." example="1 for a single load balancer" />
                                    </label>
                                    <p className="text-xs text-gray-500 mb-2">
                                      How many proxy hops to trust in the X-Forwarded-For chain (1-10)
                                    </p>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={10}
                                      value={xffNumTrustedHops}
                                      onChange={(e) => setXffNumTrustedHops(e.target.value)}
                                      className="w-32"
                                    />
                                  </div>
                                )}
        
                                {ipDetectionMethod === 'custom' && (
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Header Name
                                      </label>
                                      <p className="text-xs text-gray-500 mb-2">
                                        Name of the header containing the client IP (e.g., CF-Connecting-IP, True-Client-IP)
                                      </p>
                                      <Input
                                        type="text"
                                        value={customHeaderName}
                                        onChange={(e) => setCustomHeaderName(e.target.value)}
                                        placeholder="CF-Connecting-IP"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        id="failClosed"
                                        checked={customHeaderFailClosed}
                                        onChange={(e) => setCustomHeaderFailClosed(e.target.checked)}
                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                      />
                                      <label htmlFor="failClosed" className="text-sm text-gray-700">
                                        Fail closed (reject requests if header is missing)
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
        
                        {/* Client Timeout Section */}
                        <AccordionItem value="timeouts">
                          <AccordionTrigger value="timeouts">
                            Client Timeout
                          </AccordionTrigger>
                          <AccordionContent value="timeouts">
                            <div className="p-3 rounded-lg">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Request Received Timeout</label>
                                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="30s" value={requestReceivedTimeout} onChange={(e) => setRequestReceivedTimeout(e.target.value)} />
                                  <p className="mt-1 text-xs text-gray-500">Time to receive complete request headers</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">HTTP Idle Timeout</label>
                                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="60s" value={httpIdleTimeout} onChange={(e) => setHttpIdleTimeout(e.target.value)} />
                                  <p className="mt-1 text-xs text-gray-500">Idle connection timeout</p>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
        
                        {/* Protocol Section */}
                        <AccordionItem value="protocol">
                          <AccordionTrigger value="protocol">
                            Protocol
                          </AccordionTrigger>
                          <AccordionContent value="protocol">
                            <div className="p-3 rounded-lg">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" id="http3Enabled" checked={http3Enabled} onChange={(e) => setHttp3Enabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                                <label htmlFor="http3Enabled" className="text-sm font-medium text-gray-700">Enable HTTP/3 (QUIC)</label>
                              </div>
                              {http3Enabled && (
                                <div className="ml-7 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700">HTTP/3 requires UDP listeners and QUIC-capable clients. Ensure your infrastructure supports this.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
        
                        {/* TLS Settings Section */}
                        <AccordionItem value="tls">
                          <AccordionTrigger value="tls">
                            TLS Settings
                          </AccordionTrigger>
                          <AccordionContent value="tls">
                            <div className="space-y-4">
                              <div className="p-3 rounded-lg">
                                <label className="block text-xs font-medium text-gray-600 mb-2">Security Profile</label>
                                <div className="space-y-2">
                                  {(Object.keys(TLS_PROFILES) as TLSProfile[]).map((profile) => (
                                    <label key={profile} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${tlsProfile === profile ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-100'}`}>
                                      <input type="radio" name="tlsProfile" checked={tlsProfile === profile} onChange={() => handleTLSProfileChange(profile)} className="mt-0.5" />
                                      <div>
                                        <div className="text-sm font-medium text-gray-900">{TLS_PROFILES[profile].label}</div>
                                        <div className="text-xs text-gray-500">{TLS_PROFILES[profile].description}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
        
                              {(tlsProfile === 'compatible') && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700">TLS 1.0 and 1.1 are deprecated and have known security vulnerabilities. Use only if required for legacy client compatibility.</p>
                                  </div>
                                </div>
                              )}
        
                              {tlsProfile === 'custom' && (
                                <div className="p-3 rounded-lg space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Min TLS Version</label>
                                      <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" value={tlsMinVersion} onChange={(e) => setTlsMinVersion(e.target.value)}>
                                        <option value="">Auto</option>
                                        <option value="TLS1.0">TLS 1.0</option>
                                        <option value="TLS1.1">TLS 1.1</option>
                                        <option value="TLS1.2">TLS 1.2</option>
                                        <option value="TLS1.3">TLS 1.3</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Max TLS Version</label>
                                      <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" value={tlsMaxVersion} onChange={(e) => setTlsMaxVersion(e.target.value)}>
                                        <option value="">Auto</option>
                                        <option value="TLS1.0">TLS 1.0</option>
                                        <option value="TLS1.1">TLS 1.1</option>
                                        <option value="TLS1.2">TLS 1.2</option>
                                        <option value="TLS1.3">TLS 1.3</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Cipher Suites (comma-separated) <InfoTooltip text="TLS cipher suites to allow. Leave empty to use defaults for the selected TLS version." example="TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256" /></label>
                                    <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" rows={3} placeholder="TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, ..." value={tlsCiphers} onChange={(e) => setTlsCiphers(e.target.value)} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
        
                        {/* mTLS (Mutual TLS) */}
                        <AccordionItem value="mtls">
                          <AccordionTrigger value="mtls">
                            <div className="flex items-center gap-2">
                              <Shield size={16} />
                              <span>Mutual TLS (Client Certificates)</span>
                              {mtlsEnabled && <Badge variant="success" className="ml-2">Enabled</Badge>}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent value="mtls">
                            <div className="space-y-4">
                              {/* Enable mTLS */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <label className="font-medium text-sm">Enable mTLS</label>
                                  <p className="text-xs text-gray-500">Require client certificates for authentication</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={mtlsEnabled} onChange={(e) => setMtlsEnabled(e.target.checked)} />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                </label>
                              </div>
        
                              {mtlsEnabled && (
                                <div className="space-y-4 border-t pt-4">
                                  {/* Certificate Validation Mode */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Certificate Validation Mode</label>
                                    <div className="flex gap-4">
                                      <label className="flex items-center gap-2">
                                        <input type="radio" name="mtlsMode" checked={mtlsOptional} onChange={() => setMtlsOptional(true)} className="w-4 h-4 text-primary-600" />
                                        <span className="text-sm">Optional</span>
                                      </label>
                                      <label className="flex items-center gap-2">
                                        <input type="radio" name="mtlsMode" checked={!mtlsOptional} onChange={() => setMtlsOptional(false)} className="w-4 h-4 text-primary-600" />
                                        <span className="text-sm">Required</span>
                                      </label>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {mtlsOptional ? 'Clients may optionally present certificates' : 'All clients must present valid certificates'}
                                    </p>
                                  </div>
        
                                  {/* CA Certificates */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2">CA Certificates</label>
                                    {mtlsCACerts.length > 0 ? (
                                      <div className="space-y-2 mb-3">
                                        {mtlsCACerts.map((ca) => (
                                          <div key={ca.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                            <div>
                                              <span className="font-medium text-sm">{ca.name}</span>
                                              <span className="text-xs text-gray-500 ml-2">({ca.secretName})</span>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveCA(ca.id)}>
                                              <Trash2 size={14} className="text-red-500" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 mb-3">No CA certificates configured</p>
                                    )}
        
                                    {/* Add CA Form */}
                                    <div className="space-y-2 p-3 border border-dashed rounded">
                                      <Input placeholder="CA Name (e.g., 'Internal CA')" value={newCAName} onChange={(e) => setNewCAName(e.target.value)} />
                                      <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono" rows={4} placeholder="Paste CA certificate PEM here..." value={newCAPem} onChange={(e) => setNewCAPem(e.target.value)} />
                                      {caError && <p className="text-sm text-red-500">{caError}</p>}
                                      <Button variant="secondary" size="sm" onClick={handleAddCA} disabled={isAddingCA || !newCAName.trim() || !newCAPem.trim()}>
                                        <Upload size={14} className="mr-1" />
                                        {isAddingCA ? 'Adding...' : 'Add CA Certificate'}
                                      </Button>
                                    </div>
                                  </div>
        
                                  {/* SAN Whitelist (General Mode) */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2">SAN Whitelist (General Mode) <InfoTooltip text="Subject Alternative Name — identifiers in client certificates. DNS type for hostnames, URI type for service identities." example="client.example.com or spiffe://cluster/service" /></label>
                                    <p className="text-xs text-gray-500 mb-2">Allow certificates matching these Subject Alternative Names</p>
                                    {mtlsSanWhitelist.length > 0 && (
                                      <div className="space-y-1 mb-2">
                                        {mtlsSanWhitelist.map((san, index) => (
                                          <div key={index} className="flex items-center gap-2 text-sm">
                                            <Badge variant="info">{san.type}</Badge>
                                            <span className="flex-1 font-mono text-xs">{san.value}</span>
                                            <button onClick={() => handleRemoveSAN(index)} className="text-red-500 hover:text-red-700">
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <select className="px-2 py-1 border rounded text-sm" value={newSanType} onChange={(e) => setNewSanType(e.target.value as 'DNS' | 'URI')}>
                                        <option value="DNS">DNS</option>
                                        <option value="URI">URI</option>
                                      </select>
                                      <Input className="flex-1" placeholder="e.g., client.example.com" value={newSanValue} onChange={(e) => setNewSanValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSAN()} />
                                      <Button variant="secondary" size="sm" onClick={handleAddSAN} disabled={!newSanValue.trim()}>
                                        <Plus size={14} />
                                      </Button>
                                    </div>
                                    {sanError && <p className="text-sm text-red-500 mt-1">{sanError}</p>}
                                  </div>
        
                                  {/* Hash Whitelist (General Mode) */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Certificate Hash Whitelist (General Mode) <InfoTooltip text="SHA256 fingerprint of allowed client certificates." example="openssl x509 -in cert.pem -noout -fingerprint -sha256" /></label>
                                    <p className="text-xs text-gray-500 mb-2">Allow certificates matching these SHA256 hashes</p>
                                    {mtlsHashWhitelist.length > 0 && (
                                      <div className="space-y-1 mb-2">
                                        {mtlsHashWhitelist.map((hash, index) => (
                                          <div key={index} className="flex items-center gap-2 text-sm">
                                            <span className="flex-1 font-mono text-xs truncate">{hash}</span>
                                            <button onClick={() => handleRemoveHash(index)} className="text-red-500 hover:text-red-700">
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <Input className="flex-1 font-mono text-xs" placeholder="64-character SHA256 hash" value={newHash} onChange={(e) => setNewHash(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddHash()} />
                                      <Button variant="secondary" size="sm" onClick={handleAddHash} disabled={!newHash.trim()}>
                                        <Plus size={14} />
                                      </Button>
                                    </div>
                                    {hashError && <p className="text-sm text-red-500 mt-1">{hashError}</p>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Backend Settings Group */}
                <AccordionItem value="backend-settings">
                  <AccordionTrigger value="backend-settings">
                    Backend Settings
                  </AccordionTrigger>
                  <AccordionContent value="backend-settings">
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">
                        Configure backend traffic policies for all routes on this domain. These settings apply at the domain level via BackendTrafficPolicy.
                      </p>

                      <Accordion type="multiple" defaultValue={[]}>
                        {/* Compression */}
                        <AccordionItem value="btp-compression">
                          <AccordionTrigger
                            value="btp-compression"
                            badge={
                              compressionEnabled && compressionTypes.length > 0 && (
                                <Badge variant="success">{compressionTypes.length} type{compressionTypes.length > 1 ? 's' : ''}</Badge>
                              )
                            }
                          >
                            Response Compression
                          </AccordionTrigger>
                          <AccordionContent value="btp-compression">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id="domainCompressionEnabled"
                                  checked={compressionEnabled}
                                  onChange={(e) => {
                                    setCompressionEnabled(e.target.checked);
                                    if (!e.target.checked) {
                                      setCompressionTypes([]);
                                    }
                                  }}
                                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                />
                                <label htmlFor="domainCompressionEnabled" className="text-sm font-medium text-gray-700">
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

                        {/* Retry */}
                        <AccordionItem value="btp-retry">
                          <AccordionTrigger
                            value="btp-retry"
                            badge={retryEnabled && <Badge variant="success">Enabled</Badge>}
                          >
                            Retry Policy
                          </AccordionTrigger>
                          <AccordionContent value="btp-retry">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id="domainRetryEnabled"
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
                                <label htmlFor="domainRetryEnabled" className="text-sm font-medium text-gray-700">
                                  Enable Retry
                                </label>
                              </div>
                              <p className="text-sm text-gray-500">
                                Automatically retry failed requests to backend services.
                              </p>

                              {retryEnabled && (
                                <div className="space-y-6 pt-4 border-t">
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
                                  </div>

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
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Load Balancing */}
                        <AccordionItem value="btp-load-balancing">
                          <AccordionTrigger
                            value="btp-load-balancing"
                            badge={lbEnabled && <Badge variant="success">{lbType === 'ConsistentHash' ? `ConsistentHash (${lbConsistentHashType})` : lbType}</Badge>}
                          >
                            Load Balancing
                          </AccordionTrigger>
                          <AccordionContent value="btp-load-balancing">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id="domain-lb-enabled"
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
                                <label htmlFor="domain-lb-enabled" className="text-sm font-medium text-gray-700">
                                  Enable Load Balancing
                                </label>
                              </div>
                              <p className="text-sm text-gray-500 italic">
                                Configure how traffic is distributed across backend endpoints.
                              </p>

                              {lbEnabled && (
                                <div className="space-y-6 pt-4 border-t">
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
                                            name="domain-lb-type"
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
                                              name="domain-lb-hash-type"
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
                                        </div>
                                      )}

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
                                          </div>
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

                        {/* Circuit Breaker */}
                        <AccordionItem value="btp-circuit-breaker">
                          <AccordionTrigger
                            value="btp-circuit-breaker"
                            badge={cbEnabled && <Badge variant="success">Enabled</Badge>}
                          >
                            Circuit Breaker
                          </AccordionTrigger>
                          <AccordionContent value="btp-circuit-breaker">
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

                        {/* Backend Timeout */}
                        <AccordionItem value="btp-timeouts">
                          <AccordionTrigger
                            value="btp-timeouts"
                            badge={
                              btpTimeoutEnabled && (tcpConnectTimeout || httpRequestTimeout || httpConnectionIdleTimeout || httpMaxConnectionDuration2 || httpMaxStreamDuration) ? (
                                <Badge variant="success">Configured</Badge>
                              ) : undefined
                            }
                          >
                            Backend Timeout
                          </AccordionTrigger>
                          <AccordionContent value="btp-timeouts">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id="domainBtpTimeoutEnabled"
                                  checked={btpTimeoutEnabled}
                                  onChange={(e) => {
                                    setBtpTimeoutEnabled(e.target.checked);
                                    if (!e.target.checked) {
                                      setTcpConnectTimeout('');
                                      setHttpRequestTimeout('');
                                      setHttpConnectionIdleTimeout('');
                                      setHttpMaxConnectionDuration2('');
                                      setHttpMaxStreamDuration('');
                                    }
                                  }}
                                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                                />
                                <label htmlFor="domainBtpTimeoutEnabled" className="text-sm font-medium text-gray-700">
                                  Enable Timeout
                                </label>
                              </div>

                              <p className="text-xs text-gray-500">
                                Configure timeout durations for connections and requests.
                              </p>

                              {btpTimeoutEnabled && (
                                <div className="space-y-6 pt-4 border-t">
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
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3">HTTP</h4>
                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Request Timeout <InfoTooltip text="Total time for the gateway to process the request and return a response." />
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
                                          Connection Idle Timeout <InfoTooltip text="Time a connection can be idle before being closed." />
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
                                          Max Connection Duration <InfoTooltip text="Maximum lifetime of a connection regardless of activity." />
                                        </label>
                                        <input
                                          type="text"
                                          value={httpMaxConnectionDuration2}
                                          onChange={(e) => setHttpMaxConnectionDuration2(e.target.value)}
                                          placeholder="e.g. 0s (unlimited)"
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Max Stream Duration <InfoTooltip text="Maximum duration for a single HTTP/2 or gRPC stream." />
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

                        {/* Request Buffer */}
                        <AccordionItem value="btp-request-buffer">
                          <AccordionTrigger
                            value="btp-request-buffer"
                            badge={requestBuffer && (
                              <Badge variant="success">{requestBuffer.limit}</Badge>
                            )}
                          >
                            Request Buffering
                          </AccordionTrigger>
                          <AccordionContent value="btp-request-buffer">
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

                        {/* Response Override */}
                        <AccordionItem value="btp-response-override">
                          <AccordionTrigger
                            value="btp-response-override"
                            badge={responseOverride.length > 0 && (
                              <Badge variant="success">{responseOverride.length} rule{responseOverride.length > 1 ? 's' : ''}</Badge>
                            )}
                          >
                            Response Override
                          </AccordionTrigger>
                          <AccordionContent value="btp-response-override">
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
                      </Accordion>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Extensions Section */}
                <AccordionItem value="extensions">
                  <AccordionTrigger value="extensions">
                    Extensions
                  </AccordionTrigger>
                  <AccordionContent value="extensions">
                    <div className="space-y-4">
                      <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                        <h4 className="text-sm font-medium text-primary-800 mb-1">Envoy Extensions</h4>
                        <p className="text-xs text-primary-600">
                          Add custom Lua scripts, WebAssembly (Wasm) modules, or external processing (ext-proc) services to extend Envoy&apos;s request/response processing at the domain level.
                        </p>
                      </div>

                      <Accordion type="multiple" defaultValue={[]}>
                        {/* Lua Extension */}
                        <AccordionItem value="ext-lua">
                          <AccordionTrigger
                            value="ext-lua"
                            badge={luaExtension && (
                              <Badge variant="success">
                                {luaExtension.type === 'Inline' ? 'Inline' : 'ConfigMap'}
                              </Badge>
                            )}
                          >
                            Lua Extension
                          </AccordionTrigger>
                          <AccordionContent value="ext-lua">
                            <div className="space-y-4">
                              <LuaExtensionForm
                                value={luaExtension}
                                onChange={setLuaExtension}
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Wasm Extension */}
                        <AccordionItem value="ext-wasm">
                          <AccordionTrigger
                            value="ext-wasm"
                            badge={wasmExtension && (
                              <Badge variant="success">{wasmExtension.name}</Badge>
                            )}
                          >
                            Wasm Extension
                          </AccordionTrigger>
                          <AccordionContent value="ext-wasm">
                            <div className="space-y-4">
                              <WasmExtensionForm
                                value={wasmExtension}
                                onChange={setWasmExtension}
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Ext-Proc Extension */}
                        <AccordionItem value="ext-extproc">
                          <AccordionTrigger
                            value="ext-extproc"
                            badge={extProcExtension && (
                              <Badge variant="success">{extProcExtension.backendRef.name || 'ext-proc'}</Badge>
                            )}
                          >
                            External Processing (ext-proc)
                          </AccordionTrigger>
                          <AccordionContent value="ext-extproc">
                            <div className="space-y-4">
                              <ExtProcExtensionForm
                                value={extProcExtension}
                                onChange={setExtProcExtension}
                                disabled={isSavingSettings}
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Save/Cancel buttons */}
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                <Button variant="secondary" onClick={handleCancel} disabled={isSavingSettings}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </TabsContent>

            {/* Manifests Tab */}
            <TabsContent value="manifests">
              {/* CTP Section */}
              {proposedClientTrafficPolicyYaml ? (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">ClientTrafficPolicy (Proposed Changes)</h3>
                  <YamlDiffViewer
                    currentYaml={clientTrafficPolicyYaml}
                    proposedYaml={proposedClientTrafficPolicyYaml}
                    mode="update"
                  />
                </div>
              ) : clientTrafficPolicyYaml ? (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">ClientTrafficPolicy</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {clientTrafficPolicyYaml}
                  </pre>
                </div>
              ) : null}

              {/* BTP Section */}
              {proposedBackendTrafficPolicyYaml ? (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">BackendTrafficPolicy (Proposed Changes)</h3>
                  <YamlDiffViewer
                    currentYaml={backendTrafficPolicyYaml}
                    proposedYaml={proposedBackendTrafficPolicyYaml}
                    mode="update"
                  />
                </div>
              ) : backendTrafficPolicyYaml ? (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">BackendTrafficPolicy</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {backendTrafficPolicyYaml}
                  </pre>
                </div>
              ) : null}

              {/* EnvoyExtensionPolicy Section */}
              {proposedEnvoyExtensionPolicyYaml ? (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">EnvoyExtensionPolicy (Proposed Changes)</h3>
                  <YamlDiffViewer
                    currentYaml={envoyExtensionPolicyYaml}
                    proposedYaml={proposedEnvoyExtensionPolicyYaml}
                    mode="update"
                  />
                </div>
              ) : envoyExtensionPolicyYaml ? (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">EnvoyExtensionPolicy</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {envoyExtensionPolicyYaml}
                  </pre>
                </div>
              ) : null}

              {/* Gateway Section (always static) */}
              {gatewayYaml && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Gateway</h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    {gatewayYaml}
                  </pre>
                </div>
              )}

              {/* AI Review Section */}
              {aiEnabled && (
                <div className="space-y-4 border-t pt-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Describe your changes (optional)
                    </label>
                    <textarea
                      value={changeDescription}
                      onChange={(e) => setChangeDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="e.g., Enabling TCP keepalive for better connection stability..."
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleAIReview}
                    disabled={isLoadingReview}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isLoadingReview ? 'Reviewing...' : 'Review with AI'}
                  </Button>
                  {reviewError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {reviewError}
                    </div>
                  )}
                  {aiReviewResult && <AIReviewCard review={aiReviewResult} />}
                </div>
              )}

              {!gatewayYaml && !clientTrafficPolicyYaml && !proposedClientTrafficPolicyYaml && !backendTrafficPolicyYaml && !proposedBackendTrafficPolicyYaml && !envoyExtensionPolicyYaml && !proposedEnvoyExtensionPolicyYaml && (
                <div className="text-center py-8 text-gray-500">
                  <p>No manifests available. Domain may not be fully deployed yet.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AIChatPanel
        isOpen={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        getContext={getDomainContext}
      />
    </div>
  );
}
