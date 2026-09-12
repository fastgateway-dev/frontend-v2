import { topologyApi } from './topology';
import apiClient from './client';

jest.mock('./client');

test('getProjectTopology calls expected endpoint', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { domains: [], clients: [], ips: [] } });
  const r = await topologyApi.getProjectTopology('p1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/topology');
  expect(r.domains).toEqual([]);
});

test('getDomainTopology calls expected endpoint', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { domain: {}, gateway: {}, routes: [], backends: [], clients: [], attachments: [] } });
  await topologyApi.getDomainTopology('p1', 'd1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/domains/d1/topology');
});
