import type {
  TelemetryAccessLogConfig,
  TelemetryAccessLogFormat,
  TelemetryTracingConfig,
} from '@/types';

export const ACCESS_LOG_TEXT_DEFAULT =
  '[%START_TIME%] "%REQ(:METHOD)% %REQ(X-ENVOY-ORIGINAL-PATH?:PATH)% %PROTOCOL%" ' +
  '%RESPONSE_CODE% %RESPONSE_FLAGS% %BYTES_RECEIVED% %BYTES_SENT% ' +
  '%DURATION% %RESP(X-ENVOY-UPSTREAM-SERVICE-TIME)% "%REQ(X-FORWARDED-FOR)%" ' +
  '"%REQ(USER-AGENT)%" "%REQ(X-REQUEST-ID)%" "%REQ(:AUTHORITY)%" "%UPSTREAM_HOST%"';

export const ACCESS_LOG_JSON_DEFAULT: Record<string, string> = {
  start_time: '%START_TIME%',
  method: '%REQ(:METHOD)%',
  path: '%REQ(X-ENVOY-ORIGINAL-PATH?:PATH)%',
  protocol: '%PROTOCOL%',
  status: '%RESPONSE_CODE%',
  response_flags: '%RESPONSE_FLAGS%',
  duration: '%DURATION%',
  upstream_cluster: '%UPSTREAM_CLUSTER%',
  request_id: '%REQ(X-REQUEST-ID)%',
  user_agent: '%REQ(USER-AGENT)%',
};

export type AccessLogFormatPreset =
  | 'default-envoy'
  | 'json-recommended'
  | 'custom-text'
  | 'custom-json'
  | 'disabled';

export function presetToFormat(preset: AccessLogFormatPreset): TelemetryAccessLogFormat {
  switch (preset) {
    case 'default-envoy':
      return { type: 'text', text: ACCESS_LOG_TEXT_DEFAULT };
    case 'json-recommended':
      return { type: 'json', json: { ...ACCESS_LOG_JSON_DEFAULT } };
    case 'custom-text':
      return { type: 'text', text: '' };
    case 'custom-json':
      return { type: 'json', json: {} };
    case 'disabled':
      return { type: 'disabled' };
  }
}

export function defaultAccessLog(): TelemetryAccessLogConfig {
  return {
    format: presetToFormat('json-recommended'),
    sink: { type: 'file', file: { path: '/dev/stdout' } },
  };
}

export function defaultTracing(): TelemetryTracingConfig {
  return {
    samplingRate: 1,
    provider: { namespace: 'observability', service: 'otel-collector', port: 4317 },
    customTags: [],
  };
}

export type SamplingPreset = 'off' | '1' | '10' | '100' | 'custom';

export function samplingPresetToValue(p: SamplingPreset, custom: number): number {
  if (p === 'custom') return custom;
  if (p === 'off') return 0;
  return Number(p);
}

export function valueToSamplingPreset(v: number): SamplingPreset {
  if (v === 0) return 'off';
  if (v === 1) return '1';
  if (v === 10) return '10';
  if (v === 100) return '100';
  return 'custom';
}
