'use client';

import React from 'react';
import type { TelemetryTracingConfig, TelemetryTracingTag, TelemetryTracingTagType } from '@/types';
import { defaultTracing, samplingPresetToValue, valueToSamplingPreset, SamplingPreset } from './observability-defaults';

interface Props {
  value: TelemetryTracingConfig | null | undefined;
  onChange: (next: TelemetryTracingConfig | null) => void;
  disabled?: boolean;
}

const SAMPLING_PRESETS: { value: SamplingPreset; label: string }[] = [
  { value: 'off', label: 'Off (0%)' },
  { value: '1', label: '1%' },
  { value: '10', label: '10%' },
  { value: '100', label: '100% (always-on)' },
  { value: 'custom', label: 'Custom' },
];

export function TracingCard({ value, onChange, disabled }: Props) {
  const enabled = !!value;
  const cfg = value ?? defaultTracing();
  const preset = valueToSamplingPreset(cfg.samplingRate);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Tracing</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? defaultTracing() : null)}
          />
          Enable
        </label>
      </div>

      {enabled && (
        <>
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">Sampling rate</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {SAMPLING_PRESETS.map((p) => (
                <label key={p.value} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="sampling-preset"
                    checked={preset === p.value}
                    disabled={disabled}
                    onChange={() => onChange({ ...cfg, samplingRate: samplingPresetToValue(p.value, cfg.samplingRate) })}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            {preset === 'custom' && (
              <input
                className="mt-2 block w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={cfg.samplingRate}
                disabled={disabled}
                onChange={(e) => onChange({ ...cfg, samplingRate: Number(e.target.value) })}
              />
            )}
          </fieldset>

          <div className="grid grid-cols-3 gap-2">
            <TextInput label="Provider namespace" value={cfg.provider.namespace} disabled={disabled}
              onChange={(v) => onChange({ ...cfg, provider: { ...cfg.provider, namespace: v } })} />
            <TextInput label="Provider service" value={cfg.provider.service} disabled={disabled}
              onChange={(v) => onChange({ ...cfg, provider: { ...cfg.provider, service: v } })} />
            <NumberInput label="Provider port" value={cfg.provider.port} disabled={disabled}
              onChange={(v) => onChange({ ...cfg, provider: { ...cfg.provider, port: v } })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase text-gray-600">Custom tags</h4>
              <button
                type="button"
                disabled={disabled}
                className="text-xs text-blue-600 hover:underline"
                onClick={() => onChange({
                  ...cfg,
                  customTags: [...(cfg.customTags ?? []), { type: 'literal', tag: '', value: '' }],
                })}
              >
                + Add tag
              </button>
            </div>
            {(cfg.customTags ?? []).map((tag, i) => (
              <TagRow
                key={i}
                tag={tag}
                disabled={disabled}
                onChange={(next) => {
                  const arr = [...(cfg.customTags ?? [])];
                  arr[i] = next;
                  onChange({ ...cfg, customTags: arr });
                }}
                onRemove={() => {
                  const arr = (cfg.customTags ?? []).filter((_, idx) => idx !== i);
                  onChange({ ...cfg, customTags: arr });
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function TagRow({ tag, onChange, onRemove, disabled }: { tag: TelemetryTracingTag; onChange: (t: TelemetryTracingTag) => void; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-3">
        <label className="block text-xs text-gray-700">Type</label>
        <select
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          value={tag.type}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value as TelemetryTracingTagType;
            if (next === 'literal') onChange({ type: 'literal', tag: tag.tag, value: tag.value ?? '' });
            else onChange({ type: 'requestHeader', tag: tag.tag, header: tag.header ?? '', defaultValue: tag.defaultValue ?? '' });
          }}
        >
          <option value="literal">Literal</option>
          <option value="requestHeader">Request header</option>
        </select>
      </div>
      <div className="col-span-3">
        <label className="block text-xs text-gray-700">Tag name</label>
        <input
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          value={tag.tag}
          disabled={disabled}
          onChange={(e) => onChange({ ...tag, tag: e.target.value })}
        />
      </div>
      {tag.type === 'literal' && (
        <div className="col-span-5">
          <label className="block text-xs text-gray-700">Value</label>
          <input
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={tag.value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...tag, value: e.target.value })}
          />
        </div>
      )}
      {tag.type === 'requestHeader' && (
        <>
          <div className="col-span-3">
            <label className="block text-xs text-gray-700">Header name</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={tag.header ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ ...tag, header: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-700">Default value</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              value={tag.defaultValue ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ ...tag, defaultValue: e.target.value })}
            />
          </div>
        </>
      )}
      <div className="col-span-1">
        <button
          type="button"
          disabled={disabled}
          className="text-xs text-red-600 hover:underline"
          onClick={onRemove}
        >Remove</button>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
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

function NumberInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
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
