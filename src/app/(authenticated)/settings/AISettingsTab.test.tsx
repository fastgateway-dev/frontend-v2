import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AISettingsTab } from './AISettingsTab';
import { aiApi } from '@/lib/api/ai';

jest.mock('@/lib/api/ai', () => ({
  aiApi: {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    testConfig: jest.fn(),
  },
}));

const mockApi = aiApi as jest.Mocked<typeof aiApi>;

const configWithKey = {
  enabled: true,
  provider: 'anthropic' as const,
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  baseURL: '',
  apiKeySet: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.getConfig.mockResolvedValue(configWithKey);
  mockApi.updateConfig.mockResolvedValue(configWithKey);
  mockApi.testConfig.mockResolvedValue({ ok: true });
});

test('base URL field is hidden unless provider is openai_compatible', async () => {
  render(<AISettingsTab />);
  await screen.findByLabelText('Provider');
  expect(screen.queryByLabelText('Base URL')).toBeNull();

  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai_compatible' } });
  expect(screen.getByLabelText('Base URL')).toBeInTheDocument();
});

test('changing provider updates the model placeholder to that provider default', async () => {
  render(<AISettingsTab />);
  await screen.findByLabelText('Provider');
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } });
  expect(screen.getByLabelText('Model')).toHaveAttribute('placeholder', 'gpt-4o');
});

test('blank API key is omitted from the save payload when a key is already set', async () => {
  render(<AISettingsTab />);
  await screen.findByLabelText('Provider');
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(mockApi.updateConfig).toHaveBeenCalled());
  const payload = mockApi.updateConfig.mock.calls[0][0];
  expect(payload).not.toHaveProperty('apiKey');
  expect(payload.maxTokens).toBe(4096);
  expect(typeof payload.maxTokens).toBe('number');
});

test('Test Connection success shows a success banner', async () => {
  render(<AISettingsTab />);
  await screen.findByLabelText('Provider');
  fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
  expect(await screen.findByText('Connection successful')).toBeInTheDocument();
});

test('Test Connection failure surfaces the backend error message', async () => {
  mockApi.testConfig.mockRejectedValue({ response: { data: { error: 'invalid api key' } } });
  render(<AISettingsTab />);
  await screen.findByLabelText('Provider');
  fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
  expect(await screen.findByText('invalid api key')).toBeInTheDocument();
});

test('getConfig failure renders the empty form without crashing', async () => {
  mockApi.getConfig.mockRejectedValue(new Error('404'));
  render(<AISettingsTab />);
  const enabled = await screen.findByLabelText('Enable AI');
  expect(enabled).not.toBeChecked();
  expect(screen.getByLabelText('Model')).toHaveAttribute('placeholder', 'claude-sonnet-4-20250514');
});

test('clearing Max Tokens sends the 4096 default, never 0', async () => {
  render(<AISettingsTab />);
  await screen.findByLabelText('Provider');
  fireEvent.change(screen.getByLabelText('Max Tokens'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(mockApi.updateConfig).toHaveBeenCalled());
  const payload = mockApi.updateConfig.mock.calls[0][0];
  expect(payload.maxTokens).toBe(4096);
});

test('baseURL is omitted (empty) from the payload for non openai_compatible providers', async () => {
  render(<AISettingsTab />);
  await screen.findByLabelText('Provider');
  // Switch to openai_compatible and enter a base URL...
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai_compatible' } });
  fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://endpoint.example.com' } });
  // ...then switch back to a provider that does not use it.
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(mockApi.updateConfig).toHaveBeenCalled());
  const payload = mockApi.updateConfig.mock.calls[0][0];
  expect(payload.provider).toBe('openai');
  expect(payload.baseURL).toBe('');
});
