import { aiApi } from './ai';
import apiClient from './client';

jest.mock('./client');

const sampleInput = {
  enabled: true,
  provider: 'openai' as const,
  model: 'gpt-4o',
  maxTokens: 4096,
  baseURL: '',
};

test('getConfig fetches /settings/ai and returns data', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({
    data: { enabled: true, provider: 'anthropic', model: 'claude-sonnet-4-20250514', maxTokens: 4096, baseURL: '', apiKeySet: true },
  });
  const r = await aiApi.getConfig();
  expect(apiClient.get).toHaveBeenCalledWith('/settings/ai');
  expect(r.apiKeySet).toBe(true);
  expect(r.provider).toBe('anthropic');
});

test('updateConfig puts input to /settings/ai and returns data', async () => {
  (apiClient.put as jest.Mock).mockResolvedValue({ data: { ...sampleInput, apiKeySet: false } });
  const r = await aiApi.updateConfig(sampleInput);
  expect(apiClient.put).toHaveBeenCalledWith('/settings/ai', sampleInput);
  expect(r.provider).toBe('openai');
});

test('testConfig posts input to /settings/ai/test and returns ok', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { ok: true } });
  const r = await aiApi.testConfig(sampleInput);
  expect(apiClient.post).toHaveBeenCalledWith('/settings/ai/test', sampleInput);
  expect(r.ok).toBe(true);
});
