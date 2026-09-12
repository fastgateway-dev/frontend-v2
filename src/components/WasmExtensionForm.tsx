'use client';

import type { WasmExtensionConfig } from '@/types';

interface WasmExtensionFormProps {
  value?: WasmExtensionConfig;
  onChange: (value: WasmExtensionConfig | undefined) => void;
  disabled?: boolean;
}

export default function WasmExtensionForm({ value, onChange, disabled }: WasmExtensionFormProps) {
  const isEnabled = !!value;

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({
        name: 'my-wasm-filter',
        code: { type: 'HTTP', http: { url: '', sha256: '' } }
      });
    } else {
      onChange(undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="wasmEnabled"
          checked={isEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="wasmEnabled" className="text-sm font-medium text-gray-700">
          Enable Wasm Extension
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Add a WebAssembly module for advanced request/response processing with language flexibility.
      </p>

      {isEnabled && value && (
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter Name *</label>
              <input
                type="text"
                placeholder="my-wasm-filter"
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                disabled={disabled}
                className="w-full rounded-md border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Root ID (optional)</label>
              <input
                type="text"
                placeholder="my_root_id"
                value={value.rootID || ''}
                onChange={(e) => onChange({ ...value, rootID: e.target.value || undefined })}
                disabled={disabled}
                className="w-full rounded-md border-gray-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Source Type</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'HTTP' as const, label: 'HTTP URL', desc: 'Load WASM module from an HTTP URL' },
                { value: 'Image' as const, label: 'OCI Image', desc: 'Load WASM module from an OCI registry' },
              ]).map(option => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${
                    value.code.type === option.value
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="wasm-source-type"
                    value={option.value}
                    checked={value.code.type === option.value}
                    onChange={() => {
                      if (option.value === 'HTTP') {
                        onChange({ ...value, code: { type: 'HTTP', http: { url: '', sha256: '' } } });
                      } else {
                        onChange({ ...value, code: { type: 'Image', image: { url: '' } } });
                      }
                    }}
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

          {value.code.type === 'HTTP' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wasm URL *</label>
                <input
                  type="url"
                  placeholder="https://example.com/filter.wasm"
                  value={value.code.http?.url || ''}
                  onChange={(e) => onChange({
                    ...value,
                    code: {
                      ...value.code,
                      http: { url: e.target.value, sha256: value.code.http?.sha256 || '' }
                    }
                  })}
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SHA256 Checksum *</label>
                <input
                  type="text"
                  placeholder="64-character hex string"
                  value={value.code.http?.sha256 || ''}
                  onChange={(e) => onChange({
                    ...value,
                    code: {
                      ...value.code,
                      http: { url: value.code.http?.url || '', sha256: e.target.value }
                    }
                  })}
                  disabled={disabled}
                  className="w-full font-mono rounded-md border-gray-300 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label>
                <input
                  type="text"
                  placeholder="oci://ghcr.io/example/wasm-filter:v1.0"
                  value={value.code.image?.url || ''}
                  onChange={(e) => onChange({
                    ...value,
                    code: {
                      ...value.code,
                      image: { ...value.code.image, url: e.target.value }
                    }
                  })}
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SHA256 (optional)</label>
                <input
                  type="text"
                  placeholder="64-character hex string"
                  value={value.code.image?.sha256 || ''}
                  onChange={(e) => onChange({
                    ...value,
                    code: {
                      ...value.code,
                      image: { ...value.code.image!, sha256: e.target.value || undefined }
                    }
                  })}
                  disabled={disabled}
                  className="w-full font-mono rounded-md border-gray-300 text-sm"
                />
              </div>
              <div className="p-3 bg-gray-50 border rounded-md space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="usePullSecret"
                    checked={!!value.code.image?.pullSecret}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange({
                          ...value,
                          code: {
                            ...value.code,
                            image: { ...value.code.image!, pullSecret: { kind: 'Secret', name: '' } }
                          }
                        });
                      } else {
                        const { pullSecret, ...rest } = value.code.image || {};
                        onChange({
                          ...value,
                          code: {
                            ...value.code,
                            image: rest as typeof value.code.image
                          }
                        });
                      }
                    }}
                    disabled={disabled}
                    className="h-4 w-4 text-primary-600 rounded border-gray-300"
                  />
                  <label htmlFor="usePullSecret" className="text-sm text-gray-700">
                    Use Pull Secret (for private registries)
                  </label>
                </div>
                {value.code.image?.pullSecret && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Secret Name *</label>
                      <input
                        type="text"
                        placeholder="registry-credentials"
                        value={value.code.image.pullSecret.name}
                        onChange={(e) => onChange({
                          ...value,
                          code: {
                            ...value.code,
                            image: {
                              ...value.code.image!,
                              pullSecret: { ...value.code.image!.pullSecret!, name: e.target.value }
                            }
                          }
                        })}
                        disabled={disabled}
                        className="w-full rounded-md border-gray-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Secret Namespace (optional)</label>
                      <input
                        type="text"
                        placeholder="Leave empty for same namespace"
                        value={value.code.image.pullSecret.namespace || ''}
                        onChange={(e) => onChange({
                          ...value,
                          code: {
                            ...value.code,
                            image: {
                              ...value.code.image!,
                              pullSecret: { ...value.code.image!.pullSecret!, namespace: e.target.value || undefined }
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
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wasm Config (JSON, optional)</label>
            <textarea
              rows={3}
              placeholder='{"key": "value"}'
              value={value.config || ''}
              onChange={(e) => onChange({ ...value, config: e.target.value || undefined })}
              disabled={disabled}
              className="w-full font-mono rounded-md border-gray-300 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
