import { dnsRecordsApi } from './dns-records';
import apiClient from './client';

jest.mock('./client');

test('get fetches the dns record', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: 'r1' } });
  const r = await dnsRecordsApi.get('p1', 'd1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/domains/d1/dns-record');
  expect(r).toEqual({ id: 'r1' });
});

test('enable posts the dns record input', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'r1' } });
  const input = { providerCredentialId: 'c1', recordType: 'A' as const, proxied: true };
  const r = await dnsRecordsApi.enable('p1', 'd1', input);
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/domains/d1/dns-record', input);
  expect(r).toEqual({ id: 'r1' });
});

test('update puts the dns record input', async () => {
  (apiClient.put as jest.Mock).mockResolvedValue({ data: { id: 'r1' } });
  const input = { ttl: 300 };
  const r = await dnsRecordsApi.update('p1', 'd1', input);
  expect(apiClient.put).toHaveBeenCalledWith('/projects/p1/domains/d1/dns-record', input);
  expect(r).toEqual({ id: 'r1' });
});

test('remove deletes the dns record', async () => {
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await dnsRecordsApi.remove('p1', 'd1');
  expect(apiClient.delete).toHaveBeenCalledWith('/projects/p1/domains/d1/dns-record');
});

test('refresh posts to the refresh endpoint', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'r1', status: 'syncing' } });
  const r = await dnsRecordsApi.refresh('p1', 'd1');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/domains/d1/dns-record/refresh', {});
  expect(r).toEqual({ id: 'r1', status: 'syncing' });
});
