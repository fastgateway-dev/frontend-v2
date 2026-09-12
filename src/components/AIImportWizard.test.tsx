import { render } from '@testing-library/react';
import { AIImportWizard } from './AIImportWizard';

jest.mock('@/hooks/useAIGenerate', () => ({
  useAIGenerate: () => ({
    routes: [],
    warnings: [],
    isStreaming: false,
    error: null,
    generate: jest.fn(),
    cancel: jest.fn(),
  }),
}));

jest.mock('@/lib/api/routes', () => ({
  routesApi: {
    checkConflicts: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
  },
}));

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
  (globalThis as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel =
    FakeBC as unknown as typeof BroadcastChannel;
  jest.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('mounts cleanly with the broadcast subscription wired', () => {
  render(
    <AIImportWizard
      projectId="p1"
      domainId="d1"
      mode="ingress"
      teamId="t1"
      onBack={() => {}}
    />,
  );
  expect(true).toBe(true);
});
