'use client';

import { useState } from 'react';
import type { RateLimitConfig, RateLimitRule, RateLimitSelector, RateLimitHeaderMatch } from '@/types';

interface RateLimitFormProps {
  value?: RateLimitConfig;
  onChange: (value: RateLimitConfig | undefined) => void;
  disabled?: boolean;
}

export default function RateLimitForm({ value, onChange, disabled }: RateLimitFormProps) {
  const [showSelectors, setShowSelectors] = useState(false);

  const isEnabled = !!value;
  const rule = value?.global?.rules?.[0];

  const updateRule = (updates: Partial<RateLimitRule>) => {
    const currentRule = rule || { limit: { requests: 100, unit: 'Minute' as const } };
    const newRule = { ...currentRule, ...updates };
    onChange({
      global: {
        rules: [newRule],
      },
    });
  };

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      updateRule({});
    } else {
      onChange(undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="rateLimitEnabled"
          checked={isEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="rateLimitEnabled" className="text-sm font-medium text-gray-700">
          Enable Rate Limiting
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Limit the number of requests allowed within a time window.
      </p>

      {isEnabled && (
        <div className="space-y-4 pt-4 border-t">
          {/* Basic rate limit */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Requests</label>
              <input
                type="number"
                min={1}
                value={rule?.limit.requests || 100}
                onChange={(e) => updateRule({ limit: { requests: parseInt(e.target.value) || 1, unit: rule?.limit.unit || 'Minute' } })}
                disabled={disabled}
                className="w-32 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Per</label>
              <select
                value={rule?.limit.unit || 'Minute'}
                onChange={(e) => updateRule({ limit: { requests: rule?.limit.requests || 100, unit: e.target.value as 'Second' | 'Minute' | 'Hour' | 'Day' } })}
                disabled={disabled}
                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="Second">Second</option>
                <option value="Minute">Minute</option>
                <option value="Hour">Hour</option>
                <option value="Day">Day</option>
              </select>
            </div>
          </div>

          {/* Client Selectors Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowSelectors(!showSelectors)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              {showSelectors ? '- Hide' : '+ Show'} Client Selectors (Advanced)
            </button>
          </div>

          {/* Client Selectors */}
          {showSelectors && (
            <ClientSelectorsForm
              selectors={rule?.clientSelectors || []}
              onChange={(selectors) => updateRule({ clientSelectors: selectors.length > 0 ? selectors : undefined })}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface ClientSelectorsFormProps {
  selectors: RateLimitSelector[];
  onChange: (selectors: RateLimitSelector[]) => void;
  disabled?: boolean;
}

function ClientSelectorsForm({ selectors, onChange, disabled }: ClientSelectorsFormProps) {
  const addSelector = () => {
    onChange([...selectors, {}]);
  };

  const updateSelector = (index: number, updates: Partial<RateLimitSelector>) => {
    const newSelectors = [...selectors];
    newSelectors[index] = { ...newSelectors[index], ...updates };
    onChange(newSelectors);
  };

  const removeSelector = (index: number) => {
    onChange(selectors.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 pl-4 border-l-2 border-gray-200">
      <p className="text-xs text-gray-500">
        Client selectors define which requests count toward the rate limit.
        Multiple selectors are OR&apos;d together.
      </p>

      {selectors.map((selector, index) => (
        <div key={index} className="p-3 bg-gray-50 rounded-md space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Selector {index + 1}</span>
            <button
              type="button"
              onClick={() => removeSelector(index)}
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>

          {/* Headers */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Headers</label>
            <HeadersForm
              headers={selector.headers || []}
              onChange={(headers) => updateSelector(index, { headers: headers.length > 0 ? headers : undefined })}
              disabled={disabled}
            />
          </div>

          {/* Source CIDR */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source CIDR</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., 192.168.1.0/24"
                value={selector.sourceCIDR?.value || ''}
                onChange={(e) => updateSelector(index, {
                  sourceCIDR: e.target.value ? { value: e.target.value, type: selector.sourceCIDR?.type } : undefined
                })}
                disabled={disabled}
                className="flex-1 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <select
                value={selector.sourceCIDR?.type || 'Exact'}
                onChange={(e) => updateSelector(index, {
                  sourceCIDR: selector.sourceCIDR?.value ? { ...selector.sourceCIDR, type: e.target.value as 'Exact' | 'Distinct' } : undefined
                })}
                disabled={disabled || !selector.sourceCIDR?.value}
                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="Exact">Exact</option>
                <option value="Distinct">Distinct</option>
              </select>
            </div>
          </div>

          {/* Path Match */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Path Match</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., /api/v1"
                value={selector.path?.value || ''}
                onChange={(e) => updateSelector(index, {
                  path: e.target.value ? { value: e.target.value, type: selector.path?.type || 'PathPrefix' } : undefined
                })}
                disabled={disabled}
                className="flex-1 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <select
                value={selector.path?.type || 'PathPrefix'}
                onChange={(e) => updateSelector(index, {
                  path: selector.path?.value ? { ...selector.path, type: e.target.value as 'Exact' | 'PathPrefix' | 'RegularExpression' } : undefined
                })}
                disabled={disabled || !selector.path?.value}
                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="Exact">Exact</option>
                <option value="PathPrefix">PathPrefix</option>
                <option value="RegularExpression">RegularExpression</option>
              </select>
            </div>
          </div>

          {/* Methods */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">HTTP Methods</label>
            <input
              type="text"
              placeholder="e.g., GET, POST, PUT"
              value={selector.methods?.join(', ') || ''}
              onChange={(e) => {
                const methods = e.target.value.split(',').map(m => m.trim().toUpperCase()).filter(m => m);
                updateSelector(index, { methods: methods.length > 0 ? methods : undefined });
              }}
              disabled={disabled}
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addSelector}
        disabled={disabled}
        className="text-sm text-primary-600 hover:text-primary-800"
      >
        + Add Selector
      </button>
    </div>
  );
}

interface HeadersFormProps {
  headers: RateLimitHeaderMatch[];
  onChange: (headers: RateLimitHeaderMatch[]) => void;
  disabled?: boolean;
}

function HeadersForm({ headers, onChange, disabled }: HeadersFormProps) {
  const addHeader = () => {
    onChange([...headers, { name: '', type: 'Exact' }]);
  };

  const updateHeader = (index: number, updates: Partial<RateLimitHeaderMatch>) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], ...updates };
    onChange(newHeaders);
  };

  const removeHeader = (index: number) => {
    onChange(headers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {headers.map((header, index) => (
        <div key={index} className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            placeholder="Header name"
            value={header.name}
            onChange={(e) => updateHeader(index, { name: e.target.value })}
            disabled={disabled}
            className="flex-1 min-w-24 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            type="text"
            placeholder="Value (optional)"
            value={header.value || ''}
            onChange={(e) => updateHeader(index, { value: e.target.value || undefined })}
            disabled={disabled}
            className="flex-1 min-w-24 rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <select
            value={header.type || 'Exact'}
            onChange={(e) => updateHeader(index, { type: e.target.value as 'Exact' | 'Distinct' })}
            disabled={disabled}
            className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="Exact">Exact</option>
            <option value="Distinct">Distinct</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={header.invert || false}
              onChange={(e) => updateHeader(index, { invert: e.target.checked || undefined })}
              disabled={disabled}
              className="rounded border-gray-300"
            />
            Invert
          </label>
          <button
            type="button"
            onClick={() => removeHeader(index)}
            disabled={disabled}
            className="text-red-600 hover:text-red-800"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addHeader}
        disabled={disabled}
        className="text-xs text-primary-600 hover:text-primary-800"
      >
        + Add Header
      </button>
    </div>
  );
}
