import type { RoutePrefillData } from '@/types';

/**
 * Reads and consumes a prefill key from sessionStorage.
 * Returns the parsed data or null if not found.
 */
export function readPrefillData(key: string): RoutePrefillData | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as RoutePrefillData;
  } catch {
    return null;
  }
}

/**
 * Extracts form-compatible values from RoutePrefillData.
 * Returns an object with all the fields the create page needs to populate.
 */
export function extractPrefillFormData(data: RoutePrefillData) {
  const config = data.config;

  // Extract path matching from first match
  const firstMatch = config.matches?.[0];
  const pathType = firstMatch?.path?.type || 'Prefix';
  const pathValue = firstMatch?.path?.value || '/';
  const method = firstMatch?.method || '';

  // Extract gRPC matching
  const grpcServiceType = (firstMatch as any)?.grpcService?.type || 'Exact';
  const grpcServiceValue = (firstMatch as any)?.grpcService?.value || '';
  const grpcMethodType = (firstMatch as any)?.grpcMethod?.type || 'Exact';
  const grpcMethodValue = (firstMatch as any)?.grpcMethod?.value || '';

  // Extract header matches
  const headerMatches = firstMatch?.headers?.map((h: any) => ({
    name: h.name || '',
    type: (h.type || 'Exact') as 'Exact' | 'RegularExpression',
    value: h.value || '',
  })) || [];

  // Extract query param matches
  const queryParamMatches = (firstMatch as any)?.queryParams?.map((q: any) => ({
    name: q.name || '',
    type: (q.type || 'Exact') as 'Exact' | 'RegularExpression',
    value: q.value || '',
  })) || [];

  // Extract backends
  const backends = config.backends?.map((b: any) => ({
    type: (b.type || 'kubernetes') as 'kubernetes' | 'external',
    namespace: b.namespace || '',
    service: b.service || '',
    port: b.port || 80,
    weight: b.weight ?? 100,
    fallback: b.fallback || false,
    services: [] as any[],
    addressType: 'fqdn' as const,
    address: '',
    tlsEnabled: b.tls?.enabled || false,
    tlsMode: (b.tls?.mode || 'simple') as 'simple' | 'mtls',
    insecureSkipVerify: b.tls?.insecureSkipVerify || false,
    sni: b.tls?.sni || '',
    caCertificateRefs: b.tls?.caCertificateRefs || [{ kind: 'ConfigMap' as const, name: '', namespace: '' }],
    clientCertificateRef: b.tls?.clientCertificateRef || { name: '', namespace: '' },
  })) || [];

  // Extract header modifiers
  const requestHeaderModifiers = [
    ...(config.requestHeaderModifier?.set?.map((h: any) => ({ action: 'set' as const, name: h.name, value: h.value })) || []),
    ...(config.requestHeaderModifier?.add?.map((h: any) => ({ action: 'add' as const, name: h.name, value: h.value })) || []),
    ...(config.requestHeaderModifier?.remove?.map((h: string) => ({ action: 'remove' as const, name: h, value: '' })) || []),
  ];

  const responseHeaderModifiers = [
    ...(config.responseHeaderModifier?.set?.map((h: any) => ({ action: 'set' as const, name: h.name, value: h.value })) || []),
    ...(config.responseHeaderModifier?.add?.map((h: any) => ({ action: 'add' as const, name: h.name, value: h.value })) || []),
    ...(config.responseHeaderModifier?.remove?.map((h: string) => ({ action: 'remove' as const, name: h, value: '' })) || []),
  ];

  // Determine route type
  const routeType = config.routeType || (config.redirect ? 'redirect' : config.directResponse ? 'directResponse' : 'backend');

  return {
    formData: {
      name: data.name,
      description: data.description,
      protocol: data.protocol || 'http',
      teamId: data.teamId,
      pathType,
      pathValue,
      method,
      grpcServiceType,
      grpcServiceValue,
      grpcMethodType,
      grpcMethodValue,
    },
    securityMode: data.securityMode || 'general',
    backends,
    headerMatches,
    queryParamMatches,
    requestHeaderModifiers,
    responseHeaderModifiers,
    routeType,
    securityPolicy: data.securityPolicy,
    backendTrafficPolicy: data.backendTrafficPolicy,
    extensionPolicy: data.extensionPolicy,
    wafPolicy: data.wafPolicy,
    redirect: config.redirect,
    directResponse: config.directResponse,
    urlRewrite: config.urlRewrite,
    mirrors: config.mirrors,
  };
}
