'use client';

import { Input, Select } from '@/components/ui';
import type { DNSRecordType } from '@/types';

interface DNSRecordFieldsProps {
  zoneOptions: { value: string; label: string }[];
  hostedZoneId: string;
  onHostedZoneChange: (id: string) => void;
  recordType: DNSRecordType;
  onRecordTypeChange: (t: DNSRecordType) => void;
  ttl: string;
  onTtlChange: (v: string) => void;
  proxied: boolean;
  onProxiedChange: (v: boolean) => void;
  showProxied: boolean;
}

/**
 * DNSRecordFields renders the four editable fields of a FastGateway-managed DNS
 * record (hosted zone, record type, TTL, proxied) as a controlled component.
 * Shared by the domain settings page and the project DNS records list's edit
 * modal so the two stay identical.
 */
export function DNSRecordFields({
  zoneOptions,
  hostedZoneId,
  onHostedZoneChange,
  recordType,
  onRecordTypeChange,
  ttl,
  onTtlChange,
  proxied,
  onProxiedChange,
  showProxied,
}: DNSRecordFieldsProps) {
  return (
    <div className="space-y-3">
      <Select
        id="dnsHostedZone"
        label="Hosted Zone"
        value={hostedZoneId}
        onChange={(e) => onHostedZoneChange(e.target.value)}
        options={zoneOptions}
      />

      <Select
        id="dnsRecordType"
        label="Record Type"
        value={recordType}
        onChange={(e) => onRecordTypeChange(e.target.value as DNSRecordType)}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'A', label: 'A' },
          { value: 'AAAA', label: 'AAAA' },
          { value: 'CNAME', label: 'CNAME' },
        ]}
      />

      <div>
        <label htmlFor="dnsTtl" className="block text-sm font-medium text-gray-700 mb-1">
          TTL
        </label>
        <Input
          id="dnsTtl"
          type="number"
          min={0}
          placeholder="Auto"
          value={ttl}
          onChange={(e) => onTtlChange(e.target.value)}
          disabled={proxied}
        />
        {proxied && (
          <p className="mt-1 text-xs text-gray-500">
            TTL is managed automatically by Cloudflare when proxied.
          </p>
        )}
      </div>

      {showProxied && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="dnsProxied"
            checked={proxied}
            onChange={(e) => onProxiedChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600"
          />
          <label htmlFor="dnsProxied" className="text-sm font-medium text-gray-700">
            Proxied
          </label>
        </div>
      )}
    </div>
  );
}
