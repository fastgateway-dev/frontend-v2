export const IMPORT_CHANNEL = 'fastgateway-import';

export interface RouteCreatedFromPrefillMessage {
  type: 'route-created-from-prefill';
  key: string;
  routeId: string;
  routeName: string;
}

export type ImportEvent = RouteCreatedFromPrefillMessage;

function getChannelCtor(): typeof BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return BroadcastChannel;
}

export function postRouteCreatedFromPrefill(
  key: string,
  routeId: string,
  routeName: string,
): void {
  const Ctor = getChannelCtor();
  if (!Ctor) return;
  let channel: BroadcastChannel | null = null;
  try {
    channel = new Ctor(IMPORT_CHANNEL);
    const msg: RouteCreatedFromPrefillMessage = {
      type: 'route-created-from-prefill',
      key,
      routeId,
      routeName,
    };
    channel.postMessage(msg);
  } catch {
    // Best-effort signal. Failure to post must not break the create flow.
  } finally {
    channel?.close();
  }
}

export function subscribeToImportEvents(
  callback: (event: ImportEvent) => void,
): () => void {
  const Ctor = getChannelCtor();
  if (!Ctor) return () => {};
  let channel: BroadcastChannel | null = null;
  try {
    channel = new Ctor(IMPORT_CHANNEL);
    channel.onmessage = (event) => {
      const data = event.data as ImportEvent | undefined;
      if (data && data.type === 'route-created-from-prefill') {
        callback(data);
      }
    };
  } catch {
    return () => {};
  }
  return () => {
    try {
      channel?.close();
    } catch {
      // ignore
    }
  };
}
