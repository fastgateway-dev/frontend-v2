import { certificatesApi } from './certificates';
import apiClient from './client';

jest.mock('./client');

test('list unwraps paginated {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'c1' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } });
  const r = await certificatesApi.list('p1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates');
  expect(r).toHaveLength(1);
});

test('issuersForProject unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
  await certificatesApi.issuersForProject('p1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates/issuers');
});

test('create returns {certificate, approvalId}', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { certificate: { id: 'c1' }, approvalId: null } });
  const r = await certificatesApi.create('p1', { name: 'n', issuerId: 'i1', usage: 'server', dnsNames: ['a.example'] });
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/certificates', { name: 'n', issuerId: 'i1', usage: 'server', dnsNames: ['a.example'] });
  expect(r.approvalId).toBeNull();
});

test('list returns enriched data', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'c1', issuerName: 'CA', domains: [] }], pagination: {} } });
  const r = await certificatesApi.list('p1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates');
  expect(r[0].issuerName).toBe('CA');
});

test('fleet hits /certificates with filters', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [], pagination: {} } });
  await certificatesApi.fleet({ status: 'ready' });
  expect(apiClient.get).toHaveBeenCalledWith('/certificates', { params: { status: 'ready' } });
});

test('status/distribution/resync/delete endpoints', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { status: 'ready' } });
  (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  await certificatesApi.getStatus('p1', 'c1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates/c1/status');
  await certificatesApi.getDistribution('p1', 'c1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates/c1/distribution');
  await certificatesApi.resync('p1', 'c1');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/certificates/c1/resync');
  await certificatesApi.delete('p1', 'c1');
  expect(apiClient.delete).toHaveBeenCalledWith('/projects/p1/certificates/c1');
});

test('requestExport posts to /export', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { approvalId: 'a1' } });
  const r = await certificatesApi.requestExport('p1', 'c1');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/certificates/c1/export');
  expect(r.approvalId).toBe('a1');
});
test('downloadExport requests a blob', async () => {
  const blob = new Blob(['x']);
  (apiClient.get as jest.Mock).mockResolvedValue({ data: blob });
  const r = await certificatesApi.downloadExport('p1', 'c1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/certificates/c1/export/download', { responseType: 'blob' });
  expect(r).toBe(blob);
});
