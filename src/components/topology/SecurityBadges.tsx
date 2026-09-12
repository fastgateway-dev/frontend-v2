import type { SecurityFeatureFlags } from '@/types/topology';

const LABELS: Record<keyof SecurityFeatureFlags, string> = {
  ipAllowlist: 'IP', mtls: 'mTLS', apiKey: 'API key', jwt: 'JWT',
  basicAuth: 'Basic', headerAuth: 'Header', rateLimit: 'RL',
  extAuth: 'extAuth', oidc: 'OIDC', waf: 'WAF',
};

export function SecurityBadges({
  flags,
  variant = 'solid',
}: {
  flags: SecurityFeatureFlags;
  variant?: 'solid' | 'outlined';
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {(Object.keys(LABELS) as Array<keyof SecurityFeatureFlags>).map((k) =>
        flags[k] ? (
          <span
            key={k}
            data-testid={`badge-${k}`}
            className={
              variant === 'outlined'
                ? 'inline-block rounded border px-1.5 py-0.5 text-[10px] text-foreground/80'
                : 'inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-900'
            }
          >
            {LABELS[k]}
          </span>
        ) : null,
      )}
    </span>
  );
}
