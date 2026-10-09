import { streamsApi } from './streams';
import apiClient from './client';

jest.mock('./client');

test('list GETs the project streams', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
  await streamsApi.list('p1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams');
});

test('create POSTs name, namespace and template', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 's1' } });
  const input = { name: 'pg', namespace: 'ns', gatewayTemplateId: 't1' };
  await streamsApi.create('p1', input);
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/streams', input);
});

test('update PATCHes and delete DELETEs', async () => {
  (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: 's1' } });
  (apiClient.delete as jest.Mock).mockResolvedValue({});
  await streamsApi.update('p1', 's1', { name: 'new' });
  await streamsApi.delete('p1', 's1');
  expect(apiClient.patch).toHaveBeenCalledWith('/projects/p1/streams/s1', { name: 'new' });
  expect(apiClient.delete).toHaveBeenCalledWith('/projects/p1/streams/s1');
});
