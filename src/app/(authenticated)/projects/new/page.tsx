'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Info, Upload } from 'lucide-react';
import { Button, Input, Card, CardContent, CardFooter } from '@/components/ui';
import { LabelsEditor } from '@/components/ui/labels-editor';
import { projectsApi } from '@/lib/api';
import type { CreateProjectInput, ConnectionType, TLSVerification } from '@/types';

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>('api_token');
  const [tlsVerification, setTlsVerification] = useState<TLSVerification>('skip');
  const [labels, setLabels] = useState<Record<string, string>>({});

  const { register, handleSubmit, getValues, setValue, formState: { errors } } = useForm<CreateProjectInput>({
    defaultValues: {
      connectionType: 'api_token',
    }
  });

  const onTestConnection = async () => {
    const values = getValues();

    // Validate based on connection type
    if (connectionType === 'api_token' && (!values.k8sApiUrl || !values.k8sToken)) {
      setTestResult({ success: false, message: 'Please fill in API URL and token first' });
      return;
    }
    if (connectionType === 'kubeconfig' && !values.kubeconfig) {
      setTestResult({ success: false, message: 'Please provide a kubeconfig first' });
      return;
    }

    setIsLoading(true);
    setSubmitError(null);
    setTestResult(null);
    try {
      const project = await projectsApi.create({
        ...values,
        connectionType,
        tlsVerification: connectionType === 'api_token' ? tlsVerification : undefined,
        labels: Object.keys(labels).length > 0 ? labels : undefined,
      });
      const result = await projectsApi.testConnection(project.id);
      setTestResult(result);
      if (!result.success) {
        await projectsApi.delete(project.id);
      } else {
        router.push(`/projects/${project.id}/domains`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to connect to Kubernetes cluster';
      setSubmitError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: CreateProjectInput) => {
    setIsLoading(true);
    setSubmitError(null);
    setTestResult(null);
    try {
      const project = await projectsApi.create({
        ...data,
        connectionType,
        tlsVerification: connectionType === 'api_token' ? tlsVerification : undefined,
        labels: Object.keys(labels).length > 0 ? labels : undefined,
      });
      router.push(`/projects/${project.id}/domains`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to create project';
      setSubmitError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setValue('kubeconfig', content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/projects" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <Input
              id="name"
              label="Project Name"
              placeholder="e.g., Production Cluster"
              {...register('name', { required: 'Project name is required' })}
              error={errors.name?.message}
            />

            <Input
              id="description"
              label="Description"
              placeholder="Optional description"
              {...register('description')}
            />

            <LabelsEditor labels={labels} onChange={setLabels} />

            <div className="pt-4 border-t">
              <h3 className="font-medium text-gray-900 mb-4">Connection Type</h3>

              <div className="space-y-3">
                {/* In-Cluster Option */}
                <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${connectionType === 'in_cluster' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="connectionType"
                    value="in_cluster"
                    checked={connectionType === 'in_cluster'}
                    onChange={() => setConnectionType('in_cluster')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">In-Cluster (Local)</div>
                    <div className="text-sm text-gray-500">Connect to the Kubernetes cluster where FastGateway is deployed. No configuration required.</div>
                  </div>
                </label>

                {/* Kubeconfig Option */}
                <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${connectionType === 'kubeconfig' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="connectionType"
                    value="kubeconfig"
                    checked={connectionType === 'kubeconfig'}
                    onChange={() => setConnectionType('kubeconfig')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Kubeconfig</div>
                    <div className="text-sm text-gray-500">Upload or paste a kubeconfig file with static credentials (token or client certificate).</div>
                  </div>
                </label>

                {/* API URL + Token Option */}
                <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${connectionType === 'api_token' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="connectionType"
                    value="api_token"
                    checked={connectionType === 'api_token'}
                    onChange={() => setConnectionType('api_token')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">API URL + Token</div>
                    <div className="text-sm text-gray-500">Manually enter Kubernetes API server URL and service account token.</div>
                  </div>
                </label>
              </div>
            </div>

            {/* In-Cluster Info */}
            {connectionType === 'in_cluster' && (
              <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <Info className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-primary-800">
                  FastGateway will use its service account to connect to the local Kubernetes cluster.
                  No additional configuration is needed.
                </div>
              </div>
            )}

            {/* Kubeconfig Fields */}
            {connectionType === 'kubeconfig' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kubeconfig File
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">Upload File</span>
                      <input
                        type="file"
                        accept=".yaml,.yml,.conf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-sm text-gray-500">or paste below</span>
                  </div>
                  <textarea
                    id="kubeconfig"
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                    placeholder="apiVersion: v1&#10;kind: Config&#10;clusters:&#10;  - cluster:&#10;      server: https://..."
                    {...register('kubeconfig')}
                  />
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    Exec-based authentication (EKS/GKE/AKS CLI) is not supported. Use a kubeconfig with static token or client certificate.
                  </div>
                </div>
              </div>
            )}

            {/* API Token Fields */}
            {connectionType === 'api_token' && (
              <div className="space-y-4">
                <Input
                  id="k8sApiUrl"
                  label="API Server URL"
                  placeholder="https://k8s-api.example.com:6443"
                  {...register('k8sApiUrl')}
                  error={errors.k8sApiUrl?.message}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Account Token (JWT)
                  </label>
                  <textarea
                    id="k8sToken"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                    placeholder="eyJhbGciOiJSUzI1NiIs..."
                    {...register('k8sToken')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    TLS Verification
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="tlsVerification"
                        value="system_ca"
                        checked={tlsVerification === 'system_ca'}
                        onChange={() => setTlsVerification('system_ca')}
                      />
                      <span className="text-sm text-gray-700">Verify with system CAs</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="tlsVerification"
                        value="custom_ca"
                        checked={tlsVerification === 'custom_ca'}
                        onChange={() => setTlsVerification('custom_ca')}
                      />
                      <span className="text-sm text-gray-700">Custom CA certificate</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="tlsVerification"
                        value="skip"
                        checked={tlsVerification === 'skip'}
                        onChange={() => setTlsVerification('skip')}
                      />
                      <span className="text-sm text-gray-700">Skip verification (insecure)</span>
                    </label>
                  </div>
                </div>

                {tlsVerification === 'custom_ca' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CA Certificate (PEM)
                    </label>
                    <textarea
                      id="k8sCaCert"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                      placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDdzCCAl+gAwIBAgIEbB...&#10;-----END CERTIFICATE-----"
                      {...register('k8sCaCert')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Failed to onboard cluster</h4>
                    <p className="mt-1 text-sm text-red-700 whitespace-pre-wrap">{submitError}</p>
                    {submitError.includes('Prerequisites not met') && (
                      <div className="mt-3 p-3 bg-red-100 rounded text-sm text-red-800">
                        <p className="font-medium mb-2">Before onboarding, please ensure:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>
                            Install Gateway API CRDs:
                            <code className="block mt-1 p-2 bg-white rounded text-xs font-mono break-all">
                              kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml
                            </code>
                          </li>
                          <li className="mt-2">
                            Create the namespace:
                            <code className="block mt-1 p-2 bg-white rounded text-xs font-mono">
                              kubectl create namespace fastgateway-system
                            </code>
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  testResult.success
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                {testResult.message}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="secondary" onClick={onTestConnection} isLoading={isLoading}>
              Test Connection
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Project
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
