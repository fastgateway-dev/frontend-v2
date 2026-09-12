import { signalCreatedFromPrefill } from './onSubmit';
import { IMPORT_CHANNEL } from '@/lib/utils/importBroadcast';

// Note: this FakeBC records messages on the producer instance only — it does
// NOT simulate cross-channel delivery to peers. That is intentional: this test
// asserts the producer side-effects (broadcast posted, sessionStorage cleared).
// Cross-channel delivery semantics are covered in importBroadcast.test.ts.
class FakeBC {
  static last: { name: string; messages: unknown[] }[] = [];
  name: string;
  messages: unknown[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(name: string) {
    this.name = name;
    FakeBC.last.push({ name, messages: this.messages });
  }
  postMessage(data: unknown) {
    this.messages.push(data);
  }
  close() {}
}

beforeEach(() => {
  FakeBC.last = [];
  (globalThis as any).BroadcastChannel = FakeBC as any;
  (globalThis as any).sessionStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return this.store[k] ?? null; },
    setItem(k: string, v: string) { this.store[k] = v; },
    removeItem(k: string) { delete this.store[k]; },
  };
  (globalThis as any).sessionStorage.setItem('ai-prefill-abc', 'payload');
});

test('does nothing when prefillKey is null', () => {
  signalCreatedFromPrefill(null, 'route-1', 'name-1');
  expect(FakeBC.last).toHaveLength(0);
  expect((globalThis as any).sessionStorage.getItem('ai-prefill-abc')).toBe('payload');
});

test('posts a broadcast and clears sessionStorage when prefillKey is set', () => {
  signalCreatedFromPrefill('ai-prefill-abc', 'route-1', 'name-1');

  expect(FakeBC.last).toHaveLength(1);
  expect(FakeBC.last[0].name).toBe(IMPORT_CHANNEL);
  expect(FakeBC.last[0].messages).toEqual([
    { type: 'route-created-from-prefill', key: 'ai-prefill-abc', routeId: 'route-1', routeName: 'name-1' },
  ]);
  expect((globalThis as any).sessionStorage.getItem('ai-prefill-abc')).toBeNull();
});
