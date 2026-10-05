'use client';

import { useState, useEffect } from 'react';
import { aiApi } from '@/lib/api/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, AlertCircle } from 'lucide-react';
import type { AIConfig, AIConfigInput, AIProvider } from '@/types';

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai_compatible', label: 'OpenAI-compatible' },
];

const DEFAULT_MODEL: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  deepseek: 'gpt-4o',
  openai_compatible: '',
};

export function AISettingsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [apiKeySet, setApiKeySet] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [baseURL, setBaseURL] = useState('');

  useEffect(() => {
    load();
  }, []);

  const populate = (c: AIConfig) => {
    setApiKeySet(c.apiKeySet);
    setEnabled(c.enabled);
    setProvider(c.provider);
    setApiKey('');
    setModel(c.model);
    setMaxTokens(c.maxTokens || 4096);
    setBaseURL(c.baseURL);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await aiApi.getConfig();
      populate(data);
    } catch {
      // No config yet (or not reachable) — show the empty default form.
    } finally {
      setIsLoading(false);
    }
  };

  const buildInput = (): AIConfigInput => {
    const input: AIConfigInput = {
      enabled,
      provider,
      model,
      maxTokens: maxTokens > 0 ? maxTokens : 4096,
      baseURL: provider === 'openai_compatible' ? baseURL : '',
    };
    if (apiKey.trim()) {
      input.apiKey = apiKey.trim();
    }
    return input;
  };

  const handleTest = async () => {
    setIsTesting(true);
    setError(null);
    setSuccess(null);
    try {
      await aiApi.testConfig(buildInput());
      setSuccess('Connection successful');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await aiApi.updateConfig(buildInput());
      populate(data);
      setSuccess('AI settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to save AI settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-5 max-w-lg">
          <div className="flex items-center gap-3">
            <Checkbox
              id="ai-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <label htmlFor="ai-enabled" className="text-sm font-medium text-gray-700 cursor-pointer">
              Enable AI
            </label>
          </div>

          <div>
            <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-700 mb-1">
              Provider
            </label>
            <select
              id="ai-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <Input
              id="ai-api-key"
              label="API Key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeySet ? '•••••••• (leave blank to keep current)' : 'Your API key'}
            />
            {apiKeySet && (
              <p className="mt-1 text-xs text-gray-500">Leave blank to keep the existing API key.</p>
            )}
          </div>

          <Input
            id="ai-model"
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODEL[provider] || 'Model name'}
          />

          <Input
            id="ai-max-tokens"
            label="Max Tokens"
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            placeholder="4096"
          />

          {provider === 'openai_compatible' && (
            <Input
              id="ai-base-url"
              label="Base URL"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://your-endpoint.example.com"
            />
          )}

          <div className="flex items-center gap-4 pt-2">
            <Button type="submit" disabled={isSaving || isTesting}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleTest} disabled={isSaving || isTesting}>
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
