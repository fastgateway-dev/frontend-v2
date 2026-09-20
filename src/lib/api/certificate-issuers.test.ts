import { certificateIssuersApi } from './certificate-issuers';
import apiClient from './client';

jest.mock('./client');

test('list unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'i1' }] } });
  const r = await certificateIssuersApi.list();
  expect(apiClient.get).toHaveBeenCalledWith('/certificates/issuers');
  expect(r).toHaveLength(1);
});

test('getStatus hits /status', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { status: 'ready' } });
  await certificateIssuersApi.getStatus('i1');
  expect(apiClient.get).toHaveBeenCalledWith('/certificates/issuers/i1/status');
});

test('grants list/grant/revoke', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
  (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await certificateIssuersApi.listGrants('i1');
  expect(apiClient.get).toHaveBeenCalledWith('/certificates/issuers/i1/grants');
  await certificateIssuersApi.grant('i1', 'p1');
  expect(apiClient.post).toHaveBeenCalledWith('/certificates/issuers/i1/grants', { projectId: 'p1' });
  await certificateIssuersApi.revokeGrant('i1', 'p1');
  expect(apiClient.delete).toHaveBeenCalledWith('/certificates/issuers/i1/grants/p1');
});
