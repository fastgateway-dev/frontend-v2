'use client';

import { useState } from 'react';
import type { WafPolicyConfig } from '@/types';

interface WafPolicyFormProps {
  value?: WafPolicyConfig;
  onChange: (value: WafPolicyConfig | undefined) => void;
  disabled?: boolean;
}

const PARANOIA_LEVELS = [
  { value: 1, label: 'Level 1 (Default)', description: 'Basic protection, low false positives' },
  { value: 2, label: 'Level 2', description: 'More rules, moderate false positives' },
  { value: 3, label: 'Level 3', description: 'Stricter rules, higher false positives' },
  { value: 4, label: 'Level 4', description: 'Maximum protection, highest false positives' },
];

const DEFAULT_WAF_CONFIG: WafPolicyConfig = {
  mode: 'block',
  rulesets: ['owasp-crs'],
  anomalyThreshold: 5,
  paranoiaLevel: 1,
};

export default function WafPolicyForm({ value, onChange, disabled }: WafPolicyFormProps) {
  const [showCustomDirectives, setShowCustomDirectives] = useState(
    value?.customDirectives && value.customDirectives.length > 0
  );

  const isEnabled = !!value;

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange(DEFAULT_WAF_CONFIG);
    } else {
      onChange(undefined);
    }
  };

  const handleDisabledRulesChange = (input: string) => {
    if (!value) return;
    if (!input.trim()) {
      onChange({ ...value, disabledRuleIDs: undefined });
      return;
    }
    const ruleIDs = input
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));
    onChange({ ...value, disabledRuleIDs: ruleIDs.length > 0 ? ruleIDs : undefined });
  };

  const handleCustomDirectivesChange = (input: string) => {
    if (!value) return;
    if (!input.trim()) {
      onChange({ ...value, customDirectives: undefined });
      return;
    }
    const directives = input
      .split('\n')
      .map(s => s.trim())
      .filter(s => s !== '');
    onChange({ ...value, customDirectives: directives.length > 0 ? directives : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="wafEnabled"
          checked={isEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="wafEnabled" className="text-sm font-medium text-gray-700">Enable WAF Protection</label>
      </div>

      <p className="text-xs text-gray-500">
        Protect against common web attacks like SQL injection and XSS using Coraza WAF engine.
      </p>

      {isEnabled && value && (
        <div className="space-y-4 pt-4 border-t">

          {/* Mode Selection - Radio button cards */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'block' as const, label: 'Block', desc: 'Block malicious requests (recommended for production)' },
                { value: 'detect' as const, label: 'Detect', desc: 'Log threats but allow requests through (for testing)' },
              ]).map(option => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${
                    value.mode === option.value
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="waf-mode"
                    value={option.value}
                    checked={value.mode === option.value}
                    onChange={() => onChange({ ...value, mode: option.value })}
                    disabled={disabled}
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

          {/* Rulesets - Checkbox cards */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rulesets</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={value.rulesets?.includes('owasp-crs') ?? false}
                  onChange={(e) => {
                    const currentRulesets = value.rulesets || [];
                    if (e.target.checked) {
                      onChange({ ...value, rulesets: [...currentRulesets, 'owasp-crs'] });
                    } else {
                      onChange({ ...value, rulesets: currentRulesets.filter(r => r !== 'owasp-crs') });
                    }
                  }}
                  disabled={disabled}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">OWASP Core Rule Set (CRS)</span>
                  <p className="text-xs text-gray-500">Industry-standard protection against common web attacks</p>
                </div>
              </label>
            </div>
          </div>

          {/* Paranoia Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paranoia Level</label>
            <select
              value={value.paranoiaLevel ?? 1}
              onChange={(e) => onChange({ ...value, paranoiaLevel: parseInt(e.target.value, 10) })}
              disabled={disabled}
              className="w-full rounded-md border-gray-300 text-sm"
            >
              {PARANOIA_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} - {level.description}
                </option>
              ))}
            </select>
          </div>

          {/* Anomaly Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anomaly Threshold <span className="text-gray-400">(lower = stricter)</span>
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={value.anomalyThreshold ?? 5}
              onChange={(e) => onChange({ ...value, anomalyThreshold: parseInt(e.target.value, 10) || 5 })}
              disabled={disabled}
              className="w-full rounded-md border-gray-300 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Combined score threshold to trigger blocking. Default: 5
            </p>
          </div>

          {/* Disabled Rule IDs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Disabled Rule IDs <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., 920170, 920350, 942100"
              value={value.disabledRuleIDs?.join(', ') ?? ''}
              onChange={(e) => handleDisabledRulesChange(e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border-gray-300 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of rule IDs to disable (useful for reducing false positives)
            </p>
          </div>

          {/* Custom Directives */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setShowCustomDirectives(!showCustomDirectives)}
                disabled={disabled}
                className="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
              >
                {showCustomDirectives ? '- Hide Custom Directives' : '+ Add Custom Directives'}
              </button>
              <span className="text-xs text-gray-400">(advanced)</span>
            </div>
            {showCustomDirectives && (
              <div>
                <textarea
                  rows={4}
                  placeholder={`SecRule REQUEST_URI "@contains /api/upload" "id:1000,phase:1,pass,nolog,ctl:requestBodyLimit=52428800"\nSecRule REQUEST_HEADERS:User-Agent "@contains BadBot" "id:1001,phase:1,deny,status:403"`}
                  value={value.customDirectives?.join('\n') ?? ''}
                  onChange={(e) => handleCustomDirectivesChange(e.target.value)}
                  disabled={disabled}
                  className="w-full font-mono text-sm rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  One SecRule directive per line. Uses ModSecurity/Coraza syntax.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
