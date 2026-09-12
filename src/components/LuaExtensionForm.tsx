'use client';

import type { LuaExtensionConfig } from '@/types';

interface LuaExtensionFormProps {
  value?: LuaExtensionConfig;
  onChange: (value: LuaExtensionConfig | undefined) => void;
  disabled?: boolean;
}

const DEFAULT_LUA_SCRIPT = `function envoy_on_request(request_handle)
  -- Add custom request processing here
end

function envoy_on_response(response_handle)
  -- Add custom response processing here
  -- Example: response_handle:headers():add("x-custom-header", "value")
end`;

export default function LuaExtensionForm({ value, onChange, disabled }: LuaExtensionFormProps) {
  const isEnabled = !!value;

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({ type: 'Inline', inline: DEFAULT_LUA_SCRIPT });
    } else {
      onChange(undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="luaEnabled"
          checked={isEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="luaEnabled" className="text-sm font-medium text-gray-700">
          Enable Lua Extension
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Add a Lua script to process requests and responses. Lua runs inline and is great for simple transformations.
      </p>

      {isEnabled && value && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Source Type</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'Inline' as const, label: 'Inline Script', desc: 'Write Lua code directly in the editor below' },
                { value: 'ValueRef' as const, label: 'ConfigMap Reference', desc: 'Reference an existing Kubernetes ConfigMap' },
              ]).map(option => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${
                    value.type === option.value
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="lua-source-type"
                    value={option.value}
                    checked={value.type === option.value}
                    onChange={() => {
                      if (option.value === 'Inline') {
                        onChange({ type: 'Inline', inline: value.inline || DEFAULT_LUA_SCRIPT });
                      } else {
                        onChange({ type: 'ValueRef', valueRef: { kind: 'ConfigMap', name: '' } });
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

          {value.type === 'Inline' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lua Script</label>
              <textarea
                rows={12}
                value={value.inline || ''}
                onChange={(e) => onChange({ ...value, inline: e.target.value })}
                disabled={disabled}
                className="w-full font-mono text-sm rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder={DEFAULT_LUA_SCRIPT}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ConfigMap Name *</label>
                <input
                  type="text"
                  placeholder="lua-script-configmap"
                  value={value.valueRef?.name || ''}
                  onChange={(e) => onChange({
                    ...value,
                    valueRef: { ...value.valueRef, kind: 'ConfigMap', name: e.target.value }
                  })}
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Namespace (optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for same namespace"
                  value={value.valueRef?.namespace || ''}
                  onChange={(e) => onChange({
                    ...value,
                    valueRef: { ...value.valueRef!, namespace: e.target.value || undefined }
                  })}
                  disabled={disabled}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
