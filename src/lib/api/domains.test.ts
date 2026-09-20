import { domainsApi } from './domains';
import apiClient from './client';

jest.mock('./client');

test('attachCertificate PUTs certificateId', async () => {
  (apiClient.put as jest.Mock).mockResolvedValue({ data: { id: 'd1' } });
  await domainsApi.attachCertificate('p1', 'd1', 'c1');
  expect(apiClient.put).toHaveBeenCalledWith('/projects/p1/domains/d1/certificate', { certificateId: 'c1' });
});

test('detachCertificate DELETEs', async () => {
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: { id: 'd1' } });
  await domainsApi.detachCertificate('p1', 'd1');
  expect(apiClient.delete).toHaveBeenCalledWith('/projects/p1/domains/d1/certificate');
});
