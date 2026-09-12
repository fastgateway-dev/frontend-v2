'use client';

import React from 'react';
import { ExtProcExtensionConfig } from '@/types';

interface ExtProcExtensionFormProps {
  value: ExtProcExtensionConfig | undefined;
  onChange: (value: ExtProcExtensionConfig | undefined) => void;
  disabled?: boolean;
}

const bodyModeOptions = [
  { value: 'None' as const, label: 'None (Headers Only)', desc: 'Process headers only, skip body' },
  { value: 'Buffered' as const, label: 'Buffered', desc: 'Buffer the full body before processing' },
  { value: 'Streamed' as const, label: 'Streamed', desc: 'Stream body chunks as they arrive' },
];

export default function ExtProcExtensionForm({ value, onChange, disabled }: ExtProcExtensionFormProps) {
  const enabled = value !== undefined;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      onChange({
        backendRef: { name: '', namespace: 'default', port: 9002 },
        processingMode: {
          request: { body: 'None' },
          response: { body: 'None' },
        },
        failOpen: false,
      });
    } else {
      onChange(undefined);
    }
  };

  const updateBackendRef = (field: string, val: string | number) => {
    if (!value) return;
    onChange({
      ...value,
      backendRef: { ...value.backendRef, [field]: val },
    });
  };

  const updateProcessingMode = (phase: 'request' | 'response', body: string) => {
    if (!value) return;
    onChange({
      ...value,
      processingMode: {
        ...value.processingMode,
        [phase]: { body },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="enable-ext-proc"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="enable-ext-proc" className="text-sm font-medium text-gray-700">
          Enable External Processing (ext-proc)
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Route requests through an external gRPC processing service for header/body inspection and mutation.
      </p>

      {enabled && value && (
        <div className="space-y-4 pt-4 border-t">
          {/* gRPC Service Backend */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">gRPC Service</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={value.backendRef.name}
                  onChange={(e) => updateBackendRef('name', e.target.value)}
                  placeholder="grpc-ext-proc"
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Namespace</label>
                <input
                  type="text"
                  value={value.backendRef.namespace}
                  onChange={(e) => updateBackendRef('namespace', e.target.value)}
                  placeholder="default"
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port *</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={value.backendRef.port}
                  onChange={(e) => updateBackendRef('port', parseInt(e.target.value) || 0)}
                  placeholder="9002"
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Processing Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Request Body Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {bodyModeOptions.map(option => (
                <label
                  key={`req-${option.value}`}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${
                    (value.processingMode?.request?.body || 'None') === option.value
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="ext-proc-request-body"
                    value={option.value}
                    checked={(value.processingMode?.request?.body || 'None') === option.value}
                    onChange={() => updateProcessingMode('request', option.value)}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Response Body Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {bodyModeOptions.map(option => (
                <label
                  key={`resp-${option.value}`}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${
                    (value.processingMode?.response?.body || 'None') === option.value
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="ext-proc-response-body"
                    value={option.value}
                    checked={(value.processingMode?.response?.body || 'None') === option.value}
                    onChange={() => updateProcessingMode('response', option.value)}
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

          {/* Fail Open */}
          <div className="p-3 bg-gray-50 border rounded-md">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ext-proc-fail-open"
                checked={value.failOpen || false}
                onChange={(e) => onChange({ ...value, failOpen: e.target.checked })}
                disabled={disabled}
                className="h-4 w-4 text-primary-600 rounded border-gray-300"
              />
              <label htmlFor="ext-proc-fail-open" className="text-sm text-gray-700">
                Fail Open
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Continue processing requests if the ext-proc gRPC service is unavailable.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
