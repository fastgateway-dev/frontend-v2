'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui';
import { certificateIssuersApi } from '@/lib/api/certificate-issuers';
import { dnsCredentialsApi } from '@/lib/api/dns-credentials';
import type { DNSProviderCredential, IssuerType } from '@/types';

const ACME_SERVER_PRESETS = [
  { value: 'https://acme-v02.api.letsencrypt.org/directory', label: "Let's Encrypt Production" },
  { value: 'https://acme-staging-v02.api.letsencrypt.org/directory', label: "Let's Encrypt Staging" },
  { value: 'https://acme.zerossl.com/v2/DV90', label: 'ZeroSSL' },
  { value: 'custom', label: 'Custom URL…' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CreateCertificateIssuerPage() {
  const router = useRouter();

  const [type, setType] = useState<IssuerType>('self_signed_ca');
  const [name, setName] = useState('');

  // Self-signed CA fields
  const [commonName, setCommonName] = useState('');
  const [keyAlgorithm, setKeyAlgorithm] = useState<'RSA' | 'ECDSA'>('RSA');
  const [keySize, setKeySize] = useState('2048');
  const [durationDays, setDurationDays] = useState('3650');

  // ACME fields
  const [serverPreset, setServerPreset] = useState(ACME_SERVER_PRESETS[0].value);
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [dnsCredentialId, setDnsCredentialId] = useState('');
  const [eabKeyId, setEabKeyId] = useState('');
  const [eabHmacKey, setEabHmacKey] = useState('');

  const [dnsCredentials, setDnsCredentials] = useState<DNSProviderCredential[]>([]);
  const [isLoadingDnsCredentials, setIsLoadingDnsCredentials] = useState(true);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    dnsCredentialsApi
      .list()
      .then(setDnsCredentials)
      .catch(() => setDnsCredentials([]))
      .finally(() => setIsLoadingDnsCredentials(false));
  }, []);

  const handleKeyAlgorithmChange = (value: 'RSA' | 'ECDSA') => {
    setKeyAlgorithm(value);
    setKeySize(value === 'RSA' ? '2048' : '256');
  };

  const keySizeOptions =
    keyAlgorithm === 'RSA'
      ? [
          { value: '2048', label: '2048' },
          { value: '4096', label: '4096' },
        ]
      : [
          { value: '256', label: '256' },
          { value: '384', label: '384' },
        ];

  const resolvedServer = serverPreset === 'custom' ? customServerUrl.trim() : serverPreset;

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required';

    if (type === 'self_signed_ca') {
      if (!commonName.trim()) errors.commonName = 'Common Name is required';
    } else {
      if (!resolvedServer) errors.server = 'ACME server URL is required';
      if (!email.trim()) {
        errors.email = 'Email is required';
      } else if (!EMAIL_REGEX.test(email.trim())) {
        errors.email = 'Enter a valid email address';
      }
      if (!dnsCredentialId) errors.dnsCredentialId = 'Select a DNS credential';
    }

    return errors;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const created =
        type === 'self_signed_ca'
          ? await certificateIssuersApi.create({
              type: 'self_signed_ca',
              name: name.trim(),
              commonName: commonName.trim(),
              keyAlgorithm,
              keySize: Number(keySize),
              durationDays: Number(durationDays),
            })
          : await certificateIssuersApi.create({
              type: 'acme',
              name: name.trim(),
              server: resolvedServer,
              email: email.trim(),
              dnsCredentialId,
              ...(eabKeyId.trim() && eabHmacKey.trim()
                ? { eab: { keyId: eabKeyId.trim(), hmacKey: eabHmacKey.trim() } }
                : {}),
            });
      router.push(`/certificate-issuers/${created.id}`);
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to create certificate issuer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const blockedByMissingDnsCredentials =
    type === 'acme' && !isLoadingDnsCredentials && dnsCredentials.length === 0;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/certificate-issuers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Certificate Issuers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Certificate Issuer</h1>
        <p className="text-gray-600 mt-1">
          Configure a new certificate issuer for signing TLS certificates
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-5">
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {submitError}
              </div>
            )}

            <Select
              id="issuer-type"
              label="Issuer Type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as IssuerType);
                setFormErrors({});
              }}
              options={[
                { value: 'self_signed_ca', label: 'Self-signed CA' },
                { value: 'acme', label: 'ACME' },
              ]}
            />

            <Input
              id="issuer-name"
              label="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g., Internal CA, Production ACME"
              error={formErrors.name}
            />

            {type === 'self_signed_ca' ? (
              <div className="space-y-4 border-t border-gray-200 pt-5">
                <h3 className="text-sm font-medium text-gray-900">Self-signed CA Settings</h3>

                <Input
                  id="common-name"
                  label="Common Name"
                  value={commonName}
                  onChange={(e) => {
                    setCommonName(e.target.value);
                    setFormErrors((prev) => ({ ...prev, commonName: '' }));
                  }}
                  placeholder="e.g., internal-ca"
                  error={formErrors.commonName}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    id="key-algorithm"
                    label="Key Algorithm"
                    value={keyAlgorithm}
                    onChange={(e) => handleKeyAlgorithmChange(e.target.value as 'RSA' | 'ECDSA')}
                    options={[
                      { value: 'RSA', label: 'RSA' },
                      { value: 'ECDSA', label: 'ECDSA' },
                    ]}
                  />

                  <Select
                    id="key-size"
                    label="Key Size"
                    value={keySize}
                    onChange={(e) => setKeySize(e.target.value)}
                    options={keySizeOptions}
                  />
                </div>

                <Input
                  id="duration-days"
                  label="Duration (days)"
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  min={1}
                />
              </div>
            ) : (
              <div className="space-y-4 border-t border-gray-200 pt-5">
                <h3 className="text-sm font-medium text-gray-900">ACME Settings</h3>

                <Select
                  id="acme-server"
                  label="ACME Server"
                  value={serverPreset}
                  onChange={(e) => {
                    setServerPreset(e.target.value);
                    setFormErrors((prev) => ({ ...prev, server: '' }));
                  }}
                  options={ACME_SERVER_PRESETS}
                  error={serverPreset === 'custom' ? undefined : formErrors.server}
                />

                {serverPreset === 'custom' && (
                  <Input
                    id="custom-server-url"
                    label="Custom Server URL"
                    value={customServerUrl}
                    onChange={(e) => {
                      setCustomServerUrl(e.target.value);
                      setFormErrors((prev) => ({ ...prev, server: '' }));
                    }}
                    placeholder="https://example.com/acme/directory"
                    error={!customServerUrl.trim() ? formErrors.server : undefined}
                  />
                )}

                <Input
                  id="acme-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFormErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  placeholder="admin@example.com"
                  error={formErrors.email}
                />

                {isLoadingDnsCredentials ? (
                  <div className="text-sm text-gray-500">Loading DNS credentials...</div>
                ) : dnsCredentials.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      No DNS credentials available.{' '}
                      <Link href="/dns-credentials" className="underline font-medium">
                        Add a DNS credential
                      </Link>{' '}
                      before creating an ACME issuer.
                    </p>
                  </div>
                ) : (
                  <Select
                    id="dns-credential"
                    label="DNS Credential"
                    value={dnsCredentialId}
                    onChange={(e) => {
                      setDnsCredentialId(e.target.value);
                      setFormErrors((prev) => ({ ...prev, dnsCredentialId: '' }));
                    }}
                    options={[
                      { value: '', label: 'Select a DNS credential...' },
                      ...dnsCredentials.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                    error={formErrors.dnsCredentialId}
                  />
                )}

                <Accordion type="single">
                  <AccordionItem value="eab">
                    <AccordionTrigger value="eab">External Account Binding (optional)</AccordionTrigger>
                    <AccordionContent value="eab">
                      <div className="space-y-4">
                        <p className="text-xs text-gray-500">
                          Required only by ACME servers (like ZeroSSL) that need External Account Binding.
                        </p>
                        <Input
                          id="eab-key-id"
                          label="EAB Key ID"
                          value={eabKeyId}
                          onChange={(e) => setEabKeyId(e.target.value)}
                          placeholder="Key ID"
                        />
                        <Input
                          id="eab-hmac-key"
                          label="EAB HMAC Key"
                          type="password"
                          value={eabHmacKey}
                          onChange={(e) => setEabHmacKey(e.target.value)}
                          placeholder="HMAC Key"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Link href="/certificate-issuers">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={blockedByMissingDnsCredentials}
              >
                Create Issuer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
