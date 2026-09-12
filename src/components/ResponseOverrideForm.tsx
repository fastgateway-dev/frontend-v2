'use client';

import type { ResponseOverrideRule, StatusCodeMatch } from '@/types';

interface ResponseOverrideFormProps {
  value?: ResponseOverrideRule[];
  onChange: (value: ResponseOverrideRule[] | undefined) => void;
  disabled?: boolean;
}

export default function ResponseOverrideForm({ value = [], onChange, disabled }: ResponseOverrideFormProps) {
  const addRule = () => {
    const newRule: ResponseOverrideRule = {
      match: { statusCodes: [{ type: 'Value', value: 404 }] },
      response: { contentType: 'text/plain', body: { type: 'Inline', inline: '' } },
    };
    onChange([...value, newRule]);
  };

  const updateRule = (index: number, updates: Partial<ResponseOverrideRule>) => {
    const newRules = [...value];
    newRules[index] = { ...newRules[index], ...updates };
    onChange(newRules);
  };

  const removeRule = (index: number) => {
    const newRules = value.filter((_, i) => i !== index);
    onChange(newRules.length > 0 ? newRules : undefined);
  };

  const addStatusCode = (ruleIndex: number) => {
    const rule = value[ruleIndex];
    const newStatusCodes = [...rule.match.statusCodes, { type: 'Value' as const, value: 500 }];
    updateRule(ruleIndex, { match: { statusCodes: newStatusCodes } });
  };

  const updateStatusCode = (ruleIndex: number, scIndex: number, updates: Partial<StatusCodeMatch>) => {
    const rule = value[ruleIndex];
    const newStatusCodes = [...rule.match.statusCodes];
    newStatusCodes[scIndex] = { ...newStatusCodes[scIndex], ...updates };
    updateRule(ruleIndex, { match: { statusCodes: newStatusCodes } });
  };

  const removeStatusCode = (ruleIndex: number, scIndex: number) => {
    const rule = value[ruleIndex];
    const newStatusCodes = rule.match.statusCodes.filter((_, i) => i !== scIndex);
    if (newStatusCodes.length > 0) {
      updateRule(ruleIndex, { match: { statusCodes: newStatusCodes } });
    }
  };

  return (
    <div className="space-y-4">
      {value.map((rule, ruleIndex) => (
        <div key={ruleIndex} className="p-4 border border-gray-200 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Override Rule {ruleIndex + 1}</span>
            <button
              type="button"
              onClick={() => removeRule(ruleIndex)}
              disabled={disabled}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove Rule
            </button>
          </div>

          {/* Status Codes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Match Status Codes</label>
            <div className="space-y-2">
              {rule.match.statusCodes.map((sc, scIndex) => (
                <div key={scIndex} className="flex items-center gap-2">
                  <select
                    value={sc.type}
                    onChange={(e) => {
                      const type = e.target.value as 'Value' | 'Range';
                      if (type === 'Value') {
                        updateStatusCode(ruleIndex, scIndex, { type, value: 404, range: undefined });
                      } else {
                        updateStatusCode(ruleIndex, scIndex, { type, value: undefined, range: { start: 500, end: 599 } });
                      }
                    }}
                    disabled={disabled}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    <option value="Value">Exact Value</option>
                    <option value="Range">Range</option>
                  </select>
                  {sc.type === 'Value' ? (
                    <input
                      type="number"
                      min={100}
                      max={599}
                      value={sc.value || 404}
                      onChange={(e) => updateStatusCode(ruleIndex, scIndex, { value: parseInt(e.target.value) })}
                      disabled={disabled}
                      className="w-24 rounded-md border-gray-300 text-sm"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={100}
                        max={599}
                        value={sc.range?.start || 500}
                        onChange={(e) => updateStatusCode(ruleIndex, scIndex, { range: { start: parseInt(e.target.value), end: sc.range?.end || 599 } })}
                        disabled={disabled}
                        className="w-20 rounded-md border-gray-300 text-sm"
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        type="number"
                        min={100}
                        max={599}
                        value={sc.range?.end || 599}
                        onChange={(e) => updateStatusCode(ruleIndex, scIndex, { range: { start: sc.range?.start || 500, end: parseInt(e.target.value) } })}
                        disabled={disabled}
                        className="w-20 rounded-md border-gray-300 text-sm"
                      />
                    </div>
                  )}
                  {rule.match.statusCodes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStatusCode(ruleIndex, scIndex)}
                      disabled={disabled}
                      className="text-red-600 hover:text-red-800"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addStatusCode(ruleIndex)}
                disabled={disabled}
                className="text-xs text-primary-600 hover:text-primary-800"
              >
                + Add Status Code
              </button>
            </div>
          </div>

          {/* Response */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Content-Type</label>
              <input
                type="text"
                placeholder="text/plain"
                value={rule.response.contentType}
                onChange={(e) => updateRule(ruleIndex, { response: { ...rule.response, contentType: e.target.value } })}
                disabled={disabled}
                className="w-full rounded-md border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Body Source</label>
              <select
                value={rule.response.body.type}
                onChange={(e) => updateRule(ruleIndex, {
                  response: {
                    ...rule.response,
                    body: { type: e.target.value as 'Inline' | 'ValueRef', inline: '', valueRef: undefined }
                  }
                })}
                disabled={disabled}
                className="w-full rounded-md border-gray-300 text-sm"
              >
                <option value="Inline">Inline</option>
                <option value="ValueRef">ConfigMap</option>
              </select>
            </div>
          </div>

          {rule.response.body.type === 'Inline' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Response Body</label>
              <textarea
                rows={3}
                placeholder="Custom error message..."
                value={rule.response.body.inline || ''}
                onChange={(e) => updateRule(ruleIndex, {
                  response: {
                    ...rule.response,
                    body: { ...rule.response.body, inline: e.target.value }
                  }
                })}
                disabled={disabled}
                className="w-full rounded-md border-gray-300 text-sm"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ConfigMap Name</label>
                <input
                  type="text"
                  placeholder="my-configmap"
                  value={rule.response.body.valueRef?.name || ''}
                  onChange={(e) => updateRule(ruleIndex, {
                    response: {
                      ...rule.response,
                      body: {
                        ...rule.response.body,
                        valueRef: { kind: 'ConfigMap', name: e.target.value }
                      }
                    }
                  })}
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addRule}
        disabled={disabled}
        className="text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50"
      >
        + Add Response Override Rule
      </button>
    </div>
  );
}
