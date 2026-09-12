import {
  IMPORT_CHANNEL,
  postRouteCreatedFromPrefill,
  subscribeToImportEvents,
} from './importBroadcast';

class FakeBC {
  static channels: Record<string, FakeBC[]> = {};
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(name: string) {
    this.name = name;
    (FakeBC.channels[name] ||= []).push(this);
  }
  postMessage(data: unknown) {
    for (const peer of FakeBC.channels[this.name]) {
      if (peer === this) continue;
      peer.onmessage?.({ data } as MessageEvent);
    }
  }
  close() {
    FakeBC.channels[this.name] = (FakeBC.channels[this.name] || []).filter((c) => c !== this);
  }
}

beforeEach(() => {
  FakeBC.channels = {};
  (globalThis as any).BroadcastChannel = FakeBC as any;
});

test('IMPORT_CHANNEL is the documented channel name', () => {
  expect(IMPORT_CHANNEL).toBe('fastgateway-import');
});

test('subscriber receives a posted route-created message', () => {
  const received: any[] = [];
  const unsub = subscribeToImportEvents((evt) => received.push(evt));

  postRouteCreatedFromPrefill('k-1', 'route-uuid-1', 'route-a');

  expect(received).toHaveLength(1);
  expect(received[0]).toEqual({
    type: 'route-created-from-prefill',
    key: 'k-1',
    routeId: 'route-uuid-1',
    routeName: 'route-a',
  });
  unsub();
});

test('unsubscribe stops further delivery', () => {
  const received: any[] = [];
  const unsub = subscribeToImportEvents((evt) => received.push(evt));
  unsub();
  postRouteCreatedFromPrefill('k-2', 'r-2', 'n-2');
  expect(received).toHaveLength(0);
});

test('multiple subscribers each receive the message', () => {
  const a: any[] = [];
  const b: any[] = [];
  const unsubA = subscribeToImportEvents((evt) => a.push(evt));
  const unsubB = subscribeToImportEvents((evt) => b.push(evt));

  postRouteCreatedFromPrefill('k-3', 'r-3', 'n-3');

  expect(a).toHaveLength(1);
  expect(b).toHaveLength(1);
  unsubA();
  unsubB();
});

test('post is a no-op when BroadcastChannel is unavailable', () => {
  delete (globalThis as any).BroadcastChannel;
  expect(() => postRouteCreatedFromPrefill('k-4', 'r-4', 'n-4')).not.toThrow();
});

test('subscribe returns a no-op unsubscribe when BroadcastChannel is unavailable', () => {
  delete (globalThis as any).BroadcastChannel;
  const unsub = subscribeToImportEvents(() => {});
  expect(() => unsub()).not.toThrow();
});
