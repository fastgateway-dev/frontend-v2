'use client';

import { useEffect, useState } from 'react';
import { aiApi } from '@/lib/api/ai';
import { Badge } from '@/components/ui/badge';
import type { AIStatus } from '@/types';

export function AIStatusIndicator() {
  const [status, setStatus] = useState<AIStatus | null>(null);

  useEffect(() => {
    aiApi.getStatus()
      .then(setStatus)
      .catch(() => setStatus({ enabled: false }));
  }, []);

  if (!status?.enabled) {
    return null;
  }

  return (
    <Badge variant="info" className="gap-1">
      <span className="text-xs">AI</span>
    </Badge>
  );
}
