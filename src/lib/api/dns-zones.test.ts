import { dnsZonesApi } from './dns-zones';
import apiClient from './client';

jest.mock('./client');

test('list unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'z1', name: 'example.com', providerCredentialId: 'c1', status: 'ready', createdAt: '', updatedAt: '' }] } });
  const r = await dnsZonesApi.list();
  expect(apiClient.get).toHaveBeenCalledWith('/dns/zones');
  expect(r).toHaveLength(1);
});

test('get fetches a single hosted zone', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: 'z1', name: 'example.com' } });
  const r = await dnsZonesApi.get('z1');
  expect(apiClient.get).toHaveBeenCalledWith('/dns/zones/z1');
  expect(r).toEqual({ id: 'z1', name: 'example.com' });
});

test('create posts body and returns created zone', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'z1', name: 'example.com', providerCredentialId: 'c1' } });
  const r = await dnsZonesApi.create({ name: 'example.com', providerCredentialId: 'c1' });
  expect(apiClient.post).toHaveBeenCalledWith('/dns/zones', { name: 'example.com', providerCredentialId: 'c1' });
  expect(r).toEqual({ id: 'z1', name: 'example.com', providerCredentialId: 'c1' });
});

test('remove deletes the hosted zone', async () => {
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await dnsZonesApi.remove('z1');
  expect(apiClient.delete).toHaveBeenCalledWith('/dns/zones/z1');
});
