'use client';

import { useEffect, useRef, useState } from 'react';
import type { TLSSecretInfo } from '@/types';

interface TlsSecretComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  secrets: TLSSecretInfo[];
  loading?: boolean;
  placeholder?: string;
}

/**
 * TLS secret picker. Shows FastGateway-managed certificates by their
 * human-facing name (displayName) with a "Managed" badge and the raw secret
 * name as a subtitle, while external secrets show their name and an "External"
 * badge. The field value is always the real Kubernetes secret name (that is
 * what the Gateway references), so free-typing a secret name still works.
 */
export function TlsSecretCombobox({
  id,
  value,
  onChange,
  secrets,
  loading,
  placeholder,
}: TlsSecretComboboxProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = secrets.filter(
    (s) =>
      !query ||
      s.name.toLowerCase().includes(query) ||
      (s.displayName ?? '').toLowerCase().includes(query)
  );

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        placeholder={loading ? 'Loading secrets...' : placeholder ?? 'Select or type a secret name'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.map((secret) => {
            const friendly = secret.displayName || secret.name;
            const showRaw = Boolean(secret.displayName && secret.displayName !== secret.name);
            return (
              <li key={secret.name}>
                <button
                  type="button"
                  // onMouseDown (not onClick) so the selection fires before the
                  // input's blur closes the dropdown.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(secret.name);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="flex w-full items-center gap-2 text-sm font-medium text-gray-900">
                    <span className="truncate">{friendly}</span>
                    <span
                      className={
                        secret.managedByFastgateway
                          ? 'shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-600'
                          : 'shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500'
                      }
                    >
                      {secret.managedByFastgateway ? 'Managed' : 'External'}
                    </span>
                  </span>
                  {showRaw && <span className="truncate text-xs text-gray-400">{secret.name}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
