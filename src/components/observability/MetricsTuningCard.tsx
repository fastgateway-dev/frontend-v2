'use client';

import React, { useState } from 'react';
import type { TelemetryMetricsConfig, TelemetryMetricsSink } from '@/types';

interface Props {
  value: TelemetryMetricsConfig | null | undefined;
  onChange: (next: TelemetryMetricsConfig | null) => void;
  disabled?: boolean;
}

const EMPTY: TelemetryMetricsConfig = {
  enableVirtualHostStats: false,
  enablePerEndpointStats: false,
};

const DEFAULT_SINK: TelemetryMetricsSink = {
  type: 'openTelemetry',
  namespace: 'observability',
  service: 'otel-collector',
  port: 4317,
};

export function MetricsTuningCard({ value, onChange, disabled }: Props) {
  const enabled = !!value;
  const cfg = value ?? EMPTY;
  const [sinkOpen, setSinkOpen] = useState(!!cfg.sinks?.length);

  const promDisabled = cfg.prometheus?.disable ?? false;

  function update(next: TelemetryMetricsConfig) {
    onChange(next);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Metrics tuning</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ ...EMPTY });
              } else {
                onChange(null);
                setSinkOpen(false);
              }
            }}
          />
          Enable
        </label>
      </div>

      {enabled && (
        <>
      <label className="inline-flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={promDisabled}
          disabled={disabled}
          onChange={(e) => update({ ...cfg, prometheus: { disable: e.target.checked } })}
        />
        <span>
          <span className="block">Disable Prometheus stats endpoint</span>
          <span className="text-xs text-gray-500">By default the EnvoyProxy exposes /stats/prometheus.</span>
        </span>
      </label>

      <label className="inline-flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={cfg.enableVirtualHostStats}
          disabled={disabled}
          onChange={(e) => update({ ...cfg, enableVirtualHostStats: e.target.checked })}
        />
        <span>
          <span className="block">Emit per-virtualhost histograms</span>
          <span className="text-xs text-amber-700">Increases stat cardinality.</span>
        </span>
      </label>

      <label className="inline-flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={cfg.enablePerEndpointStats}
          disabled={disabled}
          onChange={(e) => update({ ...cfg, enablePerEndpointStats: e.target.checked })}
        />
        <span>
          <span className="block">Emit per-route histograms</span>
          <span className="text-xs text-amber-700">High cardinality — verify Prometheus retention can absorb it.</span>
        </span>
      </label>

      <div className="border-t pt-3">
        <button
          type="button"
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline"
          onClick={() => {
            if (sinkOpen) {
              update({ ...cfg, sinks: undefined });
              setSinkOpen(false);
            } else {
              update({ ...cfg, sinks: [DEFAULT_SINK] });
              setSinkOpen(true);
            }
          }}
        >
          {sinkOpen ? '− Remove' : '+ Add'} OpenTelemetry metrics sink
        </button>

        {sinkOpen && cfg.sinks && cfg.sinks[0] && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <TextInput label="Namespace" value={cfg.sinks[0].namespace} disabled={disabled}
              onChange={(v) => update({ ...cfg, sinks: [{ ...cfg.sinks![0], namespace: v }] })} />
            <TextInput label="Service" value={cfg.sinks[0].service} disabled={disabled}
              onChange={(v) => update({ ...cfg, sinks: [{ ...cfg.sinks![0], service: v }] })} />
            <NumberInput label="Port" value={cfg.sinks[0].port} disabled={disabled}
              onChange={(v) => update({ ...cfg, sinks: [{ ...cfg.sinks![0], port: v }] })} />
          </div>
        )}
      </div>
        </>
      )}
    </section>
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
