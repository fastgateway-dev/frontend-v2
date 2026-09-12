'use client';

import React, { useEffect, useRef, useState } from 'react';
import type {
  TelemetryAccessLogConfig,
  TelemetryAccessLogFormat,
  TelemetryAccessLogSinkType,
  TelemetryFilePath,
} from '@/types';
import {
  AccessLogFormatPreset,
  defaultAccessLog,
  presetToFormat,
} from './observability-defaults';

interface Props {
  value: TelemetryAccessLogConfig | null | undefined;
  onChange: (next: TelemetryAccessLogConfig | null) => void;
  disabled?: boolean;
}

const PRESET_OPTIONS: { value: AccessLogFormatPreset; label: string }[] = [
  { value: 'default-envoy', label: 'Default Envoy text format' },
  { value: 'json-recommended', label: 'JSON (recommended)' },
  { value: 'custom-text', label: 'Custom text' },
  { value: 'custom-json', label: 'Custom JSON' },
  { value: 'disabled', label: 'Disabled (suppress access logs)' },
];

export function AccessLogsCard({ value, onChange, disabled }: Props) {
  const enabled = !!value;
  const cfg = value ?? defaultAccessLog();

  const formatPreset = formatToPreset(cfg.format);
  const isDisabled = cfg.format.type === 'disabled';

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Access Logs</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? defaultAccessLog() : null)}
          />
          Enable
        </label>
      </div>
      {enabled && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Format</label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={formatPreset}
              disabled={disabled}
              onChange={(e) => {
                const preset = e.target.value as AccessLogFormatPreset;
                onChange({ ...cfg, format: presetToFormat(preset) });
              }}
            >
              {PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {cfg.format.type === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Format body (text)</label>
              <textarea
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm font-mono"
                rows={6}
                value={cfg.format.text ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({
                  ...cfg,
                  format: { type: 'text', text: e.target.value },
                })}
              />
            </div>
          )}

          {cfg.format.type === 'json' && (
            <JsonBodyEditor
              value={cfg.format.json ?? {}}
              disabled={disabled}
              onChange={(json) => onChange({ ...cfg, format: { type: 'json', json } })}
            />
          )}

          {!isDisabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sink</label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  value={cfg.sink.type}
                  disabled={disabled}
                  onChange={(e) => {
                    const type = e.target.value as TelemetryAccessLogSinkType;
                    if (type === 'file') {
                      onChange({ ...cfg, sink: { type: 'file', file: { path: '/dev/stdout' } } });
                    } else {
                      onChange({ ...cfg, sink: { type: 'otel', otel: { namespace: 'observability', service: 'otel-collector', port: 4317 } } });
                    }
                  }}
                >
                  <option value="file">File (stdout/stderr)</option>
                  <option value="otel">OpenTelemetry (in-cluster Service)</option>
                </select>
              </div>

              {cfg.sink.type === 'file' && cfg.sink.file && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">File path</label>
                  <select
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    value={cfg.sink.file.path}
                    disabled={disabled}
                    onChange={(e) => onChange({
                      ...cfg,
                      sink: { type: 'file', file: { path: e.target.value as TelemetryFilePath } },
                    })}
                  >
                    <option value="/dev/stdout">/dev/stdout</option>
                    <option value="/dev/stderr">/dev/stderr</option>
                  </select>
                </div>
              )}

              {cfg.sink.type === 'otel' && cfg.sink.otel && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Namespace" value={cfg.sink.otel.namespace} disabled={disabled}
                    onChange={(v) => onChange({ ...cfg, sink: { type: 'otel', otel: { ...cfg.sink.otel!, namespace: v } } })} />
                  <Field label="Service" value={cfg.sink.otel.service} disabled={disabled}
                    onChange={(v) => onChange({ ...cfg, sink: { type: 'otel', otel: { ...cfg.sink.otel!, service: v } } })} />
                  <NumberField label="Port" value={cfg.sink.otel.port} disabled={disabled}
                    onChange={(v) => onChange({ ...cfg, sink: { type: 'otel', otel: { ...cfg.sink.otel!, port: v } } })} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function formatToPreset(f: TelemetryAccessLogFormat): AccessLogFormatPreset {
  if (f.type === 'disabled') return 'disabled';
  if (f.type === 'text') {
    return f.text && f.text.length > 0 ? 'default-envoy' : 'custom-text';
  }
  return f.json && Object.keys(f.json).length > 0 ? 'json-recommended' : 'custom-json';
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-700">{label}</label>
      <input
        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// JsonBodyEditor holds raw text in local state so the user can type freely
// without their in-progress edits being clobbered by re-stringification.
// Parsed JSON is propagated only when the input is valid; errors are shown inline.
function JsonBodyEditor({
  value,
  disabled,
  onChange,
}: {
  value: Record<string, string>;
  disabled?: boolean;
  onChange: (json: Record<string, string>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const lastEmittedRef = useRef(text);

  // Re-sync from parent only when the parent value is structurally different
  // from what we last emitted (e.g., user switched presets or reloaded the form).
  useEffect(() => {
    const incoming = JSON.stringify(value, null, 2);
    if (incoming !== lastEmittedRef.current) {
      setText(incoming);
      setError(null);
      lastEmittedRef.current = incoming;
    }
  }, [value]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Format body (JSON)</label>
      <textarea
        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm font-mono"
        rows={8}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            const parsed = JSON.parse(next);
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
              setError('JSON must be an object');
              return;
            }
            for (const v of Object.values(parsed)) {
              if (typeof v !== 'string') {
                setError('all values must be strings');
                return;
              }
            }
            setError(null);
            lastEmittedRef.current = next;
            onChange(parsed as Record<string, string>);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'invalid JSON');
          }
        }}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          Each value is an Envoy %FORMAT% operator (e.g. <code>%REQ(:METHOD)%</code>).
        </p>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-700">{label}</label>
      <input
        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
        type="number"
        min={1}
        max={65535}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
