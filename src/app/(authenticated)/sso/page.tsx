'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagInput } from '@/components/ui/tag-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ssoApi } from '@/lib/api/sso';
import type { SSOConfig, SSOConfigInput } from '@/types';
import { Shield, AlertTriangle } from 'lucide-react';

export default function SSOPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState<SSOConfig | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState<string[]>(['openid', 'email', 'profile']);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [autoRegister, setAutoRegister] = useState(true);
  const [forceSSO, setForceSSO] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        const ssoData = await ssoApi.getConfig();
        setConfig(ssoData);
        populateForm(ssoData);
      } catch {
        // SSO not configured yet - that's fine, use defaults
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (ssoData: SSOConfig) => {
    setEnabled(ssoData.enabled);
    setProviderName(ssoData.providerName);
    setIssuerUrl(ssoData.issuerUrl);
    setClientId(ssoData.clientId);
    setClientSecret('');
    setScopes(ssoData.scopes && ssoData.scopes.length > 0 ? ssoData.scopes : ['openid', 'email', 'profile']);
    setAllowedDomains(ssoData.allowedDomains && ssoData.allowedDomains.length > 0 ? ssoData.allowedDomains : []);
    setAllowedEmails(ssoData.allowedEmails && ssoData.allowedEmails.length > 0 ? ssoData.allowedEmails : []);
    setAutoRegister(ssoData.autoRegister);
    setForceSSO(ssoData.forceSSO);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!providerName.trim()) {
      setError('Provider name is required');
      return;
    }
    if (!issuerUrl.trim()) {
      setError('Issuer URL is required');
      return;
    }
    if (!clientId.trim()) {
      setError('Client ID is required');
      return;
    }
    if (!config && !clientSecret.trim()) {
      setError('Client secret is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      const input: SSOConfigInput = {
        enabled,
        providerName: providerName.trim(),
        issuerUrl: issuerUrl.trim(),
        clientId: clientId.trim(),
        scopes,
        allowedDomains,
        allowedEmails,
        autoRegister,
        forceSSO,
      };

      if (clientSecret.trim()) {
        input.clientSecret = clientSecret.trim();
      }

      const updated = await ssoApi.updateConfig(input);
      setConfig(updated);
      populateForm(updated);
      setSuccess('SSO configuration saved successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save SSO configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable SSO? Users who signed in via SSO will no longer be able to log in until SSO is re-enabled.')) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      setDisabling(true);
      await ssoApi.disable();
      setConfig(null);
      setEnabled(false);
      setProviderName('');
      setIssuerUrl('');
      setClientId('');
      setClientSecret('');
      setScopes(['openid', 'email', 'profile']);
      setAllowedDomains([]);
      setAllowedEmails([]);
      setAutoRegister(true);
      setForceSSO(false);
      setSuccess('SSO has been disabled');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disable SSO');
    } finally {
      setDisabling(false);
    }
  };

  const emailDomainWarning = (() => {
    if (allowedEmails.length === 0 || allowedDomains.length === 0) return null;
    const mismatchedEmails = allowedEmails.filter(email => {
      const domain = email.split('@')[1]?.toLowerCase();
      return domain && !allowedDomains.some(d => d.toLowerCase() === domain);
    });
    if (mismatchedEmails.length === 0) return null;
    return `These emails have domains not in the allowed domains list and will always be rejected: ${mismatchedEmails.join(', ')}`;
  })();

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold">Single Sign-On (SSO)</h1>
          <p className="text-gray-500">Configure OIDC-based single sign-on for your organization</p>
        </div>
        {config && (
          <Badge variant={config.enabled ? 'success' : 'default'} className="ml-auto">
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* SSO Configuration Form */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">SSO Configuration</h2>

        <div className="space-y-5">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="sso-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <label htmlFor="sso-enabled" className="text-sm font-medium text-gray-700 cursor-pointer">
              Enable SSO
            </label>
          </div>

          {/* Provider Name */}
          <Input
            id="provider-name"
            label="Provider Name"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g., Google Workspace, Okta, Auth0"
          />

          {/* Issuer URL */}
          <Input
            id="issuer-url"
            label="Issuer URL"
            value={issuerUrl}
            onChange={(e) => setIssuerUrl(e.target.value)}
            placeholder="e.g., https://accounts.google.com"
          />

          {/* Client ID */}
          <Input
            id="client-id"
            label="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your OIDC client ID"
          />

          {/* Client Secret */}
          <Input
            id="client-secret"
            label="Client Secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={config ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (leave blank to keep current)' : 'Your OIDC client secret'}
          />
          {config && (
            <p className="text-xs text-gray-500 -mt-3">
              Leave blank to keep the existing client secret
            </p>
          )}

          {/* Scopes */}
          <TagInput
            id="scopes"
            label="Scopes"
            value={scopes}
            onChange={setScopes}
            placeholder="Type a scope and press Enter"
          />

          {/* Allowed Domains */}
          <TagInput
            id="allowed-domains"
            label="Allowed Domains"
            value={allowedDomains}
            onChange={setAllowedDomains}
            placeholder="Type a domain and press Enter"
          />
          <p className="text-xs text-gray-500 -mt-3">
            Leave empty to allow all domains.
          </p>

          {/* Allowed Emails */}
          <TagInput
            id="allowed-emails"
            label="Allowed Emails"
            value={allowedEmails}
            onChange={setAllowedEmails}
            placeholder="Type an email and press Enter"
          />
          <p className="text-xs text-gray-500 -mt-3">
            Leave empty to allow all emails (that pass domain check).
          </p>
          {emailDomainWarning && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              {emailDomainWarning}
            </div>
          )}

          {/* Auto Register */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="auto-register"
              checked={autoRegister}
              onChange={(e) => setAutoRegister(e.target.checked)}
            />
            <label htmlFor="auto-register" className="text-sm font-medium text-gray-700 cursor-pointer">
              Auto-register new users
            </label>
          </div>
          <p className="text-xs text-gray-500 -mt-3">
            Automatically create accounts for users who sign in via SSO for the first time
          </p>

          {/* Force SSO */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="force-sso"
              checked={forceSSO}
              onChange={(e) => setForceSSO(e.target.checked)}
            />
            <label htmlFor="force-sso" className="text-sm font-medium text-gray-700 cursor-pointer">
              Force SSO for matching domains
            </label>
          </div>
          {forceSSO && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded -mt-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                Users with matching email domains will be forced to use SSO. Password login will be disabled for those users.
                The system owner always retains password login access.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-6 pt-6 border-t">
          <Button onClick={handleSave} disabled={saving || disabling}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>

          {config && config.enabled && (
            <Button variant="danger" onClick={handleDisable} disabled={saving || disabling}>
              {disabling ? 'Disabling...' : 'Disable SSO'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
