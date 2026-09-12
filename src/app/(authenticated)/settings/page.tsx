'use client';

import { useState, useEffect } from 'react';
import { systemSettingsApi } from '@/lib/api/systemSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Check, AlertCircle } from 'lucide-react';
import type { SystemSettingsResponse } from '@/types';

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [baseUrl, setBaseUrl] = useState('');
  const [jwtExpiry, setJwtExpiry] = useState('');
  const [refreshTokenExpiry, setRefreshTokenExpiry] = useState('');
  const [logLevel, setLogLevel] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await systemSettingsApi.get();
      setSettings(data);
      setBaseUrl(data.baseUrl);
      setJwtExpiry(data.jwtExpiry);
      setRefreshTokenExpiry(data.refreshTokenExpiry);
      setLogLevel(data.logLevel);
    } catch {
      setError('Failed to load system settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const data = await systemSettingsApi.update({
        baseUrl,
        jwtExpiry,
        refreshTokenExpiry,
        logLevel,
      });
      setSettings(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Configure runtime settings for FastGateway</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" />
          Settings saved successfully
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base URL
              </label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://fastgateway.example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Public URL for SSO callback and external links.
                {settings?.effective.baseUrl && !baseUrl && (
                  <span className="ml-1 text-gray-400">
                    Default: {settings.effective.baseUrl}
                  </span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                JWT Expiry
              </label>
              <Input
                value={jwtExpiry}
                onChange={(e) => setJwtExpiry(e.target.value)}
                placeholder="24h"
              />
              <p className="mt-1 text-xs text-gray-500">
                Go duration format (e.g., 1h, 24h, 720h).
                {settings?.effective.jwtExpiry && !jwtExpiry && (
                  <span className="ml-1 text-gray-400">
                    Default: {settings.effective.jwtExpiry}
                  </span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refresh Token Expiry
              </label>
              <Input
                value={refreshTokenExpiry}
                onChange={(e) => setRefreshTokenExpiry(e.target.value)}
                placeholder="168h"
              />
              <p className="mt-1 text-xs text-gray-500">
                Go duration format (e.g., 168h, 720h).
                {settings?.effective.refreshTokenExpiry && !refreshTokenExpiry && (
                  <span className="ml-1 text-gray-400">
                    Default: {settings.effective.refreshTokenExpiry}
                  </span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Log Level
              </label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">
                  Use default{settings?.effective.logLevel && !logLevel ? ` (${settings.effective.logLevel})` : ''}
                </option>
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Backend logging verbosity level.
              </p>
            </div>
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
