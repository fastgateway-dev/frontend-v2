'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import {
  Button, Card, CardContent, Input, Select, TagInput,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui';
import { certificatesApi, projectsApi } from '@/lib/api';
import { validateCreateCertificate } from '@/lib/utils/certificates';
import type { Project, CertificateIssuer, CreateCertificateInput, ManagedCertUsage } from '@/types';

export default function CreateCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [issuers, setIssuers] = useState<CertificateIssuer[]>([]);
  const [issuersError, setIssuersError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [issuerId, setIssuerId] = useState('');
  const [usage, setUsage] = useState<ManagedCertUsage>('server');
  const [dnsNames, setDnsNames] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [keyAlgorithm, setKeyAlgorithm] = useState('');
  const [keySize, setKeySize] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Submit state
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setIsLoading(true);
    setIssuersError(null);
    try {
      const [projectData, issuersData] = await Promise.all([
        projectsApi.get(projectId),
        certificatesApi.issuersForProject(projectId).catch((error): CertificateIssuer[] => {
          console.error('Failed to load issuers:', error);
          setIssuersError('Failed to load issuers.');
          return [];
        }),
      ]);
      setProject(projectData);
      setIssuers(issuersData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildInput = (): CreateCertificateInput => {
    const input: CreateCertificateInput = {
      name: name.trim(),
      issuerId,
      usage,
    };
    if (usage === 'server') {
      input.dnsNames = dnsNames;
    } else {
      input.subject = subject.trim();
    }
    if (keyAlgorithm.trim()) input.keyAlgorithm = keyAlgorithm.trim();
    if (keySize.trim()) input.keySize = Number(keySize);
    if (durationDays.trim()) input.durationDays = Number(durationDays);
    return input;
  };

  const handleSubmit = async () => {
    setCreateError(null);

    const input = buildInput();
    const errors = validateCreateCertificate(input);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsCreating(true);
    try {
      const { certificate } = await certificatesApi.create(projectId, input);
      router.push(`/projects/${projectId}/certificates/${certificate.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setCreateError(error.response?.data?.error || 'Failed to create certificate');
    } finally {
      setIsCreating(false);
    }
  };

  const noIssuersGranted = !isLoading && !issuersError && issuers.length === 0;
  const issuersUnavailable = noIssuersGranted || !!issuersError;

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
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}/certificates`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Certificates
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Certificate</h1>
        <p className="text-gray-600 mt-1">{project?.name}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-5">
            {issuersError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{issuersError}</p>
              </div>
            )}

            {noIssuersGranted && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  No certificate issuers are granted to this project — ask an owner to grant one.
                </p>
              </div>
            )}

            <Input
              id="name"
              label="Name"
              placeholder="e.g., api-server-cert"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormErrors((prev) => ({ ...prev, name: '' }));
              }}
              error={formErrors.name}
            />

            <Select
              id="issuerId"
              label="Issuer"
              value={issuerId}
              onChange={(e) => {
                setIssuerId(e.target.value);
                setFormErrors((prev) => ({ ...prev, issuerId: '' }));
              }}
              options={[
                { value: '', label: 'Select an issuer...' },
                ...issuers.map((issuer) => ({ value: issuer.id, label: issuer.name })),
              ]}
              error={formErrors.issuerId}
              disabled={issuersUnavailable}
            />

            <Select
              id="usage"
              label="Usage"
              value={usage}
              onChange={(e) => setUsage(e.target.value as ManagedCertUsage)}
              options={[
                { value: 'server', label: 'Server' },
                { value: 'client', label: 'Client' },
              ]}
            />

            {usage === 'server' ? (
              <TagInput
                id="dnsNames"
                label="DNS Names"
                placeholder="Type a hostname and press Enter"
                value={dnsNames}
                onChange={(tags) => {
                  setDnsNames(tags);
                  setFormErrors((prev) => ({ ...prev, dnsNames: '' }));
                }}
                error={formErrors.dnsNames}
              />
            ) : (
              <Input
                id="subject"
                label="Subject"
                placeholder="e.g., CN=client-01"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setFormErrors((prev) => ({ ...prev, subject: '' }));
                }}
                error={formErrors.subject}
              />
            )}

            <Accordion type="single">
              <AccordionItem value="advanced">
                <AccordionTrigger value="advanced">Advanced</AccordionTrigger>
                <AccordionContent value="advanced">
                  <div className="space-y-4">
                    <Select
                      id="keyAlgorithm"
                      label="Key Algorithm"
                      value={keyAlgorithm}
                      onChange={(e) => setKeyAlgorithm(e.target.value)}
                      options={[
                        { value: '', label: 'Default (RSA)' },
                        { value: 'RSA', label: 'RSA' },
                        { value: 'ECDSA', label: 'ECDSA' },
                      ]}
                    />
                    <Input
                      id="keySize"
                      label="Key Size"
                      type="number"
                      placeholder="Default: 2048"
                      value={keySize}
                      onChange={(e) => setKeySize(e.target.value)}
                    />
                    <Input
                      id="durationDays"
                      label="Duration (days)"
                      type="number"
                      placeholder="Default: 90"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {createError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Failed to create certificate</h4>
                    <p className="mt-1 text-sm text-red-700">{createError}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/projects/${projectId}/certificates`}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button onClick={handleSubmit} isLoading={isCreating} disabled={issuersUnavailable}>
                Create Certificate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
