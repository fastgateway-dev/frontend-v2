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

test('stream route methods hit the stream-scoped endpoints', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: 'r1' } });
  (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'r1' } });
  (apiClient.put as jest.Mock).mockResolvedValue({ data: { id: 'r1' } });
  (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });
  const body = { name: 'db', teamId: 't1', config: { matches: [], backends: [], listenerPort: 5432 } };
  await streamsApi.getRoute('p1', 's1', 'r1');
  await streamsApi.createRoute('p1', 's1', body);
  await streamsApi.updateRoute('p1', 's1', 'r1', { config: body.config });
  await streamsApi.deleteRoute('p1', 's1', 'r1');
  await streamsApi.deployRoute('p1', 's1', 'r1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/streams/s1/routes', body);
  expect(apiClient.put).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1', { config: body.config });
  expect(apiClient.delete).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1/deploy');
});

test('entrypoint, manifest and preview methods hit the stream-scoped endpoints', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });
  (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
  const body = { name: 'db', teamId: 't1', config: { matches: [], backends: [], listenerPort: 5432 } };
  await streamsApi.getEntrypoint('p1', 's1');
  await streamsApi.getYamls('p1', 's1');
  await streamsApi.getRouteYamls('p1', 's1', 'r1');
  await streamsApi.previewCreateRoute('p1', 's1', body);
  await streamsApi.previewUpdateRoute('p1', 's1', 'r1', { config: body.config });
  await streamsApi.previewDeleteRoute('p1', 's1', 'r1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams/s1/entrypoint');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams/s1/yamls');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1/yamls');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/preview', body);
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1/preview', { config: body.config });
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1/preview-delete');
});

test('version methods hit the stream-scoped version endpoints', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [], total: 0 } });
  (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
  await streamsApi.listRouteVersions('p1', 's1', 'r1');
  await streamsApi.getRouteVersion('p1', 's1', 'r1', 3);
  await streamsApi.rollbackRouteVersion('p1', 's1', 'r1', 3);
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1/versions', { params: { page: 1, limit: 20 } });
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1/versions/3');
  expect(apiClient.post).toHaveBeenCalledWith('/projects/p1/streams/s1/routes/r1/versions/3/rollback');
});
