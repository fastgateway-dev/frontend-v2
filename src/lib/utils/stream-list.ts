// Pure helpers for the stream list: client-side status/name filtering and the
// compact Ports column. The list endpoint has no search or status params.
import type { Stream, StreamStatus, TransportPort } from '@/types';
import { comparePorts, portLabel } from './stream-entrypoint';

export type StreamStatusFilter = '' | StreamStatus;

export function filterStreams(streams: Stream[], status: StreamStatusFilter, query: string): Stream[] {
  const q = query.trim().toLowerCase();
  return streams.filter(
    (s) => (status === '' || s.status === status) && (q === '' || s.name.toLowerCase().includes(q))
  );
}

/** First `limit` ports as "5432/TCP" (sorted by port), plus how many more there are. */
export function portsSummary(ports: TransportPort[] | undefined, limit = 3): { shown: string[]; more: number } {
  const sorted = [...(ports ?? [])].sort(comparePorts);
  return { shown: sorted.slice(0, limit).map(portLabel), more: Math.max(0, sorted.length - limit) };
}
