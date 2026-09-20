import { dnsCredentialsApi } from './dns-credentials';
import apiClient from './client';

jest.mock('./client');

test('list unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'c1', name: 'cf', providerType: 'cloudflare', createdAt: '', updatedAt: '' }] } });
  const r = await dnsCredentialsApi.list();
  expect(apiClient.get).toHaveBeenCalledWith('/dns/credentials');
  expect(r).toHaveLength(1);
});

test('create posts body and returns data', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'c1' } });
  await dnsCredentialsApi.create({ name: 'cf', providerType: 'cloudflare', credentials: { apiToken: 't' } });
  expect(apiClient.post).toHaveBeenCalledWith('/dns/credentials', { name: 'cf', providerType: 'cloudflare', credentials: { apiToken: 't' } });
});

test('update patches and delete deletes', async () => {
  (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: 'c1' } });
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await dnsCredentialsApi.update('c1', { name: 'x' });
  expect(apiClient.patch).toHaveBeenCalledWith('/dns/credentials/c1', { name: 'x' });
  await dnsCredentialsApi.delete('c1');
  expect(apiClient.delete).toHaveBeenCalledWith('/dns/credentials/c1');
});
