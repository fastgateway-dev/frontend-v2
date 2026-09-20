'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientsApi } from '@/lib/api/clients';
import { clientAttachmentsApi } from '@/lib/api/client-attachments';
import { projectsApi } from '@/lib/api/projects';
import { domainsApi } from '@/lib/api/domains';
import { routesApi } from '@/lib/api/routes';
import { Client, ClientIPAddress, ClientHeader, CreateClientHeaderInput, ClientRouteAttachment, AttachmentStatus, Project, Domain, Route as RouteType, GenerateAPIKeyResponse, ConfigureJWTInput, JWTRequiredClaim, RateLimitConfig, ProjectCapabilities, MTLSSANEntry, ManagedCertificate } from '@/types';
import RateLimitForm from '@/components/RateLimitForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { InfoTooltip } from '@/components/ui';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Network,
  Mail,
  User,
  Users,
  Route,
  Unlink,
  Key,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Shield,
  Upload,
  X,
  FileText,
} from 'lucide-react';

function getStatusBadge(status: AttachmentStatus) {
  const variants: Record<AttachmentStatus, { variant: 'default' | 'info' | 'success' | 'warning' | 'error'; label: string }> = {
    pending_attach: { variant: 'warning', label: 'Pending Attach' },
    pending_update: { variant: 'warning', label: 'Pending Update' },
    pending_detach: { variant: 'warning', label: 'Pending Detach' },
    approved: { variant: 'info', label: 'Approved' },
    active: { variant: 'success', label: 'Active' },
    removed: { variant: 'default', label: 'Removed' },
    rejected: { variant: 'error', label: 'Rejected' },
  };
  const config = variants[status] || { variant: 'default' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [ips, setIps] = useState<ClientIPAddress[]>([]);
  const [attachments, setAttachments] = useState<ClientRouteAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ips' | 'headers' | 'apikey' | 'jwt' | 'mtls' | 'routes'>('ips');

  // API Key modals
  const [showGenerateAPIKeyModal, setShowGenerateAPIKeyModal] = useState(false);
  const [showRevokeAPIKeyModal, setShowRevokeAPIKeyModal] = useState(false);
  const [showAPIKeyResultModal, setShowAPIKeyResultModal] = useState(false);
  const [generatedAPIKey, setGeneratedAPIKey] = useState<GenerateAPIKeyResponse | null>(null);
  const [apiKeyHeaderName, setApiKeyHeaderName] = useState('x-api-key');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // JWT modals
  const [showConfigureJWTModal, setShowConfigureJWTModal] = useState(false);
  const [showRemoveJWTModal, setShowRemoveJWTModal] = useState(false);
  const [jwtFormData, setJwtFormData] = useState<ConfigureJWTInput>({
    issuer: '',
    jwksUrl: '',
    audiences: [],
    requiredClaims: [],
  });
  const [jwtAudiencesInput, setJwtAudiencesInput] = useState('');
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [isEditingJWT, setIsEditingJWT] = useState(false);

  // mTLS modals and state
  const [showConfigureMTLSModal, setShowConfigureMTLSModal] = useState(false);
  const [showRemoveMTLSModal, setShowRemoveMTLSModal] = useState(false);
  const [mtlsFormData, setMtlsFormData] = useState({
    caName: '',
    caPem: '',
    sans: [] as MTLSSANEntry[],
    hashes: [] as string[],
  });
  const [newMtlsSanType, setNewMtlsSanType] = useState<'DNS' | 'URI'>('DNS');
  const [newMtlsSanValue, setNewMtlsSanValue] = useState('');
  const [newMtlsHash, setNewMtlsHash] = useState('');
  const [mtlsError, setMtlsError] = useState<string | null>(null);
  const [isEditingMTLS, setIsEditingMTLS] = useState(false);

  // Managed certificate attach/detach state
  const [attachableCertificates, setAttachableCertificates] = useState<ManagedCertificate[]>([]);
  const [loadingAttachableCertificates, setLoadingAttachableCertificates] = useState(false);
  const [selectedCertificateId, setSelectedCertificateId] = useState('');
  const [certAttachError, setCertAttachError] = useState<string | null>(null);
  const [attachingCertificate, setAttachingCertificate] = useState(false);
  const [detachingCertificate, setDetachingCertificate] = useState(false);
  // Name of the managed certificate the user just attached — kept locally since the
  // list of attachable certificates no longer contains it once attached, and resolving
  // it on a cold load would require a cross-project lookup (id is shown instead).
  const [attachedCertificateName, setAttachedCertificateName] = useState<string | null>(null);

  // IP modals
  const [showAddIPModal, setShowAddIPModal] = useState(false);
  const [showDeleteIPModal, setShowDeleteIPModal] = useState(false);
  const [selectedIP, setSelectedIP] = useState<ClientIPAddress | null>(null);
  const [ipFormData, setIpFormData] = useState({ cidr: '', description: '' });
  const [ipFormError, setIpFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Header modals
  const [headers, setHeaders] = useState<ClientHeader[]>([]);
  const [showAddHeaderModal, setShowAddHeaderModal] = useState(false);
  const [showDeleteHeaderModal, setShowDeleteHeaderModal] = useState(false);
  const [selectedHeader, setSelectedHeader] = useState<ClientHeader | null>(null);
  const [headerFormData, setHeaderFormData] = useState({ name: '', values: [] as string[], valueInput: '', description: '' });
  const [headerFormError, setHeaderFormError] = useState<string | null>(null);
  const [submittingHeader, setSubmittingHeader] = useState(false);

  // Attach modal
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachFormData, setAttachFormData] = useState({
    routeId: '',
    projectId: '',
    domainId: '',
    enableIpAllowlist: true,
    enableApiKey: false,
    enableJwt: false,
    enableBasicAuth: false,
    enableMtls: false,
    enableHeaderAuth: false,
  });
  const [attachRateLimitConfig, setAttachRateLimitConfig] = useState<RateLimitConfig | undefined>(undefined);
  const [attachFormError, setAttachFormError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [capabilities, setCapabilities] = useState<ProjectCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState(false);

  // Allowed methods state
  const [savingMethods, setSavingMethods] = useState(false);
  const [methodsError, setMethodsError] = useState<string | null>(null);

  // Delete client modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientData, ipsData, headersData] = await Promise.all([
        clientsApi.get(clientId),
        clientsApi.listIPs(clientId),
        clientsApi.listHeaders(clientId),
      ]);
      setClient(clientData);
      setIps(ipsData || []);
      setHeaders(headersData || []);

      // Fetch attachments (may fail if user doesn't have access)
      try {
        const attachmentsData = await clientAttachmentsApi.listClientRoutes(clientId);
        setAttachments(attachmentsData || []);
      } catch {
        // User may not have access to see attachments
        setAttachments([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  const handleAddIP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIpFormError(null);
    setSubmitting(true);

    try {
      await clientsApi.addIP(clientId, {
        cidr: ipFormData.cidr,
        description: ipFormData.description || undefined,
      });
      setShowAddIPModal(false);
      setIpFormData({ cidr: '', description: '' });
      fetchData();
    } catch (err: any) {
      setIpFormError(err.response?.data?.error || 'Failed to add IP address');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveIP = async () => {
    if (!selectedIP) return;
    setSubmitting(true);

    try {
      await clientsApi.removeIP(clientId, selectedIP.id);
      setShowDeleteIPModal(false);
      setSelectedIP(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove IP address');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddHeaderValue = () => {
    const v = headerFormData.valueInput.trim();
    if (v && !headerFormData.values.includes(v)) {
      setHeaderFormData({ ...headerFormData, values: [...headerFormData.values, v], valueInput: '' });
    }
  };

  const handleRemoveHeaderValue = (value: string) => {
    setHeaderFormData({ ...headerFormData, values: headerFormData.values.filter(v => v !== value) });
  };

  const handleAddHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeaderFormError(null);

    if (!headerFormData.name.trim()) {
      setHeaderFormError('Header name is required');
      return;
    }
    if (headerFormData.values.length === 0) {
      setHeaderFormError('At least one allowed value is required');
      return;
    }

    setSubmittingHeader(true);

    try {
      await clientsApi.addHeader(clientId, {
        name: headerFormData.name.trim(),
        values: headerFormData.values,
        description: headerFormData.description || undefined,
      });
      setShowAddHeaderModal(false);
      setHeaderFormData({ name: '', values: [], valueInput: '', description: '' });
      fetchData();
    } catch (err: any) {
      setHeaderFormError(err.response?.data?.error || 'Failed to add header');
    } finally {
      setSubmittingHeader(false);
    }
  };

  const handleDeleteHeader = async () => {
    if (!selectedHeader) return;
    setSubmittingHeader(true);

    try {
      await clientsApi.removeHeader(clientId, selectedHeader.id);
      setShowDeleteHeaderModal(false);
      setSelectedHeader(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove header');
    } finally {
      setSubmittingHeader(false);
    }
  };

  const handleToggleMethod = async (method: string) => {
    if (!client) return;
    setMethodsError(null);
    setSavingMethods(true);

    const currentMethods = client.allowedMethods || [];
    const newMethods = currentMethods.includes(method)
      ? currentMethods.filter(m => m !== method)
      : [...currentMethods, method];

    try {
      await clientsApi.setAllowedMethods(clientId, newMethods);
      fetchData();
    } catch (err: any) {
      setMethodsError(err.response?.data?.error || 'Failed to update allowed methods');
    } finally {
      setSavingMethods(false);
    }
  };

  const handleAttach = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttachFormError(null);
    setSubmitting(true);

    try {
      await clientAttachmentsApi.attachFromClient(clientId, {
        routeId: attachFormData.routeId,
        projectId: attachFormData.projectId,
        enableIpAllowlist: attachFormData.enableIpAllowlist,
        enableApiKey: attachFormData.enableApiKey,
        enableJwt: attachFormData.enableJwt,
        enableBasicAuth: attachFormData.enableBasicAuth,
        enableMtls: attachFormData.enableMtls,
        enableHeaderAuth: attachFormData.enableHeaderAuth,
        rateLimitConfig: attachRateLimitConfig,
      });
      setShowAttachModal(false);
      setAttachFormData({
        routeId: '',
        projectId: '',
        domainId: '',
        enableIpAllowlist: true,
        enableApiKey: false,
        enableJwt: false,
        enableBasicAuth: false,
        enableMtls: false,
        enableHeaderAuth: false,
      });
      setAttachRateLimitConfig(undefined);
      fetchData();
    } catch (err: any) {
      setAttachFormError(err.response?.data?.error || 'Failed to attach to route');
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch capabilities when project is selected
  useEffect(() => {
    if (attachFormData.projectId) {
      setCapabilities(null);
      setCapabilitiesError(false);
      projectsApi.getCapabilities(attachFormData.projectId)
        .then(setCapabilities)
        .catch(() => setCapabilitiesError(true));
    } else {
      setCapabilities(null);
    }
  }, [attachFormData.projectId]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const data = await projectsApi.list(1, 100);
      setProjects(data.data);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadDomains = async (projectId: string) => {
    setLoadingDomains(true);
    setDomains([]);
    setRoutes([]);
    setAttachFormData((prev) => ({ ...prev, domainId: '', routeId: '' }));
    try {
      const data = await domainsApi.list(projectId, 1, 100);
      setDomains(data.data);
    } catch {
      setDomains([]);
    } finally {
      setLoadingDomains(false);
    }
  };

  const loadRoutes = async (projectId: string, domainId: string) => {
    setLoadingRoutes(true);
    setRoutes([]);
    setAttachFormData((prev) => ({ ...prev, routeId: '' }));
    try {
      const data = await routesApi.list(projectId, domainId, 1, 100);
      setRoutes(data.data);
    } catch {
      setRoutes([]);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const openAttachModal = () => {
    // Set initial checkbox state based on client capabilities
    setAttachFormData(prev => ({
      ...prev,
      enableIpAllowlist: client?.ipAddressCount ? true : false,
      enableApiKey: client?.apiKeyEnabled ? true : false,
      enableJwt: client?.jwtEnabled ? true : false,
    }));
    setShowAttachModal(true);
    loadProjects();
  };

  const handleDeleteClient = async () => {
    setSubmitting(true);
    try {
      await clientsApi.delete(clientId);
      router.push('/clients');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiKeyError(null);
    setSubmitting(true);

    try {
      const response = await clientsApi.generateAPIKey(clientId, {
        headerName: apiKeyHeaderName || 'x-api-key',
      });
      setGeneratedAPIKey(response);
      setShowGenerateAPIKeyModal(false);
      setShowAPIKeyResultModal(true);
      fetchData(); // Refresh client data
    } catch (err: any) {
      setApiKeyError(err.response?.data?.error || 'Failed to generate API key');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeAPIKey = async () => {
    setSubmitting(true);
    try {
      await clientsApi.revokeAPIKey(clientId);
      setShowRevokeAPIKeyModal(false);
      fetchData(); // Refresh client data
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke API key');
    } finally {
      setSubmitting(false);
    }
  };

  const copyAPIKeyToClipboard = async () => {
    if (generatedAPIKey?.apiKey) {
      await navigator.clipboard.writeText(generatedAPIKey.apiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  };

  const openConfigureJWTModal = (isEdit: boolean) => {
    setIsEditingJWT(isEdit);
    if (isEdit && client) {
      setJwtFormData({
        issuer: client.jwtIssuer || '',
        jwksUrl: client.jwtJwksUrl || '',
        audiences: client.jwtAudiences || [],
        requiredClaims: client.jwtRequiredClaims || [],
      });
      setJwtAudiencesInput((client.jwtAudiences || []).join(', '));
    } else {
      setJwtFormData({
        issuer: '',
        jwksUrl: '',
        audiences: [],
        requiredClaims: [],
      });
      setJwtAudiencesInput('');
    }
    setJwtError(null);
    setShowConfigureJWTModal(true);
  };

  const handleConfigureJWT = async (e: React.FormEvent) => {
    e.preventDefault();
    setJwtError(null);
    setSubmitting(true);

    try {
      // Parse audiences from comma-separated input
      const audiences = jwtAudiencesInput
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const payload: ConfigureJWTInput = {
        issuer: jwtFormData.issuer,
        jwksUrl: jwtFormData.jwksUrl,
        audiences: audiences.length > 0 ? audiences : undefined,
        requiredClaims: jwtFormData.requiredClaims && jwtFormData.requiredClaims.length > 0
          ? jwtFormData.requiredClaims
          : undefined,
      };

      if (isEditingJWT) {
        await clientsApi.updateJWT(clientId, payload);
      } else {
        await clientsApi.configureJWT(clientId, payload);
      }
      setShowConfigureJWTModal(false);
      fetchData();
    } catch (err: any) {
      setJwtError(err.response?.data?.error || 'Failed to configure JWT');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveJWT = async () => {
    setSubmitting(true);
    try {
      await clientsApi.removeJWT(clientId);
      setShowRemoveJWTModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove JWT configuration');
    } finally {
      setSubmitting(false);
    }
  };

  const addRequiredClaim = () => {
    setJwtFormData(prev => ({
      ...prev,
      requiredClaims: [
        ...(prev.requiredClaims || []),
        { name: '', values: [], valueType: 'Exact' }
      ]
    }));
  };

  const updateRequiredClaim = (index: number, field: keyof JWTRequiredClaim, value: string | string[]) => {
    setJwtFormData(prev => ({
      ...prev,
      requiredClaims: prev.requiredClaims?.map((claim, i) =>
        i === index ? { ...claim, [field]: value } : claim
      )
    }));
  };

  const removeRequiredClaim = (index: number) => {
    setJwtFormData(prev => ({
      ...prev,
      requiredClaims: prev.requiredClaims?.filter((_, i) => i !== index)
    }));
  };

  // mTLS Handlers
  const openMTLSModal = (isEdit: boolean) => {
    setIsEditingMTLS(isEdit);
    if (isEdit && client) {
      setMtlsFormData({
        caName: client.mtlsCaName || '',
        caPem: '', // Don't show existing PEM for security
        sans: client.mtlsSans || [],
        hashes: client.mtlsHashes || [],
      });
    } else {
      setMtlsFormData({
        caName: '',
        caPem: '',
        sans: [],
        hashes: [],
      });
    }
    setMtlsError(null);
    setShowConfigureMTLSModal(true);
  };

  const handleConfigureMTLS = async (e: React.FormEvent) => {
    e.preventDefault();
    setMtlsError(null);

    // Validation
    if (!mtlsFormData.caName.trim()) {
      setMtlsError('CA name is required');
      return;
    }
    if (!isEditingMTLS && !mtlsFormData.caPem.trim()) {
      setMtlsError('CA certificate is required');
      return;
    }
    if (mtlsFormData.sans.length === 0 && mtlsFormData.hashes.length === 0) {
      setMtlsError('At least one SAN or certificate hash is required for client identification');
      return;
    }

    setSubmitting(true);
    try {
      await clientsApi.updateMTLS(clientId, {
        enabled: true,
        caName: mtlsFormData.caName.trim(),
        caPem: mtlsFormData.caPem.trim() || undefined,
        sans: mtlsFormData.sans,
        hashes: mtlsFormData.hashes,
      });
      setShowConfigureMTLSModal(false);
      fetchData();
    } catch (err: any) {
      setMtlsError(err.response?.data?.error || 'Failed to configure mTLS');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMTLS = async () => {
    setSubmitting(true);
    try {
      await clientsApi.deleteMTLS(clientId);
      setShowRemoveMTLSModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove mTLS configuration');
    } finally {
      setSubmitting(false);
    }
  };

  // Managed certificate attach/detach handlers
  const loadAttachableCertificates = async () => {
    setCertAttachError(null);
    setLoadingAttachableCertificates(true);
    try {
      const data = await clientsApi.listAttachableCertificates(clientId);
      setAttachableCertificates(data || []);
    } catch {
      setAttachableCertificates([]);
    } finally {
      setLoadingAttachableCertificates(false);
    }
  };

  const handleAttachCertificate = async () => {
    if (!selectedCertificateId) return;
    setCertAttachError(null);
    setAttachingCertificate(true);
    try {
      await clientsApi.attachCertificate(clientId, selectedCertificateId);
      const selected = attachableCertificates.find((c) => c.id === selectedCertificateId);
      setAttachedCertificateName(selected?.name || null);
      setSelectedCertificateId('');
      fetchData();
    } catch (err: any) {
      setCertAttachError(err.response?.data?.error || 'Failed to attach certificate');
    } finally {
      setAttachingCertificate(false);
    }
  };

  const handleDetachCertificate = async () => {
    setCertAttachError(null);
    setDetachingCertificate(true);
    try {
      await clientsApi.detachCertificate(clientId);
      setAttachedCertificateName(null);
      fetchData();
    } catch (err: any) {
      setCertAttachError(err.response?.data?.error || 'Failed to detach certificate');
    } finally {
      setDetachingCertificate(false);
    }
  };

  // Load attachable managed certificates when the mTLS tab is opened and no
  // managed certificate is currently attached.
  useEffect(() => {
    if (activeTab === 'mtls' && client && !client.managedCertificateId) {
      loadAttachableCertificates();
      if (projects.length === 0) {
        loadProjects();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, client?.managedCertificateId, clientId]);

  const addMtlsSan = () => {
    setMtlsError(null);
    if (!newMtlsSanValue.trim()) return;
    const value = newMtlsSanValue.trim();
    // Check for duplicates
    const isDuplicate = mtlsFormData.sans.some(san => san.type === newMtlsSanType && san.value === value);
    if (isDuplicate) {
      setMtlsError('This SAN entry is already in the list');
      return;
    }
    setMtlsFormData(prev => ({
      ...prev,
      sans: [...prev.sans, { type: newMtlsSanType, value }]
    }));
    setNewMtlsSanValue('');
  };

  const removeMtlsSan = (index: number) => {
    setMtlsFormData(prev => ({
      ...prev,
      sans: prev.sans.filter((_, i) => i !== index)
    }));
    setMtlsError(null);
  };

  const addMtlsHash = () => {
    setMtlsError(null);
    const hash = newMtlsHash.trim().toLowerCase();
    if (!hash) return;
    // Validate length
    if (hash.length !== 64) {
      setMtlsError('Certificate hash must be 64 hex characters (SHA256)');
      return;
    }
    // Validate hex characters
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      setMtlsError('Certificate hash must contain only hexadecimal characters (0-9, a-f)');
      return;
    }
    // Check for duplicates
    if (mtlsFormData.hashes.includes(hash)) {
      setMtlsError('This hash is already in the list');
      return;
    }
    setMtlsFormData(prev => ({
      ...prev,
      hashes: [...prev.hashes, hash]
    }));
    setNewMtlsHash('');
  };

  const removeMtlsHash = (index: number) => {
    setMtlsFormData(prev => ({
      ...prev,
      hashes: prev.hashes.filter((_, i) => i !== index)
    }));
    setMtlsError(null);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Clients
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            {client.description && (
              <p className="text-gray-600 mt-1">{client.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/clients/${clientId}/edit`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Client Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Owner Team</p>
                <p className="font-medium text-gray-900">
                  {client.team?.name || 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact</p>
                <p className="font-medium text-gray-900">
                  {client.contactName || 'Not set'}
                </p>
                {client.contactEmail && (
                  <p className="text-xs text-gray-500">{client.contactEmail}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Created By</p>
                <p className="font-medium text-gray-900">
                  {client.creator?.username || 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('ips')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'ips'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              IP Addresses
              <Badge variant="default" className="ml-2">{ips.length}</Badge>
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'headers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Header &amp; Method Rules
              <Badge variant="default" className="ml-2">{client.headerCount || headers.length}</Badge>
            </button>
            <button
              onClick={() => setActiveTab('apikey')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'apikey'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              API Key
              {client.apiKeyEnabled && (
                <Badge variant="success" className="ml-2">Active</Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('jwt')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'jwt'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              JWT
              {client.jwtEnabled && (
                <Badge variant="success" className="ml-2">Active</Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('mtls')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'mtls'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              mTLS
              {client.mtlsEnabled && (
                <Badge variant="success" className="ml-2">Active</Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('routes')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'routes'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Attached Routes
              <Badge variant="default" className="ml-2">{attachments.length}</Badge>
            </button>
          </div>

          {/* IP Addresses Tab */}
          {activeTab === 'ips' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    IP Addresses
                  </h2>
                </div>
                <Button size="sm" onClick={() => setShowAddIPModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add IP
                </Button>
              </div>

              {ips.length === 0 ? (
                <div className="text-center py-8">
                  <Network className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No IP addresses configured</p>
                  <p className="text-sm text-gray-400">
                    Add IP addresses for this client to enable IP allowlisting
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {ips.map((ip) => (
                    <div
                      key={ip.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                          {ip.cidr}
                        </code>
                        {ip.description && (
                          <span className="ml-3 text-sm text-gray-500">
                            {ip.description}
                          </span>
                        )}
                        <span className="ml-3 text-xs text-gray-400">
                          Added by {ip.creator?.username || 'unknown'} on{' '}
                          {new Date(ip.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedIP(ip);
                          setShowDeleteIPModal(true);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Headers Tab */}
          {activeTab === 'headers' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Header Authorization Rules
                  </h2>
                </div>
                <Button size="sm" onClick={() => setShowAddHeaderModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rule
                </Button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Define required HTTP headers for authorization. When attached to a route with header auth enabled, requests must include these headers with matching values.
              </p>

              {headers.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No header rules configured</p>
                  <p className="text-sm text-gray-400">
                    Add header rules to require specific HTTP headers for authorization when this client is attached to routes
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {headers.map((header) => (
                    <div
                      key={header.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                          {header.name}
                        </code>
                        <span className="ml-3 inline-flex gap-1 flex-wrap">
                          {header.values.map((val, idx) => (
                            <Badge key={idx} variant="info">{val}</Badge>
                          ))}
                        </span>
                        {header.description && (
                          <span className="ml-3 text-sm text-gray-500">
                            {header.description}
                          </span>
                        )}
                        <span className="ml-3 text-xs text-gray-400">
                          Added by {header.creator?.username || 'unknown'} on{' '}
                          {new Date(header.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedHeader(header);
                          setShowDeleteHeaderModal(true);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Allowed Methods Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Allowed HTTP Methods
                  </h2>
                  {savingMethods && (
                    <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Restrict which HTTP methods this client is allowed to use. If none are selected, all methods are allowed.
                </p>

                {methodsError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {methodsError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((method) => (
                    <label key={method} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={client.allowedMethods?.includes(method) || false}
                        onChange={() => handleToggleMethod(method)}
                        disabled={savingMethods}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-mono text-gray-700">{method}</span>
                    </label>
                  ))}
                </div>

                {client.allowedMethods && client.allowedMethods.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">
                    Currently allowed: {client.allowedMethods.join(', ')}
                  </p>
                )}
              </div>
            </>
          )}

          {/* API Key Tab */}
          {activeTab === 'apikey' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    API Key Authentication
                  </h2>
                </div>
              </div>

              {client.apiKeyEnabled ? (
                <div className="space-y-6">
                  {/* API Key Status Card */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">API Key Enabled</p>
                        <p className="text-sm text-green-600">This client can authenticate using an API key</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Key Prefix</p>
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                          {client.apiKeyPrefix || 'N/A'}****
                        </code>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Header Name</p>
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                          {client.apiKeyHeaderName || 'x-api-key'}
                        </code>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="text-sm text-gray-700">
                          {client.apiKeyCreatedAt
                            ? new Date(client.apiKeyCreatedAt).toLocaleString()
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Client Routing Header */}
                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <p className="text-sm font-medium text-primary-800 mb-2">Client Routing Header</p>
                    <p className="text-xs text-primary-700 mb-2">
                      When this client is attached to a route, requests must include this header for routing:
                    </p>
                    <code className="text-sm font-mono bg-primary-100 px-2 py-1 rounded text-primary-900 block">
                      {client.clientIdHeaderName || 'x-client-id'}: {client.id}
                    </code>
                  </div>

                  {/* Usage Example */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Usage Example</p>
                    <code className="text-xs font-mono text-gray-600 block bg-gray-100 p-3 rounded overflow-x-auto">
                      curl -H &quot;{client.clientIdHeaderName || 'x-client-id'}: {client.id}&quot; -H &quot;{client.apiKeyHeaderName || 'x-api-key'}: YOUR_API_KEY&quot; https://your-api.example.com
                    </code>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setApiKeyHeaderName(client.apiKeyHeaderName || 'x-api-key');
                        setShowGenerateAPIKeyModal(true);
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Key
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowRevokeAPIKeyModal(true)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Revoke Key
                    </Button>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-800 font-medium">Important</p>
                        <p className="text-sm text-yellow-700">
                          Regenerating the API key will invalidate the current key. All routes using this client&apos;s API key authentication will need to be redeployed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Key className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No API Key Configured</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Generate an API key to allow this client to authenticate using header-based API key authentication.
                  </p>
                  <Button onClick={() => setShowGenerateAPIKeyModal(true)}>
                    <Key className="h-4 w-4 mr-2" />
                    Generate API Key
                  </Button>
                </div>
              )}
            </>
          )}

          {/* JWT Tab */}
          {activeTab === 'jwt' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    JWT Authentication
                  </h2>
                </div>
              </div>

              {client.jwtEnabled ? (
                <div className="space-y-6">
                  {/* JWT Status Card */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">JWT Enabled</p>
                        <p className="text-sm text-green-600">This client can authenticate using JWT tokens</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Issuer</p>
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-800 break-all">
                          {client.jwtIssuer}
                        </code>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">JWKS URL</p>
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-800 break-all">
                          {client.jwtJwksUrl}
                        </code>
                      </div>
                      {client.jwtAudiences && client.jwtAudiences.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-500">Audiences</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {client.jwtAudiences.map((aud, idx) => (
                              <Badge key={idx} variant="default">{aud}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {client.jwtRequiredClaims && client.jwtRequiredClaims.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-500">Required Claims</p>
                          <div className="space-y-2 mt-1">
                            {client.jwtRequiredClaims.map((claim, idx) => (
                              <div key={idx} className="text-sm bg-gray-100 px-2 py-1 rounded">
                                <span className="font-medium">{claim.name}</span>:{' '}
                                <span className="text-gray-600">{claim.values.join(', ')}</span>
                                {claim.valueType && claim.valueType !== 'Exact' && (
                                  <span className="text-gray-400 ml-1">({claim.valueType})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-500">Configured</p>
                        <p className="text-sm text-gray-700">
                          {client.jwtCreatedAt
                            ? new Date(client.jwtCreatedAt).toLocaleString()
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Client Routing Header */}
                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <p className="text-sm font-medium text-primary-800 mb-2">Client Routing Header</p>
                    <p className="text-xs text-primary-700 mb-2">
                      When this client is attached to a route, requests must include this header for routing:
                    </p>
                    <code className="text-sm font-mono bg-primary-100 px-2 py-1 rounded text-primary-900 block">
                      {client.clientIdHeaderName || 'x-client-id'}: {client.id}
                    </code>
                  </div>

                  {/* Usage Example */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Usage Example</p>
                    <code className="text-xs font-mono text-gray-600 block bg-gray-100 p-3 rounded overflow-x-auto">
                      curl -H &quot;{client.clientIdHeaderName || 'x-client-id'}: {client.id}&quot; -H &quot;Authorization: Bearer YOUR_JWT_TOKEN&quot; https://your-api.example.com
                    </code>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => openConfigureJWTModal(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Configuration
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowRemoveJWTModal(true)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove JWT
                    </Button>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-800 font-medium">Important</p>
                        <p className="text-sm text-yellow-700">
                          Modifying JWT configuration will affect all routes using this client&apos;s JWT authentication. Routes will need to be redeployed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No JWT Configured</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Configure JWT authentication to allow this client to authenticate using JWT tokens from their identity provider.
                  </p>
                  <Button onClick={() => openConfigureJWTModal(false)}>
                    <Shield className="h-4 w-4 mr-2" />
                    Configure JWT
                  </Button>
                </div>
              )}
            </>
          )}

          {/* mTLS Tab */}
          {activeTab === 'mtls' && (
            <div className="space-y-6">
              {/* Managed Certificate Identity */}
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <h3 className="font-medium text-gray-900">Managed Certificate Identity</h3>
                </div>

                {certAttachError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {certAttachError}
                  </div>
                )}

                {client.managedCertificateId ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div>
                      <p className="text-sm text-gray-500">Managed certificate attached</p>
                      <p className="text-sm font-medium text-gray-900">
                        {attachedCertificateName || client.managedCertificateId}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDetachCertificate}
                      disabled={detachingCertificate}
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      {detachingCertificate ? 'Detaching...' : 'Detach'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">
                      Attach a managed client certificate to use as this client&apos;s mTLS identity instead of a bring-your-own CA.
                    </p>
                    <div>
                      <select
                        value={selectedCertificateId}
                        onChange={(e) => setSelectedCertificateId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">
                          {loadingAttachableCertificates ? 'Loading certificates...' : 'Select a certificate...'}
                        </option>
                        {attachableCertificates.map((cert) => (
                          <option key={cert.id} value={cert.id}>
                            {cert.name} — {projects.find((p) => p.id === cert.projectId)?.name || cert.projectId}
                          </option>
                        ))}
                      </select>
                      {!loadingAttachableCertificates && attachableCertificates.length === 0 && (
                        <p className="mt-1 text-xs text-gray-400">No attachable client certificates found.</p>
                      )}
                      {(() => {
                        const selectedCert = attachableCertificates.find((c) => c.id === selectedCertificateId);
                        if (!selectedCert || (!selectedCert.subject && (!selectedCert.uriSans || selectedCert.uriSans.length === 0))) {
                          return null;
                        }
                        return (
                          <p className="mt-1 text-xs text-gray-500">
                            {selectedCert.subject && <>Subject: {selectedCert.subject}</>}
                            {selectedCert.uriSans && selectedCert.uriSans.length > 0 && (
                              <>{selectedCert.subject ? ' · ' : ''}SANs: {selectedCert.uriSans.join(', ')}</>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAttachCertificate}
                      disabled={!selectedCertificateId || attachingCertificate}
                    >
                      {attachingCertificate ? 'Attaching...' : 'Attach'}
                    </Button>
                  </div>
                )}
              </div>

              {client.mtlsEnabled ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">mTLS Authentication Enabled</h3>
                        <p className="text-sm text-gray-500">Client certificate authentication is active</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openMTLSModal(true)}
                        disabled={!!client.managedCertificateId}
                        title={client.managedCertificateId ? 'Detach the managed certificate to configure a bring-your-own CA' : undefined}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowRemoveMTLSModal(true)}
                        disabled={!!client.managedCertificateId}
                        title={client.managedCertificateId ? 'Detach the managed certificate to configure a bring-your-own CA' : undefined}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  {client.managedCertificateId && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                      Detach the managed certificate to configure a bring-your-own CA.
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">CA Certificate</h4>
                      <div className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{client.mtlsCaName || 'Unnamed CA'}</span>
                        </div>
                        {client.mtlsCaSecret && (
                          <p className="text-xs text-gray-500 mt-1">Secret: {client.mtlsCaSecret}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Client Identification</h4>
                      <div className="p-3 bg-gray-50 rounded-lg border space-y-2">
                        {client.mtlsSans && client.mtlsSans.length > 0 && (
                          <div>
                            <span className="text-xs text-gray-500">SANs:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {client.mtlsSans.map((san, i) => (
                                <Badge key={i} variant="info">{san.type}: {san.value}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {client.mtlsHashes && client.mtlsHashes.length > 0 && (
                          <div>
                            <span className="text-xs text-gray-500">Certificate Hashes:</span>
                            <div className="mt-1 space-y-1">
                              {client.mtlsHashes.map((hash, i) => (
                                <code key={i} className="block text-xs bg-gray-100 px-2 py-1 rounded font-mono truncate">{hash}</code>
                              ))}
                            </div>
                          </div>
                        )}
                        {(!client.mtlsSans || client.mtlsSans.length === 0) && (!client.mtlsHashes || client.mtlsHashes.length === 0) && (
                          <p className="text-sm text-gray-500">No identification configured</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Client Routing Header */}
                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <p className="text-sm font-medium text-primary-800 mb-2">Client Routing Header</p>
                    <p className="text-xs text-primary-700 mb-2">
                      When this client is attached to a route, requests must include this header for routing:
                    </p>
                    <code className="text-sm font-mono bg-primary-100 px-2 py-1 rounded text-primary-900 block">
                      {client.clientIdHeaderName || 'x-client-id'}: {client.id}
                    </code>
                  </div>

                  {/* Usage Example */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Usage Example</p>
                    <code className="text-xs font-mono text-gray-600 block bg-gray-100 p-3 rounded overflow-x-auto">
                      curl --cert client.crt --key client.key -H &quot;{client.clientIdHeaderName || 'x-client-id'}: {client.id}&quot; https://your-api.example.com
                    </code>
                  </div>

                  {client.mtlsCreatedAt && (
                    <p className="text-xs text-gray-400">
                      Configured on {new Date(client.mtlsCreatedAt).toLocaleDateString()}
                    </p>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Important</h4>
                        <p className="text-sm text-yellow-700">
                          Modifying mTLS configuration will affect all routes using this client&apos;s mTLS authentication. Routes will need to be redeployed. The domain must also have mTLS enabled for client mTLS to work.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No mTLS Configured</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Configure mTLS authentication to allow this client to authenticate using client certificates. The domain must also have mTLS enabled.
                  </p>
                  <Button
                    onClick={() => openMTLSModal(false)}
                    disabled={!!client.managedCertificateId}
                    title={client.managedCertificateId ? 'Detach the managed certificate to configure a bring-your-own CA' : undefined}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Configure mTLS
                  </Button>
                  {client.managedCertificateId && (
                    <p className="text-sm text-gray-500 mt-3">
                      Detach the managed certificate to configure a bring-your-own CA.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attached Routes Tab */}
          {activeTab === 'routes' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Route className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Attached Routes
                  </h2>
                </div>
                <Button size="sm" onClick={openAttachModal}>
                  <Plus className="h-4 w-4 mr-1" />
                  Attach to Route
                </Button>
              </div>

              {attachments.length === 0 ? (
                <div className="text-center py-8">
                  <Route className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No routes attached</p>
                  <p className="text-sm text-gray-400">
                    Attach this client to routes to enable security features
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Route
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Team
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Security
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {attachments.map((att) => (
                        <tr key={att.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">
                              {att.route?.name || att.routeId}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="default">
                              {att.route?.team?.name || 'Unknown'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {att.enableIpAllowlist && (
                                <Badge variant="info">IP Allow</Badge>
                              )}
                              {att.enableApiKey && (
                                <Badge variant="info">API Key</Badge>
                              )}
                              {att.enableJwt && (
                                <Badge variant="info">JWT</Badge>
                              )}
                              {att.enableBasicAuth && (
                                <Badge variant="info">Auth</Badge>
                              )}
                              {att.enableMtls && (
                                <Badge variant="info">mTLS</Badge>
                              )}
                              {att.rateLimitConfig?.global?.rules?.[0] && (
                                <Badge variant="warning">
                                  {att.rateLimitConfig.global.rules[0].limit.requests}/{att.rateLimitConfig.global.rules[0].limit.unit.toLowerCase().slice(0, 3)}
                                </Badge>
                              )}
                              {!att.enableIpAllowlist && !att.enableApiKey && !att.enableJwt && !att.enableBasicAuth && !att.enableMtls && !att.rateLimitConfig && (
                                <span className="text-sm text-gray-400">None</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(att.status)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(att.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add IP Modal */}
      <Modal
        isOpen={showAddIPModal}
        onClose={() => {
          setShowAddIPModal(false);
          setIpFormData({ cidr: '', description: '' });
          setIpFormError(null);
        }}
        title="Add IP Address"
      >
        <form onSubmit={handleAddIP} className="space-y-4">
          {ipFormError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {ipFormError}
            </div>
          )}

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">CIDR / IP Address<InfoTooltip text="IP address or range in CIDR notation. Without /prefix, a single IP (/32) is assumed." example="10.0.0.0/8 or 192.168.1.100/32" /></label>
            <Input
              value={ipFormData.cidr}
              onChange={(e) =>
                setIpFormData({ ...ipFormData, cidr: e.target.value })
              }
              required
              placeholder="e.g., 10.0.0.0/24 or 192.168.1.100"
            />
          </div>

          <Input
            label="Description"
            value={ipFormData.description}
            onChange={(e) =>
              setIpFormData({ ...ipFormData, description: e.target.value })
            }
            placeholder="Optional description"
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddIPModal(false);
                setIpFormData({ cidr: '', description: '' });
                setIpFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add IP'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete IP Modal */}
      <Modal
        isOpen={showDeleteIPModal}
        onClose={() => {
          setShowDeleteIPModal(false);
          setSelectedIP(null);
        }}
        title="Remove IP Address"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to remove IP address{' '}
            <code className="bg-gray-100 px-1 rounded">{selectedIP?.cidr}</code>
            ?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteIPModal(false);
                setSelectedIP(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemoveIP}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Removing...' : 'Remove IP'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Header Authorization Rule Modal */}
      <Modal
        isOpen={showAddHeaderModal}
        onClose={() => {
          setShowAddHeaderModal(false);
          setHeaderFormData({ name: '', values: [], valueInput: '', description: '' });
          setHeaderFormError(null);
        }}
        title="Add Header Authorization Rule"
      >
        <form onSubmit={handleAddHeader} className="space-y-4">
          <p className="text-sm text-gray-600">
            Define an HTTP header that must be present with one of the allowed values for requests to be authorized.
          </p>

          {headerFormError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {headerFormError}
            </div>
          )}

          <Input
            label="HTTP Header Name"
            value={headerFormData.name}
            onChange={(e) =>
              setHeaderFormData({ ...headerFormData, name: e.target.value })
            }
            placeholder="e.g., x-team-id, x-user-role"
          />

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Values</label>
            <p className="text-xs text-gray-500 mb-2">Requests must include this header with one of these values to be authorized</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter a value and press Add"
                value={headerFormData.valueInput}
                onChange={(e) => setHeaderFormData({ ...headerFormData, valueInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddHeaderValue();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={handleAddHeaderValue}>
                Add
              </Button>
            </div>
            {headerFormData.values.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {headerFormData.values.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-sm"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() => handleRemoveHeaderValue(value)}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={headerFormData.description}
              onChange={(e) =>
                setHeaderFormData({ ...headerFormData, description: e.target.value })
              }
              placeholder="e.g., Allow backend team access"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddHeaderModal(false);
                setHeaderFormData({ name: '', values: [], valueInput: '', description: '' });
                setHeaderFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submittingHeader || headerFormData.values.length === 0}>
              {submittingHeader ? 'Adding...' : 'Add Header Rule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Header Modal */}
      <Modal
        isOpen={showDeleteHeaderModal}
        onClose={() => {
          setShowDeleteHeaderModal(false);
          setSelectedHeader(null);
        }}
        title="Remove Header"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to remove header{' '}
            <code className="bg-gray-100 px-1 rounded">{selectedHeader?.name}</code>
            ?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteHeaderModal(false);
                setSelectedHeader(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteHeader}
              disabled={submittingHeader}
              className="bg-red-600 hover:bg-red-700"
            >
              {submittingHeader ? 'Removing...' : 'Remove Header'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Attach to Route Modal */}
      <Modal
        isOpen={showAttachModal}
        onClose={() => {
          setShowAttachModal(false);
          setAttachFormData({
            routeId: '',
            projectId: '',
            domainId: '',
            enableIpAllowlist: true,
            enableApiKey: false,
            enableJwt: false,
            enableBasicAuth: false,
            enableMtls: false,
            enableHeaderAuth: false,
          });
          setAttachRateLimitConfig(undefined);
          setAttachFormError(null);
          setProjects([]);
          setDomains([]);
          setRoutes([]);
        }}
        title="Attach to Route"
      >
        <form onSubmit={handleAttach} className="space-y-4">
          {attachFormError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {attachFormError}
            </div>
          )}

          {/* Project Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={attachFormData.projectId}
              onChange={(e) => {
                const projectId = e.target.value;
                setAttachFormData({ ...attachFormData, projectId, domainId: '', routeId: '' });
                if (projectId) loadDomains(projectId);
                else { setDomains([]); setRoutes([]); }
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a project...</option>
              {loadingProjects && <option disabled>Loading...</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Domain Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <select
              value={attachFormData.domainId}
              onChange={(e) => {
                const domainId = e.target.value;
                setAttachFormData({ ...attachFormData, domainId, routeId: '' });
                if (domainId && attachFormData.projectId) loadRoutes(attachFormData.projectId, domainId);
                else setRoutes([]);
              }}
              required
              disabled={!attachFormData.projectId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{attachFormData.projectId ? 'Select a domain...' : 'Select a project first'}</option>
              {loadingDomains && <option disabled>Loading...</option>}
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.hostname}</option>
              ))}
            </select>
          </div>

          {/* Route Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
            <select
              value={attachFormData.routeId}
              onChange={(e) =>
                setAttachFormData({ ...attachFormData, routeId: e.target.value })
              }
              required
              disabled={!attachFormData.domainId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{attachFormData.domainId ? 'Select a route...' : 'Select a domain first'}</option>
              {loadingRoutes && <option disabled>Loading...</option>}
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Security Features</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attachFormData.enableIpAllowlist}
                onChange={(e) =>
                  setAttachFormData({ ...attachFormData, enableIpAllowlist: e.target.checked })
                }
                className="rounded border-gray-300"
                disabled={!client.ipAddressCount}
              />
              <span className={`text-sm ${client.ipAddressCount ? 'text-gray-700' : 'text-gray-400'}`}>
                IP Allowlist {!client.ipAddressCount && '(add IPs first)'}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attachFormData.enableApiKey}
                onChange={(e) =>
                  setAttachFormData({ ...attachFormData, enableApiKey: e.target.checked })
                }
                className="rounded border-gray-300"
                disabled={!client.apiKeyEnabled}
              />
              <span className={`text-sm ${client.apiKeyEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                API Key {!client.apiKeyEnabled && '(generate key first)'}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attachFormData.enableJwt}
                onChange={(e) =>
                  setAttachFormData({ ...attachFormData, enableJwt: e.target.checked })
                }
                className="rounded border-gray-300"
                disabled={!client.jwtEnabled}
              />
              <span className={`text-sm ${client.jwtEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                JWT {!client.jwtEnabled && '(configure JWT first)'}
              </span>
            </label>
            {(attachFormData.enableIpAllowlist && attachFormData.enableApiKey) ||
             (attachFormData.enableIpAllowlist && attachFormData.enableJwt) ||
             (attachFormData.enableApiKey && attachFormData.enableJwt) ? (
              <p className="text-xs text-yellow-600 ml-6">
                Multiple enabled = Client must pass ALL enabled checks (AND logic)
              </p>
            ) : null}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attachFormData.enableBasicAuth}
                onChange={(e) =>
                  setAttachFormData({ ...attachFormData, enableBasicAuth: e.target.checked })
                }
                className="rounded border-gray-300"
                disabled
              />
              <span className="text-sm text-gray-400">Basic Auth (coming soon)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attachFormData.enableMtls}
                onChange={(e) =>
                  setAttachFormData({ ...attachFormData, enableMtls: e.target.checked })
                }
                className="rounded border-gray-300"
                disabled={!client.mtlsEnabled}
              />
              <span className={`text-sm ${client.mtlsEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                Mutual TLS {!client.mtlsEnabled && '(configure mTLS first)'}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attachFormData.enableHeaderAuth}
                onChange={(e) =>
                  setAttachFormData({ ...attachFormData, enableHeaderAuth: e.target.checked })
                }
                className="rounded border-gray-300"
                disabled={!headers.length && !(client.allowedMethods && client.allowedMethods.length > 0)}
              />
              <span className={`text-sm ${(headers.length > 0 || (client.allowedMethods && client.allowedMethods.length > 0)) ? 'text-gray-700' : 'text-gray-400'}`}>
                Header & Method Auth {!headers.length && !(client.allowedMethods && client.allowedMethods.length > 0) && '(add headers or methods first)'}
              </span>
            </label>
          </div>

          {/* Rate Limiting Section */}
          {(() => {
            const selectedRoute = routes.find(r => r.id === attachFormData.routeId);
            const showRateLimit = selectedRoute?.securityMode === 'client' && capabilities?.rateLimitAvailable;
            if (!showRateLimit) return null;
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Rate Limiting (optional)</p>
                <RateLimitForm
                  value={attachRateLimitConfig}
                  onChange={setAttachRateLimitConfig}
                />
              </div>
            );
          })()}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAttachModal(false);
                setAttachFormData({
                  routeId: '',
                  projectId: '',
                  domainId: '',
                  enableIpAllowlist: true,
                  enableApiKey: false,
                  enableJwt: false,
                  enableBasicAuth: false,
                  enableMtls: false,
                  enableHeaderAuth: false,
                });
                setAttachRateLimitConfig(undefined);
                setAttachFormError(null);
                setProjects([]);
                setDomains([]);
                setRoutes([]);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !attachFormData.routeId}>
              {submitting ? 'Attaching...' : 'Attach'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Client Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Client"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete client{' '}
            <span className="font-semibold">{client.name}</span>? This will
            remove all IP addresses and route attachments. This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteClient}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Deleting...' : 'Delete Client'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generate API Key Modal */}
      <Modal
        isOpen={showGenerateAPIKeyModal}
        onClose={() => {
          setShowGenerateAPIKeyModal(false);
          setApiKeyHeaderName('x-api-key');
          setApiKeyError(null);
        }}
        title={client.apiKeyEnabled ? 'Regenerate API Key' : 'Generate API Key'}
      >
        <form onSubmit={handleGenerateAPIKey} className="space-y-4">
          {apiKeyError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {apiKeyError}
            </div>
          )}

          {client.apiKeyEnabled && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-700">
                  This will invalidate the current API key. Routes using this client&apos;s API key authentication will need to be redeployed.
                </p>
              </div>
            </div>
          )}

          <div>
            <Input
              label="Header Name"
              value={apiKeyHeaderName}
              onChange={(e) => setApiKeyHeaderName(e.target.value)}
              placeholder="x-api-key"
            />
            <p className="text-xs text-gray-500 mt-1">The header name to send the API key in requests</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowGenerateAPIKeyModal(false);
                setApiKeyHeaderName('x-api-key');
                setApiKeyError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Generating...' : client.apiKeyEnabled ? 'Regenerate Key' : 'Generate Key'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* API Key Result Modal */}
      <Modal
        isOpen={showAPIKeyResultModal}
        onClose={() => {
          setShowAPIKeyResultModal(false);
          setGeneratedAPIKey(null);
        }}
        title="API Key Generated"
      >
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-700 font-medium">
                Copy this key now. It won&apos;t be shown again.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
              <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                {generatedAPIKey?.apiKey}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyAPIKeyToClipboard}
                className="shrink-0"
              >
                {apiKeyCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Usage Example</p>
            <code className="text-xs font-mono text-gray-600 block bg-gray-100 p-3 rounded overflow-x-auto">
              curl -H &quot;{generatedAPIKey?.headerName}: {generatedAPIKey?.apiKey}&quot; https://your-api.example.com
            </code>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => {
                setShowAPIKeyResultModal(false);
                setGeneratedAPIKey(null);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Revoke API Key Modal */}
      <Modal
        isOpen={showRevokeAPIKeyModal}
        onClose={() => setShowRevokeAPIKeyModal(false)}
        title="Revoke API Key"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">
                This action is irreversible. The API key will be permanently deleted and any routes using this client&apos;s API key authentication will stop working until a new key is generated and routes are redeployed.
              </p>
            </div>
          </div>

          <p className="text-gray-600">
            Are you sure you want to revoke the API key for{' '}
            <span className="font-semibold">{client.name}</span>?
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowRevokeAPIKeyModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevokeAPIKey}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Revoking...' : 'Revoke Key'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Configure JWT Modal */}
      <Modal
        isOpen={showConfigureJWTModal}
        onClose={() => {
          setShowConfigureJWTModal(false);
          setJwtFormData({ issuer: '', jwksUrl: '', audiences: [], requiredClaims: [] });
          setJwtAudiencesInput('');
          setJwtError(null);
        }}
        title={isEditingJWT ? 'Edit JWT Configuration' : 'Configure JWT Authentication'}
        size="lg"
      >
        <form onSubmit={handleConfigureJWT} className="space-y-4">
          {jwtError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {jwtError}
            </div>
          )}

          {isEditingJWT && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-700">
                  Modifying JWT configuration will require redeploying routes that use this client&apos;s JWT authentication.
                </p>
              </div>
            </div>
          )}

          <div>
            <Input
              label="Issuer URL *"
              value={jwtFormData.issuer}
              onChange={(e) => setJwtFormData({ ...jwtFormData, issuer: e.target.value })}
              placeholder="https://auth.example.com/"
              required
            />
            <p className="text-xs text-gray-500 mt-1">The &quot;iss&quot; claim in JWTs must match this value</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">JWKS URL *<InfoTooltip text="JSON Web Key Set URL — where your identity provider publishes its public keys for token verification." example="https://auth.example.com/.well-known/jwks.json" /></label>
            <Input
              value={jwtFormData.jwksUrl}
              onChange={(e) => setJwtFormData({ ...jwtFormData, jwksUrl: e.target.value })}
              placeholder="https://auth.example.com/.well-known/jwks.json"
              required
            />
            <p className="text-xs text-gray-500 mt-1">URL to fetch JSON Web Key Set for token verification</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audiences (optional)<InfoTooltip text="Expected 'aud' claim values in the JWT. Comma-separated." example="my-api, my-api-v2" /></label>
            <Input
              value={jwtAudiencesInput}
              onChange={(e) => setJwtAudiencesInput(e.target.value)}
              placeholder="my-api, my-api-v2"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated. If set, &quot;aud&quot; claim must match one of these values</p>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">Required Claims (optional)</p>
              <Button type="button" variant="secondary" size="sm" onClick={addRequiredClaim}>
                <Plus className="h-3 w-3 mr-1" />
                Add Claim
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Restrict access to JWTs containing specific claim values</p>

            {jwtFormData.requiredClaims && jwtFormData.requiredClaims.length > 0 && (
              <div className="space-y-3">
                {jwtFormData.requiredClaims.map((claim, index) => (
                  <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Claim Name</label>
                        <input
                          type="text"
                          value={claim.name}
                          onChange={(e) => updateRequiredClaim(index, 'name', e.target.value)}
                          placeholder="scope"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-500 mb-1">Values (comma-separated)</label>
                        <input
                          type="text"
                          value={claim.values.join(', ')}
                          onChange={(e) => updateRequiredClaim(index, 'values', e.target.value.split(',').map(v => v.trim()).filter(v => v))}
                          placeholder="api:read, api:write"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Match Type</label>
                        <select
                          value={claim.valueType || 'Exact'}
                          onChange={(e) => updateRequiredClaim(index, 'valueType', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="Exact">Exact</option>
                          <option value="StringContains">Contains</option>
                        </select>
                      </div>
                      <div className="col-span-1 flex items-end justify-center pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRequiredClaim(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowConfigureJWTModal(false);
                setJwtFormData({ issuer: '', jwksUrl: '', audiences: [], requiredClaims: [] });
                setJwtAudiencesInput('');
                setJwtError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : isEditingJWT ? 'Update Configuration' : 'Configure JWT'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove JWT Modal */}
      <Modal
        isOpen={showRemoveJWTModal}
        onClose={() => setShowRemoveJWTModal(false)}
        title="Remove JWT Configuration"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">
                This will remove the JWT configuration. Any routes using this client&apos;s JWT authentication will stop working until JWT is reconfigured and routes are redeployed.
              </p>
            </div>
          </div>

          <p className="text-gray-600">
            Are you sure you want to remove JWT configuration for{' '}
            <span className="font-semibold">{client.name}</span>?
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowRemoveJWTModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemoveJWT}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Removing...' : 'Remove JWT'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Configure mTLS Modal */}
      <Modal
        isOpen={showConfigureMTLSModal}
        onClose={() => setShowConfigureMTLSModal(false)}
        title={isEditingMTLS ? 'Edit mTLS Configuration' : 'Configure mTLS Authentication'}
      >
        <form onSubmit={handleConfigureMTLS} className="space-y-4">
          {mtlsError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-600">{mtlsError}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CA Certificate Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={mtlsFormData.caName}
              onChange={(e) => setMtlsFormData(prev => ({ ...prev, caName: e.target.value }))}
              placeholder="e.g., Client CA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CA Certificate (PEM) {!isEditingMTLS && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              rows={6}
              value={mtlsFormData.caPem}
              onChange={(e) => setMtlsFormData(prev => ({ ...prev, caPem: e.target.value }))}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            />
            {isEditingMTLS && (
              <p className="text-xs text-gray-500 mt-1">Leave empty to keep the existing certificate</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Identification (SAN or Certificate Hash) <span className="text-red-500">*</span><InfoTooltip text="At least one SAN or certificate hash to identify this client's certificate. DNS type for hostnames, URI for service identities." />
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Add at least one Subject Alternative Name (SAN) or certificate hash to identify this client.
            </p>

            {/* SANs */}
            <div className="space-y-2 mb-3">
              <label className="text-sm text-gray-600">Subject Alternative Names</label>
              {mtlsFormData.sans.length > 0 && (
                <div className="space-y-1">
                  {mtlsFormData.sans.map((san, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Badge variant="info">{san.type}</Badge>
                      <span className="flex-1 font-mono text-xs">{san.value}</span>
                      <button type="button" onClick={() => removeMtlsSan(index)} className="text-red-500 hover:text-red-700">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select
                  className="px-2 py-1 border rounded text-sm"
                  value={newMtlsSanType}
                  onChange={(e) => setNewMtlsSanType(e.target.value as 'DNS' | 'URI')}
                >
                  <option value="DNS">DNS</option>
                  <option value="URI">URI</option>
                </select>
                <Input
                  className="flex-1"
                  placeholder="e.g., client.example.com"
                  value={newMtlsSanValue}
                  onChange={(e) => setNewMtlsSanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMtlsSan();
                    }
                  }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addMtlsSan} disabled={!newMtlsSanValue.trim()}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>

            {/* Hashes */}
            <div className="space-y-2">
              <label className="text-sm text-gray-600">Certificate Hashes (SHA256)</label>
              {mtlsFormData.hashes.length > 0 && (
                <div className="space-y-1">
                  {mtlsFormData.hashes.map((hash, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 font-mono text-xs truncate">{hash}</span>
                      <button type="button" onClick={() => removeMtlsHash(index)} className="text-red-500 hover:text-red-700">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  className="flex-1 font-mono text-xs"
                  placeholder="64-character SHA256 hash"
                  value={newMtlsHash}
                  onChange={(e) => setNewMtlsHash(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMtlsHash();
                    }
                  }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addMtlsHash} disabled={!newMtlsHash.trim()}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowConfigureMTLSModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : (isEditingMTLS ? 'Update mTLS' : 'Configure mTLS')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove mTLS Modal */}
      <Modal
        isOpen={showRemoveMTLSModal}
        onClose={() => setShowRemoveMTLSModal(false)}
        title="Remove mTLS Configuration"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">
                This will remove the mTLS configuration. Any routes using this client&apos;s mTLS authentication will stop working until mTLS is reconfigured and routes are redeployed.
              </p>
            </div>
          </div>

          <p className="text-gray-600">
            Are you sure you want to remove mTLS configuration for{' '}
            <span className="font-semibold">{client.name}</span>?
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowRemoveMTLSModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemoveMTLS}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Removing...' : 'Remove mTLS'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
