import { clientsApi } from './clients';
import apiClient from './client';
jest.mock('./client');
test('attachCertificate PUTs certificateId', async () => {
  (apiClient.put as jest.Mock).mockResolvedValue({ data: { id: 'cl1' } });
  await clientsApi.attachCertificate('cl1', 'c1');
  expect(apiClient.put).toHaveBeenCalledWith('/clients/cl1/certificate', { certificateId: 'c1' });
});
test('detachCertificate DELETEs', async () => {
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: { id: 'cl1' } });
  await clientsApi.detachCertificate('cl1');
  expect(apiClient.delete).toHaveBeenCalledWith('/clients/cl1/certificate');
});
test('listAttachableCertificates unwraps {data}', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [{ id: 'c1' }] } });
  const r = await clientsApi.listAttachableCertificates('cl1');
  expect(apiClient.get).toHaveBeenCalledWith('/clients/cl1/attachable-certificates');
  expect(r).toHaveLength(1);
});
