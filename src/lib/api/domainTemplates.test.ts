import { domainTemplatesApi } from './domainTemplates';
import apiClient from './client';

jest.mock('./client');

test('getEntrypoint GETs the template entry point', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { mode: 'shared' } });
  const ep = await domainTemplatesApi.getEntrypoint('p1', 't1');
  expect(apiClient.get).toHaveBeenCalledWith('/projects/p1/domain-templates/t1/entrypoint');
  expect(ep.mode).toBe('shared');
});
